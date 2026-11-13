import {useCallback,useEffect,useState} from "react";
import {Bot,CheckCircle2,Coins,MessageCircle,Plus,Send,ShieldCheck,RefreshCw,Zap,CalendarClock,UserRoundCheck} from "lucide-react";
import type {Contact,Section} from "../../types";
import {detectCommercialSignal} from "./salesSignals";
import {parseAgentPhotoMessage} from "./photoMessage";
import {supabase} from "../../lib/supabase";
import "./agent.css";

type Conversation={id:string;title:string;created_at:string};
type TestOffer={partnumber:string;price_pen:number;stock_status:string;stock_units_demo:number|null};
type Turn={id:string;role:"user"|"assistant";content:string;created_at:string};
type Usage={model:string;inputTokens:number;outputTokens:number;cachedTokens:number;estimatedUsd:number;usageRecorded:boolean};
type DemoEstimate={testOnly:true;partnumber:string;quantity:number;unitPricePen:number;totalPen:number;status:"disponible"|"no disponible"|"por confirmar"};
type DraftLine={partnumber:string;quantity:number;title:string|null;inCurrentCatalog:boolean};
type DemoBasket={testOnly:true;lines:Array<DraftLine & {unitPricePen:number|null;subtotalPen:number|null;availability:"disponible"|"no disponible"|"por confirmar"}>;totalPen:number|null;allPriced:boolean;allAvailable:boolean;ambiguousQuantity:boolean};
type CommercialReadiness={draftLines:DraftLine[];demoBasket:DemoBasket|null;state:"requiere_validacion";intent:string;product:{partnumber:string;title:string}|null;quantity:number|null;budget:{pen:number;scope:string}|null;priceEvidence:boolean;saleableStock:boolean;demoEstimate:DemoEstimate|null;blockers:string[];quoteCreated:false;orderCreated:false;paymentRegistered:false;advisorAssigned:false;canManuallyCreateOpportunity:boolean;nextAction:string};
const blockerLabels:Record<string,string>={modelo_por_confirmar:"modelo exacto",cantidad_por_confirmar:"cantidad",precio_vigente_por_confirmar:"precio vigente",disponibilidad_vendible_por_confirmar:"disponibilidad para venta",condiciones_cotizacion_por_confirmar:"condiciones de cotización"};
export default function AgentPage({workspaceId,contacts,onNavigate,onCreateFollowup,onCreateDeal}:{
 workspaceId:string;contacts:Contact[];onNavigate:(section:Section)=>void;
 onCreateFollowup:(contactId:string,description:string,dueAt:string)=>Promise<void>;
 onCreateDeal:(contactId:string,title:string)=>Promise<void>;
}){
 const [conversations,setConversations]=useState<Conversation[]>([]);
 const [selected,setSelected]=useState<string|null>(null);
 const [turns,setTurns]=useState<Turn[]>([]);
 const [question,setQuestion]=useState("");
 const [sending,setSending]=useState(false);
 const [simulated,setSimulated]=useState(true); // Private ARM-CRM pilot defaults to clearly labeled sandbox figures.
 const [testOffers,setTestOffers]=useState<TestOffer[]>([]);
 const [offersLoading,setOffersLoading]=useState(false);
 const [offersError,setOffersError]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [usage,setUsage]=useState<Usage|null>(null);
 const [commercial,setCommercial]=useState<CommercialReadiness|null>(null);
 const [ready,setReady]=useState(false);
 const [loading,setLoading]=useState(true);
 const [actionOpen,setActionOpen]=useState(false);
 const [linkedContact,setLinkedContact]=useState("");
 const [dueAt,setDueAt]=useState("");
 const [task,setTask]=useState("");
 const [approved,setApproved]=useState(false);
 const [savingAction,setSavingAction]=useState(false);
 const customers=turns.filter(t=>t.role==="user").map(t=>t.content);
 const signal=customers.length>0?detectCommercialSignal(customers):null;
 const lastQuestion=customers.at(-1)||"";
 const buyerAskedAmount=/(?:precio|cu[aá]nto|total|cotiz|presupuesto|sale|cuestan|pagar|importe|sum[aa])/i.test(lastQuestion);
 async function createTask(e:React.FormEvent){
  e.preventDefault();setError("");setNotice("");
  if(simulated||signal?.key==="ended"){setError("No se puede registrar: la conversación es de prueba o el comprador desistió.");return;}
  if(!approved){setError("Confirma que existe autorización para el seguimiento.");return;}
  if(!linkedContact){setError("Selecciona un cliente registrado.");return;}
  if(!dueAt||Number.isNaN(Date.parse(dueAt))||new Date(dueAt).getTime()<=Date.now()){
    setError("Elige una fecha y hora futura para el seguimiento.");return;
  }
  setSavingAction(true);
  try{
   await onCreateFollowup(linkedContact,task.trim(),new Date(dueAt).toISOString());
   setNotice("Seguimiento guardado en ARM-CRM. No se envió ningún mensaje.");
   setActionOpen(false);setApproved(false);
  }catch(cause){setError(cause instanceof Error?cause.message:"No se pudo registrar el seguimiento.");}
  finally{setSavingAction(false);}
 }
 async function createOpportunity(){
  if(simulated||signal?.key==="ended"){setError("No se puede crear una oportunidad: la conversación es de prueba o el comprador desistió.");return;}
  if(!linkedContact){setError("Selecciona un cliente antes de crear la oportunidad.");return;}
  setSavingAction(true);setError("");setNotice("");
  try{
   await onCreateDeal(linkedContact,("Interés desde agente: "+lastQuestion.slice(0,130)).slice(0,190));
   setNotice("Oportunidad creada en Pipeline. Revisa y confirma el precio antes de cotizar.");
  }catch(cause){setError(cause instanceof Error?cause.message:"No se pudo crear la oportunidad.");}
  finally{setSavingAction(false);}
 }

 const refresh=useCallback(async()=>{
  if(!supabase)return;
  const {data,error:readErr}=await supabase.from("arm_agent_conversations").select("id,title,created_at")
    .eq("workspace_id",workspaceId).order("created_at",{ascending:false}).limit(50);
  if(readErr)setError(readErr.message);
  else setConversations((data||[]) as Conversation[]);
  setLoading(false);
 },[workspaceId]);
 useEffect(()=>{
  if(!simulated||!supabase){setTestOffers([]);setOffersError("");return;}
  let active=true;setOffersLoading(true);setOffersError("");
  void supabase.from("arm_offer_simulations")
    .select("partnumber,price_pen,stock_status,stock_units_demo")
    .eq("workspace_id",workspaceId).eq("is_test_data",true).order("partnumber")
    .then(({data,error:readError})=>{
      if(!active)return;
      if(readError)setOffersError("No se pudieron consultar las ofertas simuladas en Supabase.");
      else setTestOffers((data||[]) as TestOffer[]);
      setOffersLoading(false);
    });
  return()=>{active=false;};
 },[workspaceId,simulated]);
 useEffect(()=>{void refresh();void fetch("http://127.0.0.1:8789/health")
  .then(r=>r.json()).then(d=>setReady(d.ok===true)).catch(()=>setReady(false));},[refresh]);
 useEffect(()=>{
  if(!supabase||!selected){setTurns([]);return;}
  let active=true;setLoading(true);
  void supabase.from("arm_agent_turns").select("id,role,content,created_at")
   .eq("workspace_id",workspaceId).eq("conversation_id",selected)
   .order("created_at",{ascending:true}).limit(100)
   .then(({data,error:readErr})=>{
    if(!active)return;
    if(readErr)setError(readErr.message);else setTurns((data||[]) as Turn[]);
    setLoading(false);
   });
  return ()=>{active=false;};
 },[workspaceId,selected]);

 async function submit(e:React.FormEvent){
  e.preventDefault();
  const msg=question.trim();
  if(!supabase||!msg||sending)return;
  setSending(true);setError("");setNotice("");setUsage(null);
  try{
   const {data:{session},error:sessionError}=await supabase.auth.getSession();
   if(sessionError||!session?.access_token)throw new Error("La sesión expiró. Vuelve a iniciar sesión.");
   const response=await fetch("http://127.0.0.1:8789/chat",{
    method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+session.access_token},
    body:JSON.stringify({workspaceId,conversationId:selected,message:msg,simulated})
   });
   const result=await response.json();
   if(!response.ok||!result.ok)throw new Error(result.error||"No fue posible consultar OpenAI.");
   setQuestion("");setSelected(result.conversationId);
   setUsage(result.usage||null);
   setCommercial(result.commercial||null);
   setActionOpen(false);setLinkedContact("");setApproved(false);setDueAt("");
   setNotice(result.photo?"Foto oficial del fabricante · sin envío a clientes.":result.usage?"Respuesta real de OpenAI · sin envío al cliente.": "Consulta de catálogo · sin envío al cliente.");
   const {data,error:turnError}=await supabase.from("arm_agent_turns").select("id,role,content,created_at")
    .eq("workspace_id",workspaceId).eq("conversation_id",result.conversationId)
    .order("created_at",{ascending:true}).limit(100);
   if(!turnError)setTurns((data||[]) as Turn[]);
   await refresh();
  }catch(cause){setError(cause instanceof Error?cause.message:"Error de conexión.");}
  finally{setSending(false);}
 }
 return <div className="arm-agent">
   <section className="agent-heading"><div className="agent-heading-logo"><Bot size={26}/></div><div><h2>Agente vendedor STECH</h2><p>OpenAI GPT-5.4 Mini · Chat privado · Sin herramientas de pago adicionales</p></div>
     <span className={"agent-state "+(ready?"good":"waiting")}>{ready?"Servicio OpenAI configurado":"Servicio local no disponible"}</span>
   </section>
   <div className="agent-stat-strip"><span><ShieldCheck size={16}/> Supervisado: no responde en redes</span><span><Zap size={16}/> Máximo 450 tokens de salida</span><span><Coins size={16}/> Hasta 20 consultas/día</span></div>
   <label className={"agent-sandbox-switch "+(simulated?"is-on":"")}>
     <input type="checkbox" checked={simulated} disabled={sending} onChange={e=>{setSimulated(e.target.checked);setSelected(null);setTurns([]);setUsage(null);setCommercial(null);setActionOpen(false);setLinkedContact("");setError("");setNotice("");}}/>
     <span><strong>Simular precios y disponibilidad</strong><small>Solo laboratorio privado: cifras inventadas, etiquetadas como prueba. No se mezclan con ventas reales ni se agendan tareas.</small></span>
     {simulated&&<strong className="agent-sandbox-badge">SIMULACIÓN</strong>}
   </label>
   {simulated&&<section className="agent-db-test-offers" aria-label="Ofertas ficticias desde Supabase">
    <strong>Precios de prueba leídos desde Supabase</strong>
    {offersLoading?<span>Cargando ofertas…</span>:offersError?<span role="alert">{offersError}</span>:
     testOffers.length===0?<span>No hay ofertas ficticias registradas en este espacio.</span>:
     <div className="agent-db-test-grid">{testOffers.map(offer=><div key={offer.partnumber}>
      <strong>{offer.partnumber}</strong><span>S/ {Number(offer.price_pen).toFixed(2)}</span><small>{offer.stock_status} · {offer.stock_units_demo===null?"sin cantidad supuesta":`${offer.stock_units_demo} unidades supuestas`}</small>
     </div>)}</div>}
    <small>Solo para pruebas internas. El agente nunca debe publicar estas cifras en WhatsApp ni en modo real.</small>
   </section>}
   <div className="agent-layout-real">
    <aside className="agent-sessions"><div className="agent-side-head"><strong>Conversaciones</strong><button aria-label="Nueva conversación" title="Nueva conversación" onClick={()=>{setSelected(null);setTurns([]);setUsage(null);setCommercial(null);setActionOpen(false);setLinkedContact("");setError("");setNotice("");}}><Plus size={17}/></button></div>
     {conversations.length===0&&<p className="agent-empty-sessions">Aún no hay conversaciones.</p>}
     {conversations.map(c=><button key={c.id} className={"agent-session "+(selected===c.id?"selected":"")} onClick={()=>{setSelected(c.id);setError("");setUsage(null);setCommercial(null);setActionOpen(false);setLinkedContact("");}}><MessageCircle size={16}/><span>{c.title}</span></button>)}
    </aside>
    <div className="agent-conversation">
      <div className="agent-messages">
      {!turns.length&&!loading&&<div className="agent-welcome"><div><Bot size={32}/></div><h3>Tu asesor comercial inteligente</h3><p>Consulta productos, pide una foto del modelo o prueba la atención comercial. ALEX solo comparte información verificada.</p></div>}
      {loading&&<div className="agent-wait">Cargando conversación…</div>}
      {turns.map(t=>{
       const media=t.role==="assistant"?parseAgentPhotoMessage(t.content):{body:t.content,photoUrl:null};
       return <div key={t.id} className={"agent-bubble "+t.role}>
        <span>{t.role==="assistant"?"Agente STECH":"Tú"}</span>
        <p>{media.body}</p>
        {media.photoUrl&&<figure className="agent-product-photo">
         <img src={media.photoUrl} alt={"Imagen verificada: "+media.body} loading="lazy"/>
         <figcaption>Foto referencial del fabricante · el color puede variar</figcaption>
        </figure>}
       </div>;
      })}
      {sending&&<div className="agent-wait"><RefreshCw size={15}/> Consultando catálogo y asesor…</div>}
      </div>
      {signal&&<div className={"agent-commercial-signal "+(signal.priority==="high"?"hot":"")}>
       <div className="agent-signal-text"><strong>{signal.label}</strong><span>{signal.nextAction}</span>
        {signal.handoff&&<small><UserRoundCheck size={13}/> Revisión de asesor recomendada; aún no se ha asignado.</small>}</div>
       {signal.followupSuggested&&!simulated&&<button className="secondary-button" onClick={()=>{
        setActionOpen(v=>!v);
        setLinkedContact("");
        setTask(("Retomar solicitud: "+lastQuestion).slice(0,390));
        setDueAt("");setApproved(false);
       }}><CalendarClock size={15}/> Gestionar en CRM</button>}
      </div>}
      {commercial&&<div className="agent-readiness" role="status">
       <strong>{signal?.key==="ended"?"El cliente decidió no continuar · ninguna gestión pendiente":"Estado comercial de esta consulta · sin operación registrada"}</strong>
       <div>{commercial.draftLines.length>1?<span><b>Productos:</b> {commercial.draftLines.length} referencias solicitadas</span>:<><span><b>Producto:</b> {commercial.product?.title||"Por identificar"}</span><span><b>Cantidad:</b> {commercial.quantity??"Por confirmar"}</span></>}{commercial.budget&&<span><b>Presupuesto del cliente:</b> S/ {commercial.budget.pen} ({commercial.budget.scope==="total"?"total":commercial.budget.scope==="por_unidad"?"por unidad":"sin aclarar"})</span>}</div>
       {commercial.draftLines.length>0&&signal?.key!=="ended"&&<div className="agent-draft-lines"><strong>Productos de interés · no es un pedido</strong>{commercial.draftLines.map(line=><span key={line.partnumber}>{line.quantity} × {line.title||line.partnumber}{!line.inCurrentCatalog?" · referencia por revalidar":""}</span>)}</div>}
       {signal?.key==="ended"?<small>Respetar su decisión. No solicitar datos, registrar seguimientos ni insistir en comprar.</small>:
       simulated?<small>Laboratorio privado. No hay cotización, pedido, reserva real, pago ni asesor asignado.</small>:
       <small><b>Pendiente:</b> {commercial.blockers.map(x=>blockerLabels[x]||x).join(" · ")}. No hay cotización, pedido, pago ni asesor asignado.</small>}
       {simulated&&commercial.demoBasket&&commercial.demoBasket.lines.length>1&&buyerAskedAmount&&signal?.key!=="ended"&&<div className="agent-sandbox-quote-preview">
        <strong>Cálculo multítem de prueba · no es cotización</strong>
        {commercial.demoBasket.lines.map(line=><span key={line.partnumber}>{line.quantity} × {line.title||line.partnumber}: {line.subtotalPen===null?"precio por confirmar":"S/ "+line.subtotalPen.toFixed(2)} · {line.availability}</span>)}
        <span><b>{commercial.demoBasket.totalPen===null?"Total pendiente: falta al menos un precio":"Total referencial: S/ "+commercial.demoBasket.totalPen.toFixed(2)}</b></span>
        <small>{commercial.demoBasket.allAvailable?"Las cantidades figuran disponibles solo en el piloto.":"Una o más cantidades no están disponibles o requieren verificación."} No se creó cotización, reserva, pedido ni pago.</small>
       </div>}
       {simulated&&commercial.demoEstimate&&(!commercial.demoBasket||commercial.demoBasket.lines.length<=1)&&buyerAskedAmount&&signal?.key!=="ended"&&<div className="agent-sandbox-quote-preview">
        <strong>Estimación matemática de prueba (no es una cotización)</strong>
        <span>{commercial.demoEstimate.quantity} × S/ {commercial.demoEstimate.unitPricePen.toFixed(2)} = <b>S/ {commercial.demoEstimate.totalPen.toFixed(2)}</b></span>
        <small>Stock supuesto para esta cantidad: {commercial.demoEstimate.status}. Los impuestos y gastos de envío no están comprobados; no se ha creado ninguna operación.</small>
       </div>}
       {commercial.canManuallyCreateOpportunity&&signal?.followupSuggested&&!simulated&&<button type="button" className="secondary-button" onClick={()=>{setActionOpen(true);setLinkedContact("");setApproved(false);setDueAt("");setTask(("Retomar consulta: "+lastQuestion).slice(0,390));}}>Gestionar manualmente en CRM</button>}
      </div>}
      {actionOpen&&!simulated&&signal?.key!=="ended"&&<div className="agent-sales-action">
       <h3>Convertir conversación en acción comercial</h3>
       {!contacts.length?<div className="agent-action-notice">Todavía no hay clientes en ARM-CRM. Registra primero un contacto real y después vuelve a esta conversación.
        <button className="secondary-button" onClick={()=>onNavigate("clientes")}>Ir a Clientes</button></div>:
        <form onSubmit={e=>void createTask(e)}>
         <label>Cliente del CRM<select required value={linkedContact} onChange={e=>setLinkedContact(e.target.value)}>
          <option value="">Seleccionar cliente</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
         </select></label>
         <label>Acción / motivo<textarea minLength={3} maxLength={390} required value={task} onChange={e=>setTask(e.target.value)} rows={2}/></label>
         <label>Fecha y hora acordada<input required type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)}/></label>
         <label className="agent-approval"><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)}/>
          Confirmo que el cliente autorizó este seguimiento. No enviar mensajes automáticamente.</label>
         <div className="agent-sales-buttons"><button disabled={savingAction||!approved||!dueAt} type="submit" className="primary-button"><CalendarClock size={15}/> Registrar seguimiento</button>
          <button disabled={savingAction||!linkedContact} className="secondary-button" type="button" onClick={()=>void createOpportunity()}>Crear oportunidad</button></div>
        </form>}
      </div>}
      {simulated&&<div className="agent-sandbox-banner">Simulación interna activada: los precios y la disponibilidad no representan datos comerciales reales.</div>}
      {usage&&<div className="agent-usage"><CheckCircle2 size={16}/><span>{usage.model} · {usage.inputTokens} entrada · {usage.outputTokens} salida · {usage.cachedTokens} caché · Est. USD {usage.estimatedUsd.toFixed(5)}{!usage.usageRecorded?" · Métrica no guardada":""}</span></div>}
      {notice&&<div className="agent-notice" role="status">{notice}</div>}
      {error&&<div className="auth-error" role="alert">{error}</div>}
      <form onSubmit={e=>void submit(e)} className="agent-compose"><label htmlFor="agent-question">Escribe la consulta comercial</label><div className="agent-compose-row"><textarea id="agent-question" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={800} rows={2} placeholder="Ej.: Necesito recomendar un Ulefone resistente para construcción. ¿Cuál tenemos registrado?"/><button type="submit" className="primary-button" disabled={sending||!ready||question.trim().length<2}><Send size={17}/>{sending?"Generando…":"Consultar IA"}</button></div><small>El uso de OpenAI API puede generar cargos por tokens. En modo real, un seguimiento solo se agenda tras obtener nombre y apellido, teléfono, fecha/hora y consentimiento. No se envían mensajes automáticos.</small></form>
     </div>
   </div>
 </div>;
}
