import {createClient} from "@supabase/supabase-js";
import {analyzeSalesConversation,immediateStop} from "./lead-intelligence.mjs";
import {foldSalesMemory} from "./sales-memory.mjs";

/**
 * Only executed after a signed, allowlisted inbound has been durably stored.
 * Classification costs no extra OpenAI tokens. It never sends to customers,
 * generates discounts or creates deals or scheduled outreach.
 */
export function createLeadIntelligenceProcessor({supabaseUrl,serviceRoleKey,db=null}={}){
 if(!db&&(!supabaseUrl||!serviceRoleKey))return null;
 const client=db||createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
 return async function assessInbound(event){
  const fallback={should_reply:!immediateStop(event?.text),requires_human:immediateStop(event?.text),
    followup_suppressed:true,priority:"sin_contacto",source_mode:"sandbox"};
  if(!event?.sender||!event?.phoneNumberId||!event?.messageId)return fallback;
  const {data:thread,error:threadError}=await client.from("arm_threads")
    .select("id,workspace_id,contact_id,status,assigned_to")
    .eq("channel","whatsapp").eq("external_account_ref",event.phoneNumberId)
    .eq("external_sender_id",event.sender).maybeSingle();
  if(threadError||!thread)return {...fallback,should_reply:false};
  const [messages,old]=await Promise.all([
    client.from("arm_messages").select("content,direction,external_message_id,created_at")
      .eq("workspace_id",thread.workspace_id).eq("thread_id",thread.id)
      .eq("direction","inbound").order("created_at",{ascending:false}).limit(16),
    client.from("arm_lead_insights").select("opt_out,sales_memory")
      .eq("thread_id",thread.id).maybeSingle()
  ]);
  if(messages.error||old.error)return {...fallback,should_reply:false};
  const chronological=[...(messages.data||[])].reverse();
  const profile=analyzeSalesConversation(chronological,{
    threadStatus:thread.status,assignedTo:thread.assigned_to,
    previousOptOut:old.data?.opt_out,sourceMode:"sandbox"
  });
  const memory=foldSalesMemory(old.data?.sales_memory,chronological);
  // Use only deterministic commercial facts from the buyer; never raw transcript
  // or AI-suggested customer data. This is persisted alongside lead triage.
  profile.sales_memory=memory||{};
  const {should_reply,...record}=profile;
  const {error:upsertError}=await client.from("arm_lead_insights").upsert({
    thread_id:thread.id,workspace_id:thread.workspace_id,contact_id:thread.contact_id,
    ...record,evaluated_at:new Date().toISOString()
  },{onConflict:"thread_id"});
  if(upsertError)return {...profile,should_reply:false};
  // Explicit request for a human or a serious complaint: stop bot and hand over,
  // but do not assign an unknown agent or send an unapproved acknowledgment.
  if(profile.requires_human && thread.status==="pending" && !thread.assigned_to){
    const {error}=await client.from("arm_threads").update({status:"human"})
      .eq("id",thread.id).eq("workspace_id",thread.workspace_id).eq("status","pending");
    if(error)return {...profile,should_reply:false};
  }
  return profile;
 };
}
