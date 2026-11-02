import { useMemo, useState } from "react";
import AuthPanel from "./features/auth/AuthPanel";
import WorkspaceSetup from "./features/crm/WorkspaceSetup";
import { CrmDataNotice } from "./features/crm/CrmDataNotice";
import { useCrmWorkspace } from "./features/crm/useCrmWorkspace";
import { isSupabaseConfigured } from "./lib/supabase";
import { Activity, ArrowLeft, ArrowRight, Bot, Check, ChevronRight, CircleHelp, ContactRound, Database, Inbox, Kanban, LayoutDashboard, LogOut, MessageSquare, Package, PlugZap, Plus, Search, Send, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { createSafeDraft, detectBuyerIntent } from "./agent";
import { sampleContacts, sampleDeals, sampleInbox, sampleProducts } from "./demo";
import { STAGES } from "./types";
import type { Channel, Contact, Deal, DealStage, Section } from "./types";

const tabs: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "resumen", label: "Resumen", icon: LayoutDashboard },
  { id: "oportunidades", label: "Pipeline comercial", icon: Kanban },
  { id: "clientes", label: "Clientes", icon: ContactRound },
  { id: "mensajes", label: "Bandeja de entrada", icon: Inbox },
  { id: "catalogo", label: "Catálogo", icon: Package },
  { id: "agente", label: "Agente de IA", icon: Bot },
  { id: "integraciones", label: "Integraciones", icon: PlugZap },
];
const channelText: Record<Channel, string> = { whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook", web: "Web" };
const stageOrder: DealStage[] = ["nuevo", "interesado", "cotizado", "negociacion", "ganado"];
function initials(name: string) { return name.split(" ").slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase(); }
function matchSearch(text: string, query: string) { return text.toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es")); }

export default function App() {
  const [section, setSection] = useState<Section>("resumen");
  const [query, setQuery] = useState("");
  const [dataMode, setDataMode] = useState<"demo" | "live">(isSupabaseConfigured ? "live" : "demo");
  const live = isSupabaseConfigured && dataMode === "live";
  const crm = useCrmWorkspace(live);
  const [demoContacts, setDemoContacts] = useState<Contact[]>(sampleContacts);
  const [demoDeals, setDemoDeals] = useState<Deal[]>(sampleDeals);
  const contacts = live ? crm.contacts : demoContacts;
  const deals = live ? crm.deals : demoDeals;
  const products = live ? crm.products : sampleProducts;
  const [newContactInterest, setNewContactInterest] = useState("");
  const [newDealName, setNewDealName] = useState("");
  const [newDealContact, setNewDealContact] = useState("");
  const [showDealForm, setShowDealForm] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(sampleInbox[0].id);
  const [draftText, setDraftText] = useState("");
  const [newContact, setNewContact] = useState("");
  const [notice, setNotice] = useState("");
  const [showContactForm, setShowContactForm] = useState(false);

  const contactById = (id: string) => contacts.find((c) => c.id === id);
  const currentThread = sampleInbox.find((thread) => thread.id === selectedMessage) || sampleInbox[0];
  const currentContact = contactById(currentThread.contactId);
  const filteredContacts = useMemo(() => contacts.filter((c) => matchSearch(c.name + " " + c.interest, query)), [contacts, query]);
  const filteredDeals = useMemo(() => deals.filter((d) => matchSearch(d.title + " " + (contacts.find((c) => c.id === d.contactId)?.name || ""), query)), [deals, contacts, query]);

  function moveDeal(id: string, direction: -1 | 1) {
    const deal = deals.find((item) => item.id === id);
    if (!deal) return;
    const index = stageOrder.indexOf(deal.stage) + direction;
    if (index < 0 || index >= stageOrder.length) return;
    if (live) {
      void crm.updateDealStage(id, stageOrder[index])
        .then(() => setNotice("Etapa actualizada en Supabase."))
        .catch((cause: unknown) => setNotice("Error: " + (cause instanceof Error ? cause.message : "No se pudo actualizar.")));
    } else {
      setDemoDeals((old) => old.map((item) => item.id === id ? { ...item, stage: stageOrder[index] } : item));
      setNotice("Etapa cambiada solo en la demostración.");
    }
  }

  function addContact() {
    const name = newContact.trim();
    if (name.length < 2) return;
    if (live) {
      void crm.createContact(name, newContactInterest).then(() => {
        setNewContact(""); setNewContactInterest(""); setShowContactForm(false);
        setNotice("Cliente guardado en Supabase.");
      }).catch((cause: unknown) => setNotice("Error: " + (cause instanceof Error ? cause.message : "No se pudo crear el cliente.")));
    } else {
      const id = "demo-" + Date.now().toString();
      setDemoContacts((all) => [{ id, name, phone: "Sin registrar", source: "web", interest: newContactInterest || "Pendiente de calificación", createdAt: "Ahora (demo)" }, ...all]);
      setNewContact(""); setNewContactInterest(""); setShowContactForm(false);
      setNotice("Cliente de prueba añadido. No se envió a Supabase.");
    }
  }

  function addDeal() {
    if (!contacts.length) { setNotice("Primero registra un cliente."); return; }
    if (live) {
      if (!showDealForm) { setNewDealContact(contacts[0].id); setShowDealForm(true); return; }
      const selected = newDealContact || contacts[0].id;
      if (newDealName.trim().length < 2) { setNotice("Introduce el producto o asunto de la oportunidad."); return; }
      void crm.createDeal(selected, newDealName).then(() => {
        setNewDealName(""); setShowDealForm(false); setNotice("Oportunidad guardada en Supabase.");
      }).catch((cause: unknown) => setNotice("Error: " + (cause instanceof Error ? cause.message : "No se pudo crear la oportunidad.")));
    } else {
      setDemoDeals((all) => [{ id: "deal-" + Date.now().toString(), contactId: contacts[0].id, title: "Oportunidad de prueba", stage: "nuevo", amount: null, channel: contacts[0].source, lastActivity: "Ahora (demo)" }, ...all]);
      setNotice("Oportunidad de prueba creada. No se guardó en producción.");
    }
  }

  function choose(sectionId: Section) { setSection(sectionId); setQuery(""); setNotice(""); }

  if (live && crm.status === "checking") return <div className="loading-screen"><span className="loading-spin"/><strong>Conectando con STECH CRM…</strong><small>Validando sesión y permisos</small></div>;
  if (live && crm.status === "signed-out") return <AuthPanel onDemo={() => setDataMode("demo")}/>;
  if (live && crm.status === "no-workspace") return <WorkspaceSetup onCreate={crm.createWorkspace} onDemo={() => setDataMode("demo")} onExit={crm.signOut}/>;
  if (live && crm.status === "error") return <div className="loading-screen error-screen"><ShieldCheck size={30}/><h2>No fue posible cargar el CRM</h2><p>{crm.error}</p><button className="primary-button" onClick={() => void crm.refresh()}>Volver a intentar</button><button className="secondary-button" onClick={() => setDataMode("demo")}>Abrir demostración</button></div>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon">S</div><div><strong>STECH</strong><small>ARM / CRM</small></div></div>
      <div className="nav-label">ESPACIO COMERCIAL</div>
      <nav className="nav-list">{tabs.map((tab) => {
        const Icon = tab.icon;
        return <button key={tab.id} type="button" className={"nav-link " + (section === tab.id ? "active" : "")} onClick={() => choose(tab.id)}><Icon size={18}/><span>{tab.label}</span>{section === tab.id && <ChevronRight size={16}/>}</button>;
      })}</nav>
      <div className="sidebar-footer"><div className="circle-icon"><ShieldCheck size={17}/></div><div><strong>{live ? "Supabase conectado" : "Modo seguro"}</strong><small>{live ? "Cuenta autenticada" : "Demostración sin envíos"}</small></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumbs">STECH <ChevronRight size={14}/> {tabs.find((t) => t.id === section)?.label}</div><div className="topbar-right"><button className="mode-toggle" onClick={() => setDataMode(live ? "demo" : "live")} disabled={!isSupabaseConfigured}>{live ? "Abrir demo" : isSupabaseConfigured ? "Conectar datos reales" : "Supabase sin configurar"}</button><span className={"demo-chip " + (live ? "live-chip" : "")}><span className="dot"/> {live ? "EN LÍNEA" : "DEMOSTRACIÓN"}</span>{live && <button className="icon-action" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={() => void crm.signOut()}><LogOut size={17}/></button>}<div className="avatar">ST</div></div></header>
      <div className="content">
        <div className="heading"><div><div className="eyebrow"><Sparkles size={15}/> CENTRO COMERCIAL INTELIGENTE</div><h1>{tabs.find((t) => t.id === section)?.label}</h1><p>{section === "resumen" ? "Toda tu operación comercial en un solo lugar." : "Módulo inicial preparado para la integración gradual con los sistemas STECH."}</p></div>
        {(section === "oportunidades" || section === "clientes") && <button className="primary-button" onClick={() => section === "oportunidades" ? addDeal() : setShowContactForm((v) => !v)}><Plus size={17}/>{section === "clientes" ? "Nuevo cliente" : "Nueva oportunidad"}</button>}</div>
        <CrmDataNotice live={live} workspace={crm.workspace?.name}/>
        {notice && <div className="notice" role="status"><Check size={16}/>{notice}<button aria-label="Cerrar aviso" onClick={() => setNotice("")}><X size={14}/></button></div>}
        {section === "resumen" && <>
          <div className="stat-grid">
            <Stat title="Contactos" value={String(contacts.length)} detail="Datos de ejemplo" icon={<Users/>}/>
            <Stat title="Oportunidades activas" value={String(deals.filter((d) => d.stage !== "ganado").length)} detail="Pipeline demo" icon={<Kanban/>}/>
            <Stat title="Mensajes" value={live ? "0" : String(sampleInbox.length)} detail={live ? "Sin canal conectado" : "Conversaciones simuladas"} icon={<MessageSquare/>}/>
            <Stat title="Integraciones activas" value="0" detail="Pendientes de autorización" icon={<PlugZap/>}/>
          </div>
          <div className="dashboard-layout"><section className="panel"><div className="panel-head"><div><h2>Embudo de ventas</h2><p>Vista general de oportunidades de prueba</p></div><button className="text-button" onClick={() => choose("oportunidades")}>Ver pipeline <ArrowRight size={16}/></button></div><div className="funnel-list">{STAGES.map((stage) => { const count = deals.filter((d) => d.stage === stage.id).length; return <div className="funnel-row" key={stage.id}><span className="status-dot" style={{ backgroundColor: stage.accent }}/><span>{stage.title}</span><div className="bar"><div style={{ backgroundColor: stage.accent, width: String(Math.max(6, count / Math.max(1, deals.length) * 100)) + "%" }}/></div><strong>{count}</strong></div>; })}</div></section>
          <section className="panel"><div className="panel-head"><div><h2>Actividad comercial</h2><p>Mensajes para revisar</p></div></div><div className="activity-list">{live && <div className="empty">Aún no hay canales de mensajería conectados. Los mensajes de prueba no se muestran como datos reales.</div>}{!live && sampleInbox.map((thread) => <button className="activity" key={thread.id} onClick={() => { setSelectedMessage(thread.id); choose("mensajes"); }}><span className="person-avatar">{initials(contactById(thread.contactId)?.name || "ST")}</span><span><strong>{contactById(thread.contactId)?.name}</strong><small>{thread.text}</small></span><ChevronRight size={15}/></button>)}</div></section></div>
          <div className="info-strip"><ShieldCheck size={20}/><div><strong>La IA todavía no responde a clientes reales.</strong><span>{live ? "Clientes y oportunidades ya se guardan en Supabase. La mensajería, el stock ERP y el agente LLM siguen deshabilitados." : "No hay stock ni precios reales en este panel. Los cambios de demostración son temporales."}</span></div></div>
        </>}
        {section === "oportunidades" && <><SearchBox value={query} onChange={setQuery} placeholder="Buscar oportunidad o cliente"/>{live && showDealForm && <div className="deal-form"><label>Cliente<select aria-label="Cliente de la oportunidad" value={newDealContact} onChange={(e) => setNewDealContact(e.target.value)}>{contacts.map((ct) => <option key={ct.id} value={ct.id}>{ct.name}</option>)}</select></label><label>Producto o asunto<input aria-label="Producto o asunto" value={newDealName} onChange={(e) => setNewDealName(e.target.value)} placeholder="Ej.: Celular Ulefone Armor" maxLength={200}/></label><button className="primary-button" onClick={addDeal} disabled={newDealName.trim().length < 2}>Guardar oportunidad</button><button className="secondary-button" onClick={() => setShowDealForm(false)}>Cancelar</button></div>}{live && !deals.length && <div className="empty-records">Aún no hay oportunidades. Registra un cliente y crea la primera venta potencial.</div>}<div className="kanban">{STAGES.map((stage, index) => <section key={stage.id} className="kanban-column"><div className="kanban-title"><span className="status-dot" style={{backgroundColor:stage.accent}}/><strong>{stage.title}</strong><span className="count">{filteredDeals.filter((d) => d.stage === stage.id).length}</span></div><div className="kanban-items">{filteredDeals.filter((d) => d.stage === stage.id).map((deal) => <article className="deal-card" key={deal.id}><div className="card-label">{channelText[deal.channel]}</div><h3>{deal.title}</h3><p>{contactById(deal.contactId)?.name || "Cliente"}</p><div className="deal-bottom"><span>Sin cotización validada</span><div className="move-buttons"><button aria-label={"Mover " + deal.title + " a etapa anterior"} disabled={index === 0} onClick={() => moveDeal(deal.id, -1)}><ArrowLeft size={14}/></button><button aria-label={"Mover " + deal.title + " a siguiente etapa"} disabled={index === STAGES.length - 1} onClick={() => moveDeal(deal.id, 1)}><ArrowRight size={14}/></button></div></div></article>)}</div></section>)}</div></>}
        {section === "clientes" && <div className="panel"><div className="panel-head"><div><h2>Directorio de contactos</h2><p>{live ? "Contactos registrados en tu espacio de Supabase." : "Datos simulados; ningún registro corresponde a un cliente real."}</p></div></div><SearchBox value={query} onChange={setQuery} placeholder="Buscar por nombre o interés"/>{showContactForm && <div className="inline-form"><input aria-label="Nombre del cliente" value={newContact} onChange={(e) => setNewContact(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addContact(); }} placeholder={live ? "Nombre del nuevo cliente" : "Nombre del contacto de prueba"}/><input aria-label="Interés del cliente" value={newContactInterest} onChange={(e) => setNewContactInterest(e.target.value)} placeholder="Interés: celular, laptop…" maxLength={300}/><button className="primary-button" onClick={addContact} disabled={newContact.trim().length < 2}>Guardar</button></div>}<div className="contact-list">{filteredContacts.map((contact) => <div className="contact-item" key={contact.id}><span className="person-avatar">{initials(contact.name)}</span><div className="contact-main"><strong>{contact.name}</strong><span>{contact.interest}</span></div><span className="muted">{channelText[contact.source]}</span><span className="tiny-pill">{live ? "CRM" : "Demo"}</span></div>)}{filteredContacts.length === 0 && <div className="empty">No hay coincidencias.</div>}</div></div>}
        {section === "mensajes" && live && <div className="empty-records"><Inbox size={24}/><h2>Bandeja multicanal pendiente</h2><p>Ya tenemos tablas protegidas para mensajes. Aún falta la recepción con webhooks de Meta/Composio y la validación de cuentas. No mostraremos conversaciones simuladas como si fueran reales.</p></div>}
        {section === "mensajes" && !live && <div className="inbox-grid"><section className="panel thread-panel"><div className="panel-head"><div><h2>Conversaciones</h2><p>Ejemplos sin conexión</p></div></div>{sampleInbox.map((thread) => <button key={thread.id} className={"thread " + (selectedMessage === thread.id ? "selected" : "")} onClick={() => { setSelectedMessage(thread.id); setDraftText(""); }}><span className="person-avatar">{initials(contactById(thread.contactId)?.name || "ST")}</span><span><strong>{contactById(thread.contactId)?.name}</strong><small>{thread.text}</small><em>{channelText[thread.channel]}</em></span></button>)}</section><section className="panel conversation-panel"><div className="conversation-header"><div><strong>{currentContact?.name}</strong><small>{channelText[currentThread.channel]} · mensaje ficticio</small></div>{currentThread.needsHuman && <span className="tiny-pill orange">Revisión humana</span>}</div><div className="bubble"><span>{currentThread.text}</span><small>{currentThread.at}</small></div><div className="draft-box"><div className="draft-heading"><Bot size={17}/> Borrador sugerido por IA <span>no enviado</span></div><textarea value={draftText} onChange={(e) => setDraftText(e.target.value)} placeholder="Selecciona 'Generar borrador' para preparar una respuesta segura." rows={4}/><div className="draft-actions"><button className="secondary-button" onClick={() => setDraftText(createSafeDraft(currentThread.text))}><Sparkles size={16}/> Generar borrador</button><button className="primary-button" disabled title="Deshabilitado hasta conectar APIs oficiales y permisos"><Send size={16}/> Envío deshabilitado</button></div></div></section></div>}
        {section === "catalogo" && <div className="panel"><div className="panel-head"><div><h2>Catálogo comercial</h2><p>{live ? "Productos almacenados en Supabase; la sincronización ERP está pendiente." : "Categorías de referencia, no productos importados."}</p></div><span className="tiny-pill orange">ERP pendiente</span></div>{products.length === 0 && <div className="empty-records">Sin productos importados todavía. No se muestran precios ni stock sin validar.</div>}<div className="product-grid">{products.map((product) => <article className="product" key={product.partnumber}><span className="product-icon"><Package size={25}/></span><div><strong>{product.title}</strong><p>{product.brand} · {product.category}</p></div><div className="product-meta"><span>Precio: {live && product.price !== null ? "S/ " + product.price.toFixed(2) + " (sin cotejar ERP)" : "sin verificar"}</span><span>Stock: {live && product.stock !== null ? product.stock + " (sin cotejar ERP)" : "sin verificar"}</span></div></article>)}</div><div className="info-strip"><Database size={20}/><div><strong>Integración prevista con DB_ST / ERP</strong><span>La consulta será de solo lectura por backend seguro, conciliando Part Number, EAN, precio y stock. No se expondrán credenciales SQL al navegador.</span></div></div></div>}
        {section === "agente" && <div className="agent-layout"><section className="panel"><div className="panel-head"><div><h2>Laboratorio del vendedor IA</h2><p>Prueba la clasificación de intención sin usar servicios externos.</p></div><span className="tiny-pill">Motor local</span></div><div className="agent-box"><textarea aria-label="Mensaje de prueba" value={draftText} onChange={(e) => setDraftText(e.target.value)} placeholder="Ejemplo: ¿Tienen stock de un celular Ulefone y cuánto cuesta?" rows={5}/><div className="intent-row"><strong>Intención detectada:</strong><span className="tiny-pill">{draftText.trim() ? detectBuyerIntent(draftText) : "Esperando mensaje"}</span></div><div className="preview"><strong>Borrador propuesto</strong><p>{draftText.trim() ? createSafeDraft(draftText) : "Escribe un mensaje para generar una respuesta orientativa."}</p></div></div></section><section className="panel checklist"><h2>Reglas del agente</h2>{["No inventar stock ni precios","Validar PN y atributos verificables","Registrar intención y siguiente paso","Derivar reclamos a un humano","No publicar ni enviar sin permisos"].map((rule) => <div key={rule}><ShieldCheck size={17}/>{rule}</div>)}</section></div>}
        {section === "integraciones" && <><div className="integration-grid">{[{title:"WhatsApp Business",provider:"Meta Cloud API",desc:"Mensajes entrantes, plantillas y webhooks oficiales."},{title:"Instagram",provider:"Composio / Meta",desc:"DM, comentarios y publicación tras aprobación."},{title:"Facebook Pages",provider:"Composio / Meta",desc:"Inbox de página, comentarios y contenido."},{title:"HERMES",provider:"Conector STECH existente",desc:"Reutilización futura de borradores y Meta Marketing; escritura bloqueada."},{title:"ERP y catálogo",provider:"DB_ST · API read-only",desc:"PN, stock propio, precios y equivalencias verificados."},{title:"n8n",provider:"Automatizaciones",desc:"Recordatorios, notificaciones y seguimiento programado."}].map((item) => <article className="integration" key={item.title}><span className="integration-icon"><PlugZap size={22}/></span><div><h3>{item.title}</h3><small>{item.provider}</small><p>{item.desc}</p></div><span className="tiny-pill orange">Pendiente</span></article>)}</div><div className="info-strip"><CircleHelp size={20}/><div><strong>Las redes todavía no están conectadas a este proyecto.</strong><span>Composio no tiene conexiones activas de Facebook, Instagram ni WhatsApp en esta sesión. No se enviarán mensajes ni publicaciones hasta autorizar cuentas y verificar permisos.</span></div></div></>}
        <footer className="footer"><span>STECH PERU · ARM-CRM v0.2</span><span><Activity size={13}/> {live ? "Datos autenticados · Sin conexiones de mensajería" : "Prototipo local · Datos ficticios"}</span></footer>
      </div>
    </main>
  </div>;
}
function Stat({ title, value, detail, icon }: { title: string; value: string; detail: string; icon: React.ReactNode }) {
  return <div className="stat"><div className="stat-top"><span>{title}</span><span className="stat-icon">{icon}</span></div><strong>{value}</strong><small>{detail}</small></div>;
}
function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="search-box"><Search size={16}/><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}/></label>;
}
