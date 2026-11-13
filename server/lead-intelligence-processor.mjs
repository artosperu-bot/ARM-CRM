import {createClient} from "@supabase/supabase-js";
import {analyzeSalesConversation,immediateStop} from "./lead-intelligence.mjs";
import {foldSalesMemory,normalizeSalesMemory} from "./sales-memory.mjs";

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
  // One-time backfill for older threads that predate the memory feature.
  // Thereafter each message uses only the bounded recent window.
  let memoryMessages=chronological;
  if(!normalizeSalesMemory(old.data?.sales_memory)){
    const {data:backfill,error:backfillError}=await client.from("arm_messages")
      .select("content,direction,external_message_id,created_at")
      .eq("workspace_id",thread.workspace_id).eq("thread_id",thread.id)
      .eq("direction","inbound").order("created_at",{ascending:false}).limit(200);
    if(backfillError)return {...fallback,should_reply:false};
    memoryMessages=[...(backfill||[])].reverse();
  }
  const profile=analyzeSalesConversation(chronological,{
    threadStatus:thread.status,assignedTo:thread.assigned_to,
    previousOptOut:old.data?.opt_out,sourceMode:"sandbox"
  });
  const memory=foldSalesMemory(old.data?.sales_memory,memoryMessages);
  // Use only deterministic commercial facts from the buyer; never raw transcript
  // or AI-suggested customer data. This is persisted alongside lead triage.
  profile.sales_memory=memory||{};
  const {should_reply,...record}=profile;
  const {error:upsertError}=await client.from("arm_lead_insights").upsert({
    thread_id:thread.id,workspace_id:thread.workspace_id,contact_id:thread.contact_id,
    ...record,evaluated_at:new Date().toISOString()
  },{onConflict:"thread_id"});
  if(upsertError)return {...profile,should_reply:false};
  // Only a confirmed transition to the human queue authorizes a short
  // customer-facing acknowledgment. This does NOT assert staff assignment.
  profile.handoff_queued=false;
  if(profile.requires_human&&!profile.opt_out&&thread.status==="pending"&&!thread.assigned_to){
    const {data:queued,error}=await client.from("arm_threads").update({
      status:"human",human_queued_at:new Date().toISOString()
    })
      .eq("id",thread.id).eq("workspace_id",thread.workspace_id)
      .eq("status","pending").select("id").maybeSingle();
    if(error)return {...profile,should_reply:false};
    profile.handoff_queued=queued?.id===thread.id;
  }
  return profile;
 };
}
