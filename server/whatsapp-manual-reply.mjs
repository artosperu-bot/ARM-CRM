import {randomUUID} from "node:crypto";

const REASONS={
 invalid_thread:"Esta conversación no está disponible.",
 assigned_elsewhere:"Toma la conversación para poder responder.",
 wrong_channel:"La respuesta manual de prueba solo está habilitada para WhatsApp.",
 unauthorized_recipient:"El destinatario no está autorizado para el piloto de WhatsApp.",
 no_contact:"El cliente solicitó no recibir mensajes.",
 no_inbound:"Todavía no hay un mensaje entrante válido de WhatsApp.",
 window_expired:"La ventana de 24 horas terminó. El cliente debe escribir nuevamente o se necesita una plantilla aprobada.",
 service_unavailable:"El servicio de WhatsApp no está configurado."
};
function fail(code,status=403){
 const error=new Error(REASONS[code]||code);
 error.status=status;
 return error;
}
export function manualReplyEligibility({
 thread,lead,lastInboundAt,userId,workspaceId,phoneId,allowlist=[],now=Date.now(),configured=true
}={}){
 if(!thread||thread.workspace_id!==workspaceId) return {allowed:false,reason:"invalid_thread"};
 if(thread.channel!=="whatsapp")return {allowed:false,reason:"wrong_channel"};
 if(thread.status!=="human"||thread.assigned_to!==userId)return {allowed:false,reason:"assigned_elsewhere"};
 if(lead?.opt_out===true)return {allowed:false,reason:"no_contact"};
 const recipient=String(thread.external_sender_id||"").replace(/\D/g,"");
 const authorized=new Set(allowlist.map(n=>String(n).replace(/\D/g,"")));
 if(!configured)return {allowed:false,reason:"service_unavailable"};
 if(!phoneId||thread.external_account_ref!==phoneId||!authorized.has(recipient))
  return {allowed:false,reason:"unauthorized_recipient"};
 const time=Date.parse(String(lastInboundAt||""));
 if(!Number.isFinite(time)||time>now+120000)return {allowed:false,reason:"no_inbound"};
 const ends=time+24*3600000;
 if(ends<=now)return {allowed:false,reason:"window_expired",windowEndsAt:new Date(ends).toISOString()};
 return {allowed:true,reason:null,windowEndsAt:new Date(ends).toISOString()};
}
export function createManualWhatsAppService({
 db,fetcher=fetch,phoneId,allowlist=[],accessToken,graphVersion="v25.0",
 now=()=>Date.now()
}={}){
 const accepted=new Map(),inflight=new Map(),recentTexts=new Map();
 async function context({workspaceId,threadId,userId}){
  if(!db)throw fail("service_unavailable",503);
  const [threadResult,leadResult,lastResult]=await Promise.all([
   db.from("arm_threads").select("id,workspace_id,contact_id,channel,status,assigned_to,external_sender_id,external_account_ref")
    .eq("workspace_id",workspaceId).eq("id",threadId).maybeSingle(),
   db.from("arm_lead_insights").select("opt_out").eq("workspace_id",workspaceId).eq("thread_id",threadId).maybeSingle(),
   db.from("arm_messages").select("created_at").eq("workspace_id",workspaceId).eq("thread_id",threadId)
    .eq("provider","whatsapp").eq("direction","inbound").order("created_at",{ascending:false}).limit(1)
  ]);
  if(threadResult.error||leadResult.error||lastResult.error)throw fail("service_unavailable",503);
  const thread=threadResult.data;
  const eligibility=manualReplyEligibility({
   thread,lead:leadResult.data,lastInboundAt:lastResult.data?.[0]?.created_at,
   userId,workspaceId,phoneId,allowlist,now:now(),
   configured:Boolean(accessToken&&phoneId&&allowlist.length)
  });
  return {...eligibility,description:eligibility.allowed?"Puedes responder manualmente durante la ventana de WhatsApp.":REASONS[eligibility.reason],thread};
 }
 async function status({workspaceId,threadId,userId}){
  const result=await context({workspaceId,threadId,userId});
  return {allowed:result.allowed,reason:result.reason,description:result.description,windowEndsAt:result.windowEndsAt||null};
 }
 async function perform({workspaceId,threadId,userId,text,requestId}){
  const cleaned=String(text||"").trim();
  if(cleaned.length<1||cleaned.length>800||/[\u0000-\u0008\u000B-\u001F]/u.test(cleaned))
   throw Object.assign(new Error("Escribe un mensaje de 1 a 800 caracteres."),{status:400});
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,40}$/iu.test(String(requestId||"")))
   throw Object.assign(new Error("Identificador de envío inválido."),{status:400});
  const key=workspaceId+":"+threadId+":"+requestId;
  const textKey=workspaceId+":"+threadId+":"+cleaned;
  if(accepted.has(key))return {...accepted.get(key),repeated:true};
  const recent=recentTexts.get(textKey);
  if(recent&&now()-recent.at<8000)
   return {...recent.result,repeated:true,notice:"Este mismo mensaje ya se envió hace unos segundos; no se duplicó."};
  if(inflight.has(key))return inflight.get(key);
  const task=(async()=>{
   const state=await context({workspaceId,threadId,userId});
   if(!state.allowed)throw fail(state.reason,state.reason==="window_expired"?409:403);
   const payload={messaging_product:"whatsapp",recipient_type:"individual",
    to:String(state.thread.external_sender_id).replace(/\D/g,""),type:"text",
    text:{preview_url:false,body:cleaned}};
   let response;
   try{response=await fetcher("https://graph.facebook.com/"+encodeURIComponent(graphVersion)+"/"+encodeURIComponent(phoneId)+"/messages",{
    method:"POST",headers:{Authorization:"Bearer "+accessToken,"Content-Type":"application/json"},
    body:JSON.stringify(payload),signal:AbortSignal.timeout(17000)
   });}catch{throw Object.assign(new Error("No se pudo confirmar el envío en Meta. Revisa el teléfono antes de reintentar."),{status:503});}
   const data=await response.json().catch(()=>({}));
   const messageId=data?.messages?.[0]?.id;
   if(!response.ok||typeof messageId!=="string")
    throw Object.assign(new Error("Meta no aceptó el mensaje. "+(data.error?.message||"Verifica el canal y la ventana de envío.").slice(0,160)),{status:502});
   const output={ok:true,acceptedByMeta:true,delivered:false,messageId,persisted:false,
    notice:"Meta aceptó el mensaje. La entrega al teléfono aún está por confirmar."};
   // Store the accepted result *before* persistence so retries with the same key
   // cannot send the WhatsApp message twice if the DB write fails.
   accepted.set(key,output);
   recentTexts.set(textKey,{at:now(),result:output});
   if(accepted.size>200)accepted.delete(accepted.keys().next().value);
   if(recentTexts.size>200)recentTexts.delete(recentTexts.keys().next().value);
   const saved=await db.from("arm_messages").insert({
    workspace_id:workspaceId,contact_id:state.thread.contact_id,thread_id:threadId,
    provider:"whatsapp",external_message_id:messageId,direction:"outbound",
    message_type:"text",content:cleaned
   }).select("id").single();
   if(saved.error){
    console.error("ARM_MANUAL_WHATSAPP_PERSISTENCE_FAILED",saved.error.code||"unknown");
    return {...output,notice:"Meta aceptó el mensaje, pero no se pudo guardar en el historial. No vuelvas a enviarlo sin revisar."};
   }
   output.persisted=true;
   void db.from("arm_threads").update({last_activity_at:new Date(now()).toISOString()})
    .eq("id",threadId).eq("workspace_id",workspaceId).then(({error})=>{
     if(error)console.error("ARM_MANUAL_THREAD_UPDATE_FAILED",error.code||"unknown");
    });
   return output;
  })();
  inflight.set(key,task);
  try{return await task;}finally{inflight.delete(key);}
 }
 return {status,send:perform};
}
