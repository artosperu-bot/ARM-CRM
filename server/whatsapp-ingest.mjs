import {createClient} from "@supabase/supabase-js";

export function createArmWhatsAppIngest({supabaseUrl,serviceRoleKey,db=null}={}) {
 if(!db && (!supabaseUrl || !serviceRoleKey))return null;
 const client=db||createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
 return async function ingest(event) {
   if(!event?.messageId || !event?.sender || !event?.phoneNumberId || !event?.timestamp)
     throw new Error("INCOMPLETE_META_EVENT");
   const occurredAt=new Date(event.timestamp*1000);
   if(!Number.isFinite(occurredAt.getTime()))throw new Error("INVALID_META_TIMESTAMP");
   const {data,error}=await client.rpc("arm_ingest_meta_message",{
     p_channel:"whatsapp",p_account_ref:event.phoneNumberId,p_sender_id:event.sender,
     p_message_id:event.messageId,p_content:event.text,
     p_message_type:"text",p_sender_name:event.senderName||"",
     p_occurred_at:occurredAt.toISOString()
   });
   if(error)throw new Error("ARM_RPC_FAILED");
   if(!["stored","duplicate","ignored"].includes(data))throw new Error("ARM_RPC_UNEXPECTED_RESULT");
   return data;
 };
}
