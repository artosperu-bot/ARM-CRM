import { ArrowRight, CalendarClock, MessageSquare, Package, TrendingUp, Users } from "lucide-react";
import type { Contact, Deal, Followup, Product, Section } from "../../types";
export default function DashboardPage({contacts,deals,followups,products,onNavigate}:{contacts:Contact[];deals:Deal[];followups:Followup[];products:Product[];onNavigate:(s:Section)=>void}) {
  const pending=followups.filter(t=>t.status==="pending");
  const overdue=pending.filter(t=>new Date(t.dueAt).getTime()<Date.now());
  const metrics=[
    {label:"Clientes registrados",num:contacts.length,icon:Users,detail:"En el CRM"},
    {label:"Oportunidades activas",num:deals.filter(d=>d.stage!=="ganado").length,icon:TrendingUp,detail:"Pipeline comercial"},
    {label:"Seguimientos pendientes",num:pending.length,icon:CalendarClock,detail:overdue.length+" vencidos"},
    {label:"Productos del catálogo",num:products.length,icon:Package,detail:"Datos del catálogo real"},
  ];
  return <><div className="stat-grid">{metrics.map(m=><div className="stat" key={m.label}><div className="stat-top"><span>{m.label}</span><span className="stat-icon"><m.icon/></span></div><strong>{m.num}</strong><small>{m.detail}</small></div>)}</div>
  <div className="dashboard-layout">
    <section className="panel"><div className="panel-head"><div><h2>Embudo de ventas</h2><p>Situación de las oportunidades registradas</p></div><button className="text-button" onClick={()=>onNavigate("oportunidades")}>Ver pipeline <ArrowRight size={16}/></button></div>
    <div className="funnel-list">{([{id:"nuevo",label:"Nuevo",color:"#7ddcff"},{id:"interesado",label:"Interesado",color:"#bca7fb"},{id:"cotizado",label:"Cotizado",color:"#f4c577"},{id:"negociacion",label:"Negociación",color:"#f4a57e"},{id:"ganado",label:"Ganado",color:"#79e6b2"}] as const).map(s=>{const count=deals.filter(d=>d.stage===s.id).length;return <div className="funnel-row" key={s.id}><i className="status-dot" style={{backgroundColor:s.color}}/><span>{s.label}</span><div className="bar"><div style={{width:deals.length ? (count / deals.length * 100).toFixed(1) + "%" : "0%",backgroundColor:s.color}}/></div><strong>{count}</strong></div>})}</div></section>
    <section className="panel"><div className="panel-head"><div><h2>Próximos seguimientos</h2><p>Agenda real del equipo comercial</p></div><button className="text-button" onClick={()=>onNavigate("seguimientos")}>Ver agenda <ArrowRight size={16}/></button></div>{pending.slice(0,5).map(t=><div className="activity" key={t.id}><span className="person-avatar"><CalendarClock size={15}/></span><span><strong>{t.description}</strong><small>{contacts.find(c=>c.id===t.contactId)?.name||"Cliente"} · {new Date(t.dueAt).toLocaleString("es-PE")}</small></span></div>)}{!pending.length&&<div className="empty-records">No hay seguimientos pendientes.</div>}</section>
  </div><div className="info-strip"><MessageSquare size={18}/><div><strong>Mensajería automática desactivada</strong><span>WhatsApp permite respuestas manuales del asesor asignado únicamente a números piloto autorizados. El CRM no inicia conversaciones ni envía seguimientos automáticos.</span></div></div></>;
}
