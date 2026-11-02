import { useCallback,useEffect,useState } from "react";
import { CheckCircle2, LockKeyhole, PlugZap, RefreshCw, ShieldAlert } from "lucide-react";
import { supabase } from "../../lib/supabase";
type Connection={id:string;channel:string;provider:string;status:string;write_enabled:boolean;last_checked_at:string|null};
export default function IntegrationsPage({workspaceId}:{workspaceId:string}){
 const [items,setItems]=useState<Connection[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
 const refresh=useCallback(async()=>{
  if(!supabase)return;
  setLoading(true);setError("");
  const {data,error:failure}=await supabase.from("arm_channel_connections")
   .select("id,channel,provider,status,write_enabled,last_checked_at")
   .eq("workspace_id",workspaceId).order("channel");
  if(failure)setError(failure.message);else setItems((data??[]) as Connection[]);
  setLoading(false);
 },[workspaceId]);
 useEffect(()=>{void refresh();},[refresh]);
 return <><div className="panel"><div className="panel-head"><div><h2>Conectores de redes sociales</h2><p>Estados registrados en ARM-CRM. No representan conexiones activas hasta verificarse con el proveedor.</p></div><button className="secondary-button" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={16}/> Actualizar</button></div>
 {error&&<div role="alert" className="auth-error">{error}</div>}
 <div className="integration-grid">{items.map(item=><article key={item.id} className="integration"><span className="integration-icon"><PlugZap size={22}/></span><div><h3>{item.channel.charAt(0).toUpperCase()+item.channel.slice(1)}</h3><small>{item.provider.toUpperCase()}</small><p>{item.last_checked_at?"Revisado: "+new Date(item.last_checked_at).toLocaleString("es-PE"):"Autorización del proveedor pendiente"}</p></div><span className={"tiny-pill "+(item.status==="active"?"":"orange")}>{item.status==="active"?"Conectado":"No conectado"}</span></article>)}
 {!loading&&!items.length&&<div className="empty-records">No se han registrado canales.</div>}</div></div>
 <div className="info-strip"><ShieldAlert size={20}/><div><strong>Sin envíos automáticos todavía</strong><span>Composio necesita autorización de las cuentas empresariales. Las conexiones se validarán antes de registrar su estado como activo. Las publicaciones HERMES requieren aprobación humana.</span></div></div>
 <div className="info-strip"><CheckCircle2 size={20}/><div><strong>Supabase y acceso Google operativos</strong><span>Los datos de CRM se consultan mediante credenciales autorizadas y políticas RLS.</span></div></div>
 <div className="info-strip"><LockKeyhole size={20}/><div><strong>Credenciales protegidas</strong><span>Los tokens Meta/Composio permanecen fuera del navegador y del repositorio.</span></div></div></>;
}
