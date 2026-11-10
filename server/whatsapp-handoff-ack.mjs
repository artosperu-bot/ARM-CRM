import {createClient} from "@supabase/supabase-js";
import {HUMAN_QUEUE_CONFIRMED_REPLY} from "./human-handoff-phrasing.mjs";

/**
 * One short, deterministic confirmation when a signed + allowlisted WhatsApp
 * conversation is successfully placed in the human queue.
 *
 * It promises a handoff in progress, not a named employee or completed review.
 * The lead processor authorizes this only for the *new* pending -> human
 * transition, so later angry messages cannot generate repeated acknowledgments.
 */
export const HANDOFF_MESSAGE=HUMAN_QUEUE_CONFIRMED_REPLY;

const digits=value=>String(value||"").replace(/\D/g,"");
export function createWhatsAppHandoffAck({
 supabaseUrl,serviceRoleKey,whatsappToken,phoneId,allowedNumbers=[],
 graphVersion="v25.0",db=null,fetcher=fetch
}={}){
 if((!db&&(!supabaseUrl||!serviceRoleKey))||!whatsappToken||!phoneId)return null;
 const client=db||createClient(supabaseUrl,serviceRoleKey,{
  auth:{persistSession:false,autoRefreshToken:false}
 });
 const allowed=new Set(allowedNumbers.map(digits).filter(Boolean));
 return async function acknowledgeHumanQueue(event,decision){
  if(!decision?.handoff_queued||decision?.opt_out||!event?.sender||
     !allowed.has(digits(event.sender))||event.phoneNumberId!==phoneId)
   return {status:"blocked"};
  // Only a recent inbound can receive a freeform WhatsApp response.
  if(!Number.isFinite(event.timestamp)||
     event.timestamp*1000<Date.now()-60*60*1000||
     event.timestamp*1000>Date.now()+120000)
   return {status:"stale"};
  const {data:thread,error:threadError}=await client.from("arm_threads")
   .select("id,workspace_id,contact_id,status")
   .eq("channel","whatsapp").eq("external_account_ref",phoneId)
   .eq("external_sender_id",event.sender).maybeSingle();
  if(threadError||!thread||thread.status!=="human")
   return {status:"not_queued"};
  const {data:insight,error:insightError}=await client.from("arm_lead_insights")
   .select("opt_out").eq("thread_id",thread.id).maybeSingle();
  if(insightError||insight?.opt_out)return {status:"blocked"};
  const res=await fetcher("https://graph.facebook.com/"+encodeURIComponent(graphVersion)+"/"+
    encodeURIComponent(phoneId)+"/messages",{
    method:"POST",
    headers:{"Authorization":"Bearer "+whatsappToken,"Content-Type":"application/json"},
    body:JSON.stringify({messaging_product:"whatsapp",recipient_type:"individual",
     to:event.sender,type:"text",text:{preview_url:false,body:HANDOFF_MESSAGE}})
   });
  if(!res.ok)throw new Error("ARM_HANDOFF_SEND_HTTP_"+res.status);
  const sent=await res.json();
  const outboundId=sent?.messages?.[0]?.id;
  if(typeof outboundId!=="string")throw new Error("ARM_HANDOFF_SEND_UNCONFIRMED");
  const {error:logError}=await client.from("arm_messages").insert({
   workspace_id:thread.workspace_id,contact_id:thread.contact_id,thread_id:thread.id,
   provider:"whatsapp",external_message_id:outboundId,direction:"outbound",
   message_type:"text",content:HANDOFF_MESSAGE,created_at:new Date().toISOString()
  });
  if(logError)throw new Error("ARM_HANDOFF_OUTBOUND_LOG_FAILED");
  return {status:"sent",messageId:outboundId};
 };
}
