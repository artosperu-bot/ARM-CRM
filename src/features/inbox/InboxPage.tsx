import { useMemo,useState } from "react";
import { CheckCircle2,Clock3,Inbox,MessageSquare,RefreshCw,Search,ShieldCheck,UserRoundCheck } from "lucide-react";
import { useInbox,type ThreadStatus } from "./useInbox";
import "./inbox.css";

const channels:Record<string,string>={whatsapp:"WhatsApp",facebook:"Messenger",instagram:"Instagram",web:"Web"};
const statusLabels:Record<ThreadStatus,string>={pending:"Pendiente",human:"Atención humana",bot:"Agente IA",closed:"Cerrada"};
const leadNames:Record<string,string>={consulta_general:"Consulta",consulta_producto:"Producto",comparacion:"Comparación",cotizacion:"Cotización",compra:"Compra",objecion:"Objeción",atencion_humana:"Asesor",no_contactar:"No contactar"};
const priorityNames:Record<string,string>={alta:"Alta",media:"Media",baja:"Baja",sin_contacto:"No contactar"};
const dates=(date:string)=>new Date(date).toLocaleString("es-PE",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});

export default function InboxPage({workspaceId}:{workspaceId:string}){
 const inbox=useInbox(workspaceId);
 const [filter,setFilter]=useState("all");const [leadFilter,setLeadFilter]=useState("all");const [query,setQuery]=useState("");const [busy,setBusy]=useState(false);const [notice,setNotice]=useState("");
 const contactsById=useMemo(()=>new Map(inbox.contacts.map(c=>[c.id,c])),[inbox.contacts]);
 const leadByThread=useMemo(()=>new Map(inbox.insights.map(x=>[x.thread_id,x])),[inbox.insights]);
 const filtered=useMemo(()=>inbox.threads.filter(t=>{
   const lead=leadByThread.get(t.id);
   const text=query.toLocaleLowerCase("es").trim();
   const matchesText=!text||Boolean(contactsById.get(t.contact_id)?.display_name.toLocaleLowerCase("es").includes(text)
     ||t.external_sender_id.toLocaleLowerCase("es").includes(text));
   const matchesLead=leadFilter==="all"||
     (leadFilter==="alta"&&lead?.priority==="alta")||
     (leadFilter==="b2b"&&lead?.is_b2b===true)||
     (leadFilter==="cotizacion"&&["cotizacion","compra"].includes(lead?.intent||""))||
     (leadFilter==="humano"&&(t.status==="human"||lead?.requires_human===true))||
     (leadFilter==="sin_contacto"&&(lead?.opt_out===true||t.status==="closed"));
   return (filter==="all"||t.channel===filter)&&matchesText&&matchesLead;
 }),[inbox.threads,filter,leadFilter,query,contactsById,leadByThread]);
 const selected=inbox.threads.find(t=>t.id===inbox.selectedId);
 const selectedLead=selected?leadByThread.get(selected.id):null;
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
       <div className="inbox-lead-filter" aria-label="Filtros de prioridad comercial">
         {[
           ["all","Todas"],["alta","Alta prioridad"],["b2b","Empresas / 2+"],
           ["cotizacion","Cotización / compra"],["humano","Asesor"],["sin_contacto","No contactar"]
         ].map(([key,name])=><button key={key} className={leadFilter===key?"selected":""}
            onClick={()=>setLeadFilter(key)}>{name}</button>)}
       </div>
       <p className="inbox-lead-note">Prioridad orientativa por señales del chat, no probabilidad de compra. Las pruebas nunca generan seguimientos automáticos.</p>
       {inbox.loading&&<div className="inbox-placeholder">Cargando conversaciones…</div>}
       {!inbox.loading&&!filtered.length&&<div className="inbox-placeholder"><MessageSquare size={25}/><strong>Sin conversaciones</strong><p>No se han recibido mensajes nuevos por este canal.</p></div>}
       <div className="inbox-thread-list">{filtered.map(t=><button className={"inbox-thread "+(t.id===inbox.selectedId?"active":"")} key={t.id} onClick={()=>inbox.setSelectedId(t.id)}>
         <span className="inbox-avatar">{(contactsById.get(t.contact_id)?.display_name||"C").slice(0,1).toUpperCase()}</span>
         <span className="inbox-thread-meta"><strong>{contactsById.get(t.contact_id)?.display_name||"Contacto"}</strong>
           <small>{channels[t.channel]} · {statusLabels[t.status]}</small>
           {leadByThread.has(t.id)&&<small className="inbox-lead-meta">
             <span className={"inbox-lead-rank "+leadByThread.get(t.id)?.priority}>{priorityNames[leadByThread.get(t.id)?.priority||"baja"]}</span>
             {leadByThread.get(t.id)?.is_b2b?" · B2B":""} · {leadNames[leadByThread.get(t.id)?.intent||"consulta_general"]}
             {leadByThread.get(t.id)?.source_mode==="sandbox"?" · PRUEBA":""}
           </small>}
         </span><time>{dates(t.last_activity_at)}</time>
       </button>)}</div>
     </section>
     <section className="inbox-chat">
       {selected?<><header className="inbox-chat-header"><div className="inbox-avatar large">{(person?.display_name||"C")[0].toUpperCase()}</div><div className="inbox-chat-name"><strong>{person?.display_name||"Contacto"}</strong><span>{channels[selected.channel]} · {person?.phone||"Identificador externo registrado"}</span></div><span className="inbox-status">{statusLabels[selected.status]}</span></header>
         {selectedLead&&<section className="inbox-intelligence" aria-label="Análisis comercial de la conversación">
           <div className="inbox-intelligence-title"><strong>Lectura comercial sugerida</strong>
             <span>{priorityNames[selectedLead.priority]} · {leadNames[selectedLead.intent]}
             {selectedLead.is_b2b?" · Posible B2B":""}</span>
           </div>
           <p>{selectedLead.next_action}</p>
           {selectedLead.quantity_min!==null&&<small>Equipos mencionados: {selectedLead.quantity_min} (sin validar)</small>}
           {selectedLead.opt_out&&<strong className="inbox-intelligence-stop">No contactar: el cliente solicitó detener comunicaciones.</strong>}
           {selectedLead.requires_human&&<small>Requiere revisión de un asesor. ALEX no debe responder.</small>}
           {selectedLead.source_mode==="sandbox"&&<small>PRUEBA: no convertir automáticamente a venta ni programar mensajes.</small>}
           <small>Seguimiento saliente: bloqueado hasta autorización y verificación.</small>
         </section>}
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
