import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export type ThreadStatus = "pending" | "human" | "bot" | "closed";
export type Thread = {
  id:string; contact_id:string;channel:"whatsapp"|"facebook"|"instagram"|"web";
  external_sender_id:string;external_account_ref:string;status:ThreadStatus;last_activity_at:string;
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
export function useInbox(workspaceId:string) {
  const [threads,setThreads]=useState<Thread[]>([]);
  const [contacts,setContacts]=useState<InboxContact[]>([]);
  const [insights,setInsights]=useState<LeadInsight[]>([]);
  const [messages,setMessages]=useState<InboxMessage[]>([]);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [messageLoading,setMessageLoading]=useState(false);
  const [error,setError]=useState("");
  const load=useCallback(async()=>{
    if(!supabase)return;
    setLoading(true);setError("");
    const [th,co,lead]=await Promise.all([
      supabase.from("arm_threads").select("id,contact_id,channel,external_sender_id,external_account_ref,status,last_activity_at")
        .eq("workspace_id",workspaceId).order("last_activity_at",{ascending:false}).limit(500),
      supabase.from("arm_contacts").select("id,display_name,phone,email").eq("workspace_id",workspaceId).limit(1000),
      supabase.from("arm_lead_insights").select("thread_id,source_mode,intent,priority,score,is_b2b,quantity_min,signals,requires_human,opt_out,followup_suppressed,suppression_reason,next_action,last_message_id,evaluated_at")
        .eq("workspace_id",workspaceId).order("evaluated_at",{ascending:false}).limit(500)
    ]);
    if(th.error||co.error||lead.error)setError(th.error?.message||co.error?.message||lead.error?.message||"Error al leer conversaciones.");
    else {
      const data=(th.data??[]) as Thread[];
      setThreads(data);setContacts((co.data??[]) as InboxContact[]);setInsights((lead.data??[]) as LeadInsight[]);
      setSelectedId(prev=>prev&&data.some(t=>t.id===prev)?prev:data[0]?.id??null);
    }
    setLoading(false);
  },[workspaceId]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{
    if(!selectedId||!supabase){setMessages([]);return;}
    let active=true;setMessageLoading(true);setError("");
    void supabase.from("arm_messages").select("id,thread_id,provider,direction,content,message_type,created_at")
      .eq("workspace_id",workspaceId).eq("thread_id",selectedId).order("created_at",{ascending:true}).limit(500)
      .then(({data,error:failure})=>{
        if(!active)return;
        if(failure)setError(failure.message);else setMessages((data??[]) as InboxMessage[]);
        setMessageLoading(false);
      });
    return ()=>{active=false;};
  },[workspaceId,selectedId]);
  async function changeStatus(id:string,status:ThreadStatus){
    if(!supabase)throw new Error("Supabase no está configurado.");
    const {data,error:failure}=await supabase.from("arm_threads")
      .update({status}).eq("workspace_id",workspaceId).eq("id",id).select("id");
    if(failure)throw failure;
    if(!data?.length)throw new Error("No hay permiso para modificar esta conversación.");
    await load();
  }
  return {threads,contacts,insights,messages,selectedId,setSelectedId,loading,messageLoading,error,refresh:load,changeStatus};
}
