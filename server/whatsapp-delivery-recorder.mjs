import {createClient} from "@supabase/supabase-js";

const level={unknown:0,sent:1,failed:1.5,delivered:2,read:3};
export function createWhatsAppDeliveryRecorder({
 supabaseUrl,serviceRoleKey,db=null,phoneId
}={}){
 if((!db&&(!supabaseUrl||!serviceRoleKey))||!phoneId)return null;
 const client=db||createClient(supabaseUrl,serviceRoleKey,
   {auth:{persistSession:false,autoRefreshToken:false}});
 return async function recordDelivery(event){
  if(!event?.messageId||event.phoneNumberId!==phoneId||!Object.hasOwn(level,event.status))
   return {status:"blocked"};
  const {data:job,error:jobError}=await client.from("arm_whatsapp_outbox")
   .select("id,workspace_id,thread_id,delivery_status")
   .eq("provider_message_id",event.messageId).eq("state","sent").maybeSingle();
  if(jobError)throw new Error("ARM_DELIVERY_LOOKUP_FAILED");
  if(!job)return {status:"unknown_message"};
  const {data:thread,error:threadError}=await client.from("arm_threads")
   .select("external_account_ref").eq("id",job.thread_id)
   .eq("workspace_id",job.workspace_id).maybeSingle();
  if(threadError||!thread)throw new Error("ARM_DELIVERY_ACCOUNT_LOOKUP_FAILED");
  if(thread.external_account_ref!==phoneId)return {status:"blocked"};
  if(level[event.status]<=level[job.delivery_status||"unknown"])
   return {status:"unchanged"};
  const ts=Number(event.timestamp);
  const delivered=event.status==="delivered"||event.status==="read";
  const change={delivery_status:event.status,
   ...(delivered&&Number.isFinite(ts)&&ts>0?{delivered_at:new Date(ts*1000).toISOString()}:{})};
  let update=client.from("arm_whatsapp_outbox").update(change)
   .eq("id",job.id).eq("state","sent");
  update=job.delivery_status?update.eq("delivery_status",job.delivery_status):
    update.is("delivery_status",null);
  const {data,error}=await update.select("id").maybeSingle();
  if(error)throw new Error("ARM_DELIVERY_SAVE_FAILED");
  return {status:data?"updated":"unchanged"};
 };
}
