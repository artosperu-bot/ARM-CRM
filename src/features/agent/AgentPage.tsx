import { useState } from "react";
import { Bot,Search,ShieldCheck } from "lucide-react";
import { detectBuyerIntent } from "../../agent";
import type { Product } from "../../types";
export default function AgentPage({products}:{products:Product[]}) {
  const [query,setQuery]=useState("");const [submitted,setSubmitted]=useState("");const results=submitted?products.filter(p=>(p.title+" "+p.brand+" "+p.partnumber).toLocaleLowerCase("es").split(/\s+/).some(token=>token.length>3&&submitted.toLocaleLowerCase("es").includes(token))):[];
  return <div className="agent-layout"><section className="panel"><div className="panel-head"><div><h2>Asistente comercial · laboratorio de clasificación</h2><p>Consulta datos reales del catálogo. Este módulo aún no envía respuestas ni utiliza un modelo LLM.</p></div><span className="tiny-pill orange">Sin LLM conectado</span></div>
  <form onSubmit={e=>{e.preventDefault();setSubmitted(query.trim());}} className="agent-box"><label htmlFor="agent-question">Consulta del comprador</label><textarea id="agent-question" rows={4} value={query} onChange={e=>setQuery(e.target.value)} maxLength={2000} placeholder="Ej.: Busco un Ulefone Armor 22 para el trabajo"/><button className="primary-button" type="submit" disabled={!query.trim()}><Search size={16}/> Buscar en catálogo</button></form>
  {submitted&&<div className="preview" style={{marginTop:15}}><strong>Intención detectada: {detectBuyerIntent(submitted)}</strong><p>{results.length?results.map(p=>p.title+" · "+p.partnumber).join("; "):"No se encontró una coincidencia textual clara con el catálogo. Requiere búsqueda ampliada y validación humana."}</p><small>No se han verificado precios, stock ni especificaciones técnicas por ERP.</small></div>}
  </section><section className="panel checklist"><h2>Seguridad del agente comercial</h2><div><ShieldCheck size={17}/> Solo datos verificados</div><div><ShieldCheck size={17}/> Sin envíos sin autorización</div><div><ShieldCheck size={17}/> Historial y consentimiento antes de automatizar</div><div><Bot size={17}/> Integración LLM y herramientas: pendiente</div></section></div>;
}
