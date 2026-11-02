import { useMemo,useState } from "react";
import { CheckCircle2,Clock3,Inbox,MessageSquare,RefreshCw,Search,ShieldCheck,UserRoundCheck } from "lucide-react";
import { useInbox,type ThreadStatus } from "./useInbox";
import "./inbox.css";

const channels:Record<string,string>={whatsapp:"WhatsApp",facebook:"Messenger",instagram:"Instagram",web:"Web"};
const statusLabels:Record<ThreadStatus,string>={pending:"Pendiente",human:"Atención humana",bot:"Agente IA",closed:"Cerrada"};
const dates=(date:string)=>new Date(date).toLocaleString("es-PE",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});

export default function InboxPage({workspaceId}:{workspaceId:string}){
 const inbox=useInbox(workspaceId);
 const [filter,setFilter]=useState("all");const [query,setQuery]=useState("");const [busy,setBusy]=useState(false);const [notice,setNotice]=useState("");
 const contactsById=useMemo(()=>new Map(inbox.contacts.map(c=>[c.id,c])),[inbox.contacts]);
 const filtered=useMemo(()=>inbox.threads.filter(t=>(filter==="all"||t.channel===filter)
   &&(contactsById.get(t.contact_id)?.display_name.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es"))
     ||t.external_sender_id.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")))),[inbox.threads,filter,query,contactsById]);
 const selected=inbox.threads.find(t=>t.id===inbox.selectedId);
 const person=selected?contactsById.get(selected.contact_id):null;
 async function setStatus(status:ThreadStatus){
   if(!selected)return;
   setBusy(true);setNotice("");
   try{await inbox.changeStatus(selected.id,status);setNotice("Estado actualizado en Supabase.");}
   catch(error){setNotice("No se pudo actualizar: "+(error instanceof Error?error.message:"Error de acceso."));}
   finally{setBusy(false);}
 }
 return <div className="crm-inbox">
   <div className="inbox-summary">
     <div><strong>{inbox.threads.length}</strong><span>Conversaciones recibidas</span></div>
     <div><strong>{inbox.threads.filter(t=>t.status==="pending").length}</strong><span>Pendientes</span></div>
     <div><strong>{inbox.threads.filter(t=>t.status==="human").length}</strong><span>Atención humana</span></div>
     <button className="secondary-button" onClick={()=>void inbox.refresh()} disabled={inbox.loading}><RefreshCw size={16}/> Actualizar</button>
   </div>
   {inbox.error&&<div role="alert" className="auth-error">{inbox.error}</div>}
   {notice&&<div role="status" className="notice">{notice}</div>}
   <div className="inbox-workspace">
     <section className="inbox-conversations">
       <div className="inbox-list-title"><div><h2>Bandeja de entrada</h2><p>Mensajes reales de los canales autorizados</p></div><Inbox size={19}/></div>
       <label className="inbox-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar contacto o ID" aria-label="Buscar conversaciones"/></label>
       <div className="inbox-filter-tabs">
         {["all","whatsapp","instagram","facebook"].map(c=><button key={c} className={filter===c?"selected":""} onClick={()=>setFilter(c)}>{c==="all"?"Todos":channels[c]}</button>)}
       </div>
       {inbox.loading&&<div className="inbox-placeholder">Cargando conversaciones…</div>}
       {!inbox.loading&&!filtered.length&&<div className="inbox-placeholder"><MessageSquare size={25}/><strong>Sin conversaciones</strong><p>No se han recibido mensajes nuevos por este canal.</p></div>}
       <div className="inbox-thread-list">{filtered.map(t=><button className={"inbox-thread "+(t.id===inbox.selectedId?"active":"")} key={t.id} onClick={()=>inbox.setSelectedId(t.id)}>
         <span className="inbox-avatar">{(contactsById.get(t.contact_id)?.display_name||"C").slice(0,1).toUpperCase()}</span>
         <span className="inbox-thread-meta"><strong>{contactsById.get(t.contact_id)?.display_name||"Contacto"}</strong>
           <small>{channels[t.channel]} · {statusLabels[t.status]}</small>
         </span><time>{dates(t.last_activity_at)}</time>
       </button>)}</div>
     </section>
     <section className="inbox-chat">
       {selected?<><header className="inbox-chat-header"><div className="inbox-avatar large">{(person?.display_name||"C")[0].toUpperCase()}</div><div className="inbox-chat-name"><strong>{person?.display_name||"Contacto"}</strong><span>{channels[selected.channel]} · {person?.phone||"Identificador externo registrado"}</span></div><span className="inbox-status">{statusLabels[selected.status]}</span></header>
         <div className="inbox-timeline">
           {inbox.messageLoading&&<div className="inbox-placeholder">Cargando mensajes…</div>}
           {!inbox.messageLoading&&!inbox.messages.length&&<div className="inbox-placeholder">Sin mensajes registrados en esta conversación.</div>}
           {inbox.messages.map(m=><div key={m.id} className={"inbox-message "+(m.direction==="outbound"?"out":"in")}><p>{m.content||"Adjunto: "+m.message_type}</p><small>{m.direction==="inbound"?"Cliente":"STECH"} · {dates(m.created_at)}</small></div>)}
         </div>
         <div className="inbox-actions"><button className="secondary-button" disabled={busy||selected.status==="human"} onClick={()=>void setStatus("human")}><UserRoundCheck size={16}/> Asignar a humano</button><button className="secondary-button" disabled={busy||selected.status==="closed"} onClick={()=>void setStatus("closed")}><CheckCircle2 size={16}/> Cerrar</button><button className="secondary-button" disabled={busy||selected.status==="pending"} onClick={()=>void setStatus("pending")}><Clock3 size={16}/> Pendiente</button></div>
         <div className="inbox-disabled"><ShieldCheck size={16}/> Respuestas deshabilitadas hasta verificar conexión empresarial, ventana de mensajería y reglas de envío.</div>
       </>:<div className="inbox-no-selection"><MessageSquare size={40}/><h2>No hay conversaciones nuevas</h2><p>Cuando se active una integración verificada, los mensajes entrantes aparecerán aquí sin importar historiales antiguos.</p></div>}
     </section>
   </div>
 </div>;
}
