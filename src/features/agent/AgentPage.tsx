import {useCallback,useEffect,useState} from "react";
import {Bot,CheckCircle2,Coins,MessageCircle,Plus,Send,ShieldCheck,RefreshCw,Zap} from "lucide-react";
import {supabase} from "../../lib/supabase";
import "./agent.css";

type Conversation={id:string;title:string;created_at:string};
type Turn={id:string;role:"user"|"assistant";content:string;created_at:string};
type Usage={model:string;inputTokens:number;outputTokens:number;cachedTokens:number;estimatedUsd:number;usageRecorded:boolean};
export default function AgentPage({workspaceId}:{workspaceId:string}){
 const [conversations,setConversations]=useState<Conversation[]>([]);
 const [selected,setSelected]=useState<string|null>(null);
 const [turns,setTurns]=useState<Turn[]>([]);
 const [question,setQuestion]=useState("");
 const [sending,setSending]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [usage,setUsage]=useState<Usage|null>(null);
 const [ready,setReady]=useState(false);
 const [loading,setLoading]=useState(true);

 const refresh=useCallback(async()=>{
  if(!supabase)return;
  const {data,error:readErr}=await supabase.from("arm_agent_conversations").select("id,title,created_at")
    .eq("workspace_id",workspaceId).order("created_at",{ascending:false}).limit(50);
  if(readErr)setError(readErr.message);
  else setConversations((data||[]) as Conversation[]);
  setLoading(false);
 },[workspaceId]);
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
    body:JSON.stringify({workspaceId,conversationId:selected,message:msg})
   });
   const result=await response.json();
   if(!response.ok||!result.ok)throw new Error(result.error||"No fue posible consultar OpenAI.");
   setQuestion("");setSelected(result.conversationId);
   setUsage(result.usage);
   setNotice("Respuesta real de OpenAI · supervisada · sin envío al cliente.");
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
   <div className="agent-stat-strip"><span><ShieldCheck size={16}/> Supervisado: no responde en redes</span><span><Zap size={16}/> Máximo 350 tokens de salida</span><span><Coins size={16}/> Hasta 20 consultas/día</span></div>
   <div className="agent-layout-real">
    <aside className="agent-sessions"><div className="agent-side-head"><strong>Conversaciones</strong><button aria-label="Nueva conversación" title="Nueva conversación" onClick={()=>{setSelected(null);setTurns([]);setUsage(null);setError("");setNotice("");}}><Plus size={17}/></button></div>
     {conversations.length===0&&<p className="agent-empty-sessions">Aún no hay conversaciones.</p>}
     {conversations.map(c=><button key={c.id} className={"agent-session "+(selected===c.id?"selected":"")} onClick={()=>{setSelected(c.id);setError("");setUsage(null);}}><MessageCircle size={16}/><span>{c.title}</span></button>)}
    </aside>
    <div className="agent-conversation">
      <div className="agent-messages">
      {!turns.length&&!loading&&<div className="agent-welcome"><div><Bot size={32}/></div><h3>Tu asesor comercial inteligente</h3><p>Haz una consulta sobre los celulares registrados en STECH. El agente conoce el catálogo real, pero no inventará precios ni stock sin validar.</p></div>}
      {loading&&<div className="agent-wait">Cargando conversación…</div>}
      {turns.map(t=><div key={t.id} className={"agent-bubble "+t.role}><span>{t.role==="assistant"?"Agente STECH":"Tú"}</span><p>{t.content}</p></div>)}
      {sending&&<div className="agent-wait"><RefreshCw size={15}/> Consultando a OpenAI…</div>}
      </div>
      {usage&&<div className="agent-usage"><CheckCircle2 size={16}/><span>{usage.model} · {usage.inputTokens} entrada · {usage.outputTokens} salida · {usage.cachedTokens} caché · Est. USD {usage.estimatedUsd.toFixed(5)}{!usage.usageRecorded?" · Métrica no guardada":""}</span></div>}
      {notice&&<div className="agent-notice" role="status">{notice}</div>}
      {error&&<div className="auth-error" role="alert">{error}</div>}
      <form onSubmit={e=>void submit(e)} className="agent-compose"><label htmlFor="agent-question">Escribe la consulta comercial</label><div className="agent-compose-row"><textarea id="agent-question" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={800} rows={2} placeholder="Ej.: Necesito recomendar un Ulefone resistente para construcción. ¿Cuál tenemos registrado?"/><button type="submit" className="primary-button" disabled={sending||!ready||question.trim().length<2}><Send size={17}/>{sending?"Generando…":"Consultar IA"}</button></div><small>El uso de OpenAI API puede generar cargos por tokens. No hay búsqueda web, imágenes ni mensajes automáticos.</small></form>
     </div>
   </div>
 </div>;
}
