import { useMemo,useState } from "react";
import { Activity,ArrowDown,ArrowUp,CalendarRange,Coins,Database,RefreshCw,Search,ShieldCheck,Zap } from "lucide-react";
import { useAiUsage } from "./useAiUsage";
import { fmtTokens,groupSessions,modelTotals,sumUsage } from "./usage";
import "./usage.css";
const localDate=(s:string)=>new Date(s).toLocaleString("es-PE",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
export default function UsagePage({workspaceId}:{workspaceId:string}){
 const {events,status,error,truncated,refresh}=useAiUsage(workspaceId);
 const [query,setQuery]=useState("");const [model,setModel]=useState("todos");const [selected,setSelected]=useState<string|null>(null);
 const models=useMemo(()=>[...new Set(events.map(e=>e.model))].sort(),[events]);
 const filtered=useMemo(()=>events.filter(e=>(model==="todos"||e.model===model) && (!query || (e.session_id+" "+e.model+" "+(e.message_id||"")).toLowerCase().includes(query.toLowerCase()))),[events,model,query]);
 const totals=useMemo(()=>sumUsage(filtered),[filtered]);
 const sessions=useMemo(()=>groupSessions(filtered),[filtered]);
 const byModel=useMemo(()=>modelTotals(filtered).slice(0,8),[filtered]);
 const selectedEvents=selected?filtered.filter(e=>e.session_id===selected).sort((a,b)=>a.occurred_at.localeCompare(b.occurred_at)):[];
 const maxTokens=Math.max(...byModel.map(e=>e.input+e.output),1);
 const newest=events.reduce((last,e)=>e.occurred_at>last?e.occurred_at:last,"");
 return <div className="usage-page">
   <div className="usage-hero"><div><div className="usage-kicker"><Zap size={17}/> OBSERVABILIDAD DE IA</div><h2>Consumo por conversación</h2><p>Métricas de las nuevas conversaciones del agente de ARM-CRM, desglosadas por modelo y llamada.</p><span className="usage-data-info"><Database size={13}/> Fuente: ARM-CRM · Último registro: {newest?localDate(newest):"sin datos"}</span></div><div className="usage-hero-icon"><Activity size={50}/></div></div>
   <div className="usage-controls"><label className="usage-search"><Search size={17}/><input placeholder="Buscar ID de conversación o modelo" value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="usage-select"><span>Modelo</span><select aria-label="Filtrar modelo" value={model} onChange={e=>setModel(e.target.value)}><option value="todos">Todos los modelos</option>{models.map(m=><option key={m} value={m}>{m}</option>)}</select></label><button className="secondary-button" disabled={status==="loading"} onClick={()=>void refresh()}><RefreshCw size={16}/> Actualizar lectura</button></div>
   {status==="loading"&&<div className="usage-loading">Consultando registros protegidos por RLS…</div>}
   {status==="error"&&<div className="auth-error" role="alert">{error}</div>}
   {truncated&&<div className="auth-error">La consulta superó el límite de 15,000 eventos. Las cifras mostradas son parciales.</div>}
   {status==="ready"&&<><div className="usage-stats">
    <Stat label="Conversaciones" value={fmtTokens(totals.sessions)} icon={<Activity/>} sub="Sesiones únicas"/>
    <Stat label="Tokens de entrada" value={fmtTokens(totals.input)} icon={<ArrowDown/>} sub="Incluye tokens marcados como cacheados"/>
    <Stat label="Tokens de salida" value={fmtTokens(totals.output)} icon={<ArrowUp/>} sub="Generados por el modelo"/>
    <Stat label="Tokens cacheados" value={fmtTokens(totals.cached)} icon={<Zap/>} sub="Subconjunto de entrada, no sumar otra vez"/>
   </div>
   <div className="usage-two-cols">
    <section className="usage-panel"><div className="usage-panel-head"><div><h3>Consumo por modelo</h3><p>Entrada + salida, en tokens</p></div><CalendarRange size={17}/></div>
    <div className="usage-bars">{byModel.map(item=><div className="usage-bar-row" key={item.model}><div className="usage-model-head"><strong title={item.model}>{item.model}</strong><span>{fmtTokens(item.input+item.output)}</span></div><div className="usage-bar-track"><div style={{width:(item.input+item.output)/maxTokens*100+"%"}}/></div><small>{item.calls} eventos · {fmtTokens(item.input)} entrada · {fmtTokens(item.output)} salida</small></div>)}{byModel.length===0&&<p className="usage-muted">Todavía no hay llamadas del agente registradas.</p>}</div></section>
    <section className="usage-panel"><div className="usage-panel-head"><div><h3>Costos de la IA</h3><p>Separación entre medición y estimación</p></div><Coins size={18}/></div>
    <div className="usage-cost"><span>{totals.costKnownCalls===0?"No registrado":"USD "+totals.measuredCost.toFixed(4)}</span><p>{totals.costKnownCalls===0?"Todavía no se han registrado costos de uso del agente ARM-CRM. Cuando estén disponibles se mostrarán como importes medidos, no inventados.":totals.costKnownCalls+" eventos tienen datos de costo; no se incluyen eventos sin costo registrado."}</p></div>
    <div className="usage-note"><ShieldCheck size={18}/><span>Solo se mostrarán métricas generadas por el nuevo agente ARM-CRM. No se importarán conversaciones antiguas.</span></div></section>
   </div>
   <section className="usage-panel"><div className="usage-panel-head"><div><h3>Conversaciones</h3><p>Selecciona una fila para ver el detalle por llamada, modelo y nodo.</p></div><span className="usage-pill">{sessions.length} conversaciones</span></div>
    <div className="usage-table-scroll"><table className="usage-table"><thead><tr><th>Conversación</th><th>Última actividad</th><th>Eventos</th><th>Entrada</th><th>Salida</th><th>Cacheados</th><th>Costo (USD)</th></tr></thead><tbody>{sessions.map(s=><tr className={selected===s.sessionId?"usage-selected":""} key={s.sessionId} onClick={()=>setSelected(selected===s.sessionId?null:s.sessionId)} tabIndex={0} onKeyDown={e=>{if(e.key==="Enter")setSelected(s.sessionId)}}><td><strong title={s.sessionId}>{s.sessionId.length>30?s.sessionId.slice(0,30)+"…":s.sessionId}</strong><small>{s.models.length} modelo(s)</small></td><td>{localDate(s.lastSeen)}</td><td>{fmtTokens(s.calls)}</td><td>{fmtTokens(s.input)}</td><td>{fmtTokens(s.output)}</td><td>{fmtTokens(s.cached)}</td><td>{s.costKnownCalls===0?"No registrado":"USD "+s.measuredCost.toFixed(4)+(s.costKnownCalls<s.calls?" *":"")}</td></tr>)}{sessions.length===0&&<tr><td colSpan={7}>No hay conversaciones nuevas registradas todavía.</td></tr>}</tbody></table></div>
   </section>
   {selected&&selectedEvents.length>0&&<section className="usage-panel"><div className="usage-panel-head"><div><h3>Detalle de la conversación</h3><p title={selected}>{selected}</p></div><button className="secondary-button" onClick={()=>setSelected(null)}>Cerrar detalle</button></div><div className="usage-table-scroll"><table className="usage-table"><thead><tr><th>Fecha</th><th>Modelo</th><th>Nodo</th><th>Entrada</th><th>Salida</th><th>Cacheados</th></tr></thead><tbody>{selectedEvents.map(e=><tr key={e.id}><td>{localDate(e.occurred_at)}</td><td>{e.model}</td><td>{e.node||"—"}</td><td>{fmtTokens(e.input_tokens)}</td><td>{fmtTokens(e.output_tokens)}</td><td>{fmtTokens(e.cached_input_tokens)}</td></tr>)}</tbody></table></div></section>}
   </>}
 </div>;
}
function Stat({label,value,icon,sub}:{label:string;value:string;icon:React.ReactNode;sub:string}){return <article className="usage-stat"><div className="usage-stat-head">{label}<span>{icon}</span></div><strong>{value}</strong><small>{sub}</small></article>}
