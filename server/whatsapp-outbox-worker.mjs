import {createClient} from "@supabase/supabase-js";

const normalize=value=>String(value||"").replace(/\D/g,"");
const validStates=new Set(["pending","triaging","ready","sending","sent","skipped","review"]);

/**
 * One durable, sandbox-only WhatsApp queue. Input comes from an inbound row
 * inserted transactionally by the verified Meta webhook. Only the two approved
 * senders may reach the existing Graph responders.
 *
 * Graph acceptance is not an idempotency guarantee. A failed/unknown send is
 * REVIEW, never an automatic replay: this deliberately prefers manual recovery
 * over double messages.
 */
export function createWhatsAppOutboxWorker({
  supabaseUrl,serviceRoleKey,db=null,phoneId,allowedNumbers=[],
  triage=null,responder=null,handoffAck=null,onResult=()=>{},now=()=>Date.now()
}={}){
 if(!db&&(!supabaseUrl||!serviceRoleKey))return null;
 if(!phoneId||!triage)return null;
 const client=db||createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const allowed=new Set(allowedNumbers.map(normalize).filter(Boolean));
 let busy=false;
 let recoveryAt=0;
 async function updateJob(id,expected,changes){
  const {data,error}=await client.from("arm_whatsapp_outbox")
   .update({...changes,updated_at:new Date(now()).toISOString()})
   .eq("id",id).eq("state",expected).select("id").maybeSingle();
  if(error||!data)throw new Error("ARM_OUTBOX_STATE_CONFLICT");
 }
 async function recover(){
  if(now()-recoveryAt<30000)return;
  recoveryAt=now();
  const cutoff=new Date(now()-120000).toISOString();
  // Triage cannot send to Meta; restarting it is safe. Sending is ambiguous.
  const [triaging,exhausted,sending]=await Promise.all([
   client.from("arm_whatsapp_outbox").update({state:"pending",
      next_attempt_at:new Date(now()).toISOString(),
      updated_at:new Date(now()).toISOString()})
    .eq("state","triaging").lt("updated_at",cutoff).lt("attempts",3),
   client.from("arm_whatsapp_outbox").update({state:"review",
      last_error:"triage_retry_exhausted",
      updated_at:new Date(now()).toISOString()})
    .eq("state","triaging").lt("updated_at",cutoff).gte("attempts",3),
   client.from("arm_whatsapp_outbox").update({state:"review",
      last_error:"ambiguous_graph_after_restart",
      updated_at:new Date(now()).toISOString()})
    .eq("state","sending").lt("updated_at",cutoff)
  ]);
  if(triaging.error||exhausted.error||sending.error)throw new Error("ARM_OUTBOX_RECOVERY_FAILED");
 }
 async function claim(phase){
  const {data,error}=await client.rpc("arm_claim_whatsapp_outbox",{p_phase:phase});
  if(error)throw new Error("ARM_OUTBOX_CLAIM_FAILED");
  if(data&&(!validStates.has(data.state)||!data.id))throw new Error("ARM_OUTBOX_INVALID_JOB");
  return data;
 }
 async function eventFor(job){
  const [msg,thread]=await Promise.all([
   client.from("arm_messages")
     .select("id,external_message_id,direction,provider,message_type,content,created_at")
     .eq("id",job.inbound_id).eq("workspace_id",job.workspace_id).maybeSingle(),
   client.from("arm_threads")
     .select("id,status,assigned_to,external_account_ref,external_sender_id,workspace_id")
     .eq("id",job.thread_id).eq("workspace_id",job.workspace_id).maybeSingle()
  ]);
  if(msg.error||thread.error||!msg.data||!thread.data)throw new Error("ARM_OUTBOX_CONTEXT_UNAVAILABLE");
  const message=msg.data,t=thread.data;
  const ts=Date.parse(message.created_at);
  if(message.direction!=="inbound"||message.provider!=="whatsapp"||message.message_type!=="text"||
     !message.external_message_id||!message.content||!Number.isFinite(ts))
    return null;
  const event={messageId:message.external_message_id,text:message.content,
    timestamp:Math.floor(ts/1000),sender:t.external_sender_id,
    phoneNumberId:t.external_account_ref};
  if(event.phoneNumberId!==phoneId||!allowed.has(normalize(event.sender)))return null;
  return event;
 }
 async function processTriage(job){
  try{
   const event=await eventFor(job);
   if(!event){await updateJob(job.id,"triaging",{state:"skipped",last_error:"sender_not_allowed"});return;}
   const decision=await triage(event);
   const kind=decision?.opt_out?null:
     decision?.handoff_queued&&handoffAck?"handoff_ack":
     decision?.should_reply&&responder?"ai_reply":null;
   await updateJob(job.id,"triaging",{
     state:kind?"ready":"skipped",kind,
     last_error:kind?null:"no_authorized_reply",
     next_attempt_at:new Date(now()).toISOString()
   });
  }catch(err){
   const attempts=Number(job.attempts)||1;
   const retry=attempts<3;
   await updateJob(job.id,"triaging",{
    state:retry?"pending":"review",
    last_error:"triage_failed",
    next_attempt_at:new Date(now()+Math.min(120000,attempts*15000)).toISOString()
   });
   onResult({phase:"triage",status:retry?"retry":"review"});
  }
 }
 async function processSend(job){
  try{
   const event=await eventFor(job);
   if(!event||event.timestamp*1000<now()-3600000||
      event.timestamp*1000>now()+120000){
     await updateJob(job.id,"sending",{state:"skipped",last_error:"unauthorized_or_stale"});
     return;
   }
   let result;
   if(job.kind==="handoff_ack"){
    result=await handoffAck?.(event,{handoff_queued:true,opt_out:false});
   }else if(job.kind==="ai_reply"){
    const {data:lead,error}=await client.from("arm_lead_insights")
      .select("sales_memory,intent,quantity_min,is_b2b").eq("thread_id",job.thread_id)
      .eq("workspace_id",job.workspace_id).maybeSingle();
    if(error)throw new Error("ARM_OUTBOX_LEAD_LOOKUP_FAILED");
    result=await responder?.(event,lead||null);
   }
   if(result?.status==="sent"&&typeof result.messageId==="string"){
     await updateJob(job.id,"sending",{
       state:"sent",provider_message_id:result.messageId,
       delivery_status:"sent",last_error:null
     });
     onResult({phase:"send",status:"sent"});
   }else{
     await updateJob(job.id,"sending",{
       state:"skipped",last_error:String(result?.status||"no_reply").slice(0,60)
     });
     onResult({phase:"send",status:"skipped"});
   }
  }catch(err){
   // A response may have reached Graph before an exception or lost ACK.
   // Never replay this job without a human checking Meta delivery receipts.
   await updateJob(job.id,"sending",{state:"review",last_error:"send_unconfirmed"});
   onResult({phase:"send",status:"review"});
  }
 }
 async function runOnce(){
  if(busy)return {status:"busy"};
  busy=true;
  try{
   await recover();
   const pending=await claim("triage");
   if(pending)await processTriage(pending);
   const ready=await claim("send");
   if(ready)await processSend(ready);
   return {status:"ok",processed:Number(Boolean(pending))+Number(Boolean(ready))};
  }finally{busy=false;}
 }
 return {runOnce};
}
