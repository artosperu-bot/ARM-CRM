import {useCallback,useEffect,useState} from "react";
import {supabase} from "../../lib/supabase";

export type ThreadStatus = "pending"|"human"|"bot"|"closed";
export type HumanAction = "queue"|"claim"|"release"|"close"|"reopen";
export type Thread = {
 id:string;contact_id:string;channel:"whatsapp"|"facebook"|"instagram"|"web";
 external_sender_id:string;external_account_ref:string;status:ThreadStatus;last_activity_at:string;
 assigned_to:string|null;human_queued_at:string|null;human_assigned_at:string|null;
};
export type InboxContact = {id:string;display_name:string;phone:string|null;email:string|null};
export type LeadInsight = {
 thread_id:string;source_mode:"sandbox"|"real";
 intent:"consulta_general"|"consulta_producto"|"comparacion"|"cotizacion"|"compra"|"objecion"|"atencion_humana"|"no_contactar";
 priority:"alta"|"media"|"baja"|"sin_contacto";score:number;is_b2b:boolean;
 quantity_min:number|null;signals:string[];requires_human:boolean;opt_out:boolean;
 followup_suppressed:boolean;suppression_reason:string;next_action:string;
 last_message_id:string|null;evaluated_at:string;
};
export type InboxMessage = {
 id:string;thread_id:string|null;provider:string;direction:"inbound"|"outbound";
 content:string|null;message_type:string;created_at:string;
};
export type ManualReplyAccess = {
 allowed:boolean;reason:string|null;description:string;windowEndsAt:string|null;
};
export function useInbox(workspaceId:string){
 const [threads,setThreads]=useState<Thread[]>([]);
 const [contacts,setContacts]=useState<InboxContact[]>([]);
 const [insights,setInsights]=useState<LeadInsight[]>([]);
 const [messages,setMessages]=useState<InboxMessage[]>([]);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [userId,setUserId]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [messageLoading,setMessageLoading]=useState(false);
 const [error,setError]=useState("");
 const load=useCallback(async(silent=false)=>{
  if(!supabase)return;
  if(!silent)setLoading(true);
  setError("");
  const [th,co,lead]=await Promise.all([
   supabase.from("arm_threads").select("id,contact_id,channel,external_sender_id,external_account_ref,status,assigned_to,human_queued_at,human_assigned_at,last_activity_at")
    .eq("workspace_id",workspaceId).order("last_activity_at",{ascending:false}).limit(500),
   supabase.from("arm_contacts").select("id,display_name,phone,email").eq("workspace_id",workspaceId).limit(1000),
   supabase.from("arm_lead_insights").select("thread_id,source_mode,intent,priority,score,is_b2b,quantity_min,signals,requires_human,opt_out,followup_suppressed,suppression_reason,next_action,last_message_id,evaluated_at")
    .eq("workspace_id",workspaceId).order("evaluated_at",{ascending:false}).limit(500)
  ]);
  if(th.error||co.error||lead.error)setError(th.error?.message||co.error?.message||lead.error?.message||"Error al leer conversaciones.");
  else {
   const data=(th.data??[]) as Thread[];
   setThreads(data);setContacts((co.data??[]) as InboxContact[]);
   setInsights((lead.data??[]) as LeadInsight[]);
   setSelectedId(prev=>prev&&data.some(t=>t.id===prev)?prev:data[0]?.id??null);
  }
  if(!silent)setLoading(false);
 },[workspaceId]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{
  if(!supabase)return;
  let active=true;
  void supabase.auth.getUser().then(({data})=>{if(active)setUserId(data.user?.id??null);});
  return ()=>{active=false;};
 },[]);
 // In-app notification: unassigned human requests appear in the queue while the inbox is open.
 // No outgoing notifications to unapproved recipients are ever initiated by this timer.
 useEffect(()=>{
  const timer=setInterval(()=>{if(!document.hidden)void load(true);},20000);
  return ()=>clearInterval(timer);
 },[load]);
 const refreshMessages=useCallback(async(id=selectedId)=>{
  if(!supabase||!id)return;
  const {data,error:failure}=await supabase.from("arm_messages")
   .select("id,thread_id,provider,direction,content,message_type,created_at")
   .eq("workspace_id",workspaceId).eq("thread_id",id)
   .order("created_at",{ascending:true}).limit(500);
  if(failure)setError(failure.message);
  else if(id===selectedId)setMessages((data??[]) as InboxMessage[]);
 },[workspaceId,selectedId]);
 useEffect(()=>{
  if(!selectedId||!supabase){setMessages([]);return;}
  setMessages([]);setMessageLoading(true);setError("");
  void refreshMessages().finally(()=>setMessageLoading(false));
  const timer=setInterval(()=>{if(!document.hidden)void refreshMessages();},12000);
  return ()=>clearInterval(timer);
 },[selectedId,refreshMessages]);
 async function manualRequest(path:string,body?:Record<string,string>){
  if(!supabase)throw new Error("Supabase no está configurado.");
  const {data:{session},error:authError}=await supabase.auth.getSession();
  if(authError||!session?.access_token)throw new Error("Vuelve a iniciar sesión.");
  const response=await fetch("http://127.0.0.1:8789/manual-whatsapp/"+path,{
   method:body?"POST":"GET",
   headers:{"Authorization":"Bearer "+session.access_token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  });
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||"No se pudo comunicar con el servicio de WhatsApp.");
  return result;
 }
 async function manualStatus(id:string):Promise<ManualReplyAccess>{
  return manualRequest("status?"+new URLSearchParams({workspaceId,threadId:id}).toString());
 }
 async function sendManualMessage(id:string,text:string,requestId:string){
  const result=await manualRequest("send",{
   workspaceId,threadId:id,text,requestId
  }) as {ok:boolean;acceptedByMeta:boolean;persisted:boolean;notice:string};
  if(result.persisted)await refreshMessages(id);
  await load(true);
  return result;
 }
 async function humanAction(id:string,action:HumanAction){
  if(!supabase)throw new Error("Supabase no está configurado.");
  const {data,error:failure}=await supabase.rpc("arm_human_thread_action",{
   p_workspace_id:workspaceId,p_thread_id:id,p_action:action
  });
  if(failure)throw failure;
  if(!data||data.action!==action)throw new Error("El CRM no confirmó la gestión.");
  await load(true);
  return data as {action:HumanAction;status:ThreadStatus;assigned_to:string|null};
 }
 return {threads,contacts,insights,messages,selectedId,setSelectedId,userId,
  loading,messageLoading,error,refresh:()=>load(false),refreshMessages,
  manualStatus,sendManualMessage,humanAction};
}
