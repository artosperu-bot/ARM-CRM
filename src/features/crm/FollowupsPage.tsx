import { useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, Plus, Users, XCircle } from "lucide-react";
import type { Contact, Followup } from "../../types";
import { validateFollowup } from "./followups.domain";
import "./followups.css";

export default function FollowupsPage({ contacts, tasks, onCreate, onComplete, onCancel }: {
  contacts: Contact[];
  tasks: Followup[];
  onCreate: (contactId: string, description: string, dueAt: string) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [contactId, setContactId] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [view, setView] = useState<"pending" | "completed" | "cancelled">("pending");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const sorted = tasks.filter((f) => f.status === view);
  const pendingCount = tasks.filter((f) => f.status === "pending").length;
  const overdueCount = tasks.filter((f) => f.status === "pending" && new Date(f.dueAt).getTime() < Date.now()).length;
  function contactName(id: string) { return contacts.find((c) => c.id === id)?.name || "Cliente sin asignar"; }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    try {
      if (!contactId) throw new Error("Selecciona un cliente.");
      const isoDate = validateFollowup(dueDate, description);
      setBusy(true);
      await onCreate(contactId, description, isoDate);
      setDescription(""); setDueDate(""); setShowForm(false);
      setNotice("Seguimiento guardado en Supabase.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el seguimiento.");
    } finally { setBusy(false); }
  }
  async function complete(id: string) {
    setError(""); setNotice("");
    try { setBusy(true); await onComplete(id); setNotice("Seguimiento marcado como completado."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo actualizar."); }
    finally { setBusy(false); }
  }

  async function cancel(id: string) {
    setBusy(true);setError("");setNotice("");
    try { await onCancel(id);setConfirmCancelId(null);setNotice("Seguimiento cancelado. No se envió ningún mensaje."); }
    catch (cause){setError(cause instanceof Error?cause.message:"No se pudo cancelar.");}
    finally {setBusy(false);}
  }
  return <div className="followups">
    <div className="followups-overview">
      <div className="followup-kpi"><Clock3 size={19}/><div><strong>{pendingCount}</strong><span>Seguimientos pendientes</span></div></div>
      <div className="followup-kpi"><CalendarDays size={19}/><div><strong>{overdueCount}</strong><span>Seguimientos vencidos</span></div></div>
      <button className="primary-button" disabled={!contacts.length} onClick={() => { setContactId(contacts[0]?.id || ""); setShowForm(!showForm); }}> <Plus size={16}/> Programar seguimiento</button>
    </div>
    {error && <div role="alert" className="auth-error">{error}</div>}
    {notice && <div role="status" className="notice"><CheckCircle2 size={16}/>{notice}</div>}
    {showForm && <form className="followup-form" onSubmit={(e) => void create(e)}>
      <label>Cliente<select required aria-label="Cliente para seguimiento" value={contactId} onChange={(e) => setContactId(e.target.value)}>{contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Fecha y hora<input required aria-label="Fecha de seguimiento" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)}/></label>
      <label className="followup-description">Acción a realizar<input required minLength={3} maxLength={400} aria-label="Acción del seguimiento" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Llamar y confirmar interés en celular Ulefone"/></label>
      <button disabled={busy} className="primary-button" type="submit">{busy ? "Guardando…" : "Guardar seguimiento"}</button>
    </form>}
    <div className="followup-board">
      <div className="followup-toolbar"><div><h2>Agenda comercial</h2><p>Seguimiento interno de clientes, sin mensajes automáticos.</p></div><div className="followup-filters"><button className={view === "pending" ? "selected" : ""} onClick={() => setView("pending")}>Pendientes</button><button className={view === "completed" ? "selected" : ""} onClick={() => setView("completed")}>Completados</button><button className={view==="cancelled"?"selected":""} onClick={()=>setView("cancelled")}>Cancelados</button></div></div>
      {!sorted.length && <div className="empty-records"><Users size={22}/><p>{view === "pending" ? "No hay seguimientos pendientes." : view === "completed" ? "No hay seguimientos completados todavía." : "No hay seguimientos cancelados."}</p>{!contacts.length && <p>Primero crea un cliente.</p>}</div>}
      <div className="followup-list">{sorted.map((task) => <article key={task.id} className="followup-item"><div className={"followup-status " + (task.status === "completed" ? "done" : "")}><CalendarDays size={20}/></div><div className="followup-details"><strong>{task.description}</strong><span>{contactName(task.contactId)}</span><small>{new Date(task.dueAt).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" })}</small></div>{task.status === "pending" && <button className="secondary-button" disabled={busy} onClick={() => void complete(task.id)}><CheckCircle2 size={16}/> Completar</button>}{task.status === "pending" && (confirmCancelId===task.id ?
 <span className="followup-confirm-cancel"><span>¿Cancelar?</span><button className="secondary-button" disabled={busy} onClick={()=>void cancel(task.id)}>Confirmar</button><button className="secondary-button" onClick={()=>setConfirmCancelId(null)}>Volver</button></span> :
 <button className="secondary-button" disabled={busy} onClick={()=>setConfirmCancelId(task.id)}><XCircle size={15}/> Cancelar</button>)}
 {task.status === "completed" && <span className="tiny-pill">Completado</span>}
 {task.status === "cancelled" && <span className="tiny-pill">Cancelado</span>}</article>)}</div>
    </div>
  </div>;
}
