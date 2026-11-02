import { useMemo, useState } from "react";
import { Plus, Search, Users } from "lucide-react";
import type { Channel, Contact } from "../../types";
export default function ContactsPage({contacts,onCreate}:{contacts:Contact[];onCreate:(name:string,interest:string,source?:Channel)=>Promise<void>}) {
  const [filter,setFilter]=useState("");const [show,setShow]=useState(false);
  const [name,setName]=useState("");const [interest,setInterest]=useState("");const [source,setSource]=useState<Channel>("web");const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
  const visible=useMemo(()=>contacts.filter(c=>(c.name+" "+c.interest+" "+c.phone).toLocaleLowerCase("es").includes(filter.toLocaleLowerCase("es"))),[contacts,filter]);
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");setNotice("");try {await onCreate(name,interest,source);setShow(false);setName("");setInterest("");setNotice("Cliente registrado correctamente.");}catch(c){setError(c instanceof Error?c.message:"No se pudo guardar.");}finally{setBusy(false);}}
  return <section className="panel"><div className="panel-head"><div><h2>Directorio de clientes</h2><p>Registros persistentes del espacio comercial.</p></div><button className="primary-button" onClick={()=>setShow(v=>!v)}><Plus size={16}/> Nuevo cliente</button></div>
  {error&&<div className="auth-error" role="alert">{error}</div>}{notice&&<div className="notice" role="status">{notice}</div>}
  {show&&<form className="crm-inline-form" onSubmit={e=>void submit(e)}><label>Nombre<input required minLength={2} maxLength={200} value={name} onChange={e=>setName(e.target.value)} autoFocus placeholder="Nombre completo"/></label><label>Interés o necesidad<input value={interest} maxLength={400} onChange={e=>setInterest(e.target.value)} placeholder="Qué producto está buscando"/></label><label>Origen<select value={source} onChange={e=>setSource(e.target.value as Channel)}><option value="web">Manual / web</option><option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option></select></label><button className="primary-button" disabled={busy} type="submit">{busy?"Guardando…":"Guardar cliente"}</button></form>}
  <label className="search-box"><Search size={16}/><input aria-label="Buscar clientes" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Buscar por nombre o interés"/></label>
  {!visible.length&&<div className="empty-records"><Users size={22}/><p>{filter?"No hay coincidencias.":"Aún no hay clientes registrados. Puedes crear el primero."}</p></div>}
  <div className="contact-list">{visible.map(c=><div className="contact-item" key={c.id}><span className="person-avatar">{c.name.split(" ").map(s=>s.charAt(0)).slice(0,2).join("").toUpperCase()}</span><div className="contact-main"><strong>{c.name}</strong><span>{c.interest||"Sin interés registrado"}</span></div><span className="muted">{c.source}</span><span className="tiny-pill">Registrado</span></div>)}</div>
  </section>;
}
