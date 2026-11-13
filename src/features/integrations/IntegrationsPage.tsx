import {useCallback,useEffect,useState} from "react";
import {CheckCircle2,ExternalLink,LockKeyhole,PlugZap,RefreshCw,ShieldAlert} from "lucide-react";
import {supabase} from "../../lib/supabase";
type Connection={id:string;channel:string;provider:string;status:string;write_enabled:boolean;last_checked_at:string|null};
type Account={id:string;channel:string;auth_config_id:string;connected_account_id:string;auth_status:string;alias:string|null;last_checked_at:string};
const authConfigs:Record<string,string>={
 whatsapp:"ac_CBs5uIOC0LuD",facebook:"ac_WyKgzw8NEaji",instagram:"ac_eSPuwK-LxqE4"
};
export default function IntegrationsPage({workspaceId,isAdmin}:{workspaceId:string;isAdmin:boolean}){
 const [items,setItems]=useState<Connection[]>([]);
 const [accounts,setAccounts]=useState<Account[]>([]);
 const [loading,setLoading]=useState(true);const [checking,setChecking]=useState(false);
 const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const refresh=useCallback(async()=>{
  if(!supabase)return;
  setLoading(true);setError("");
  const [conn,acc]=await Promise.all([
   supabase.from("arm_channel_connections").select("id,channel,provider,status,write_enabled,last_checked_at").eq("workspace_id",workspaceId).order("channel"),
   supabase.from("arm_channel_accounts").select("id,channel,auth_config_id,connected_account_id,auth_status,alias,last_checked_at").eq("workspace_id",workspaceId).order("channel")
  ]);
  if(conn.error||acc.error)setError(conn.error?.message||acc.error?.message||"No se pudieron leer las conexiones.");
  else{setItems((conn.data??[]) as Connection[]);setAccounts((acc.data??[]) as Account[]);}
  setLoading(false);
 },[workspaceId]);
 useEffect(()=>{void refresh();},[refresh]);
 async function checkComposio(){
  if(!supabase||!isAdmin)return;
  setChecking(true);setNotice("");setError("");
  try{
   const {data,error:failure}=await supabase.functions.invoke("arm-composio-status",{body:{workspaceId}});
   if(failure)throw failure;
   if(!data?.ok)throw new Error(data?.error||"No fue posible verificar cuentas");
   await refresh();
   setNotice("Conexiones verificadas en Composio. Ningún envío automático fue activado.");
  }catch(e){setError(e instanceof Error?e.message:"Verificación no disponible. Comprueba la clave del proyecto Composio.");}
  finally{setChecking(false);}
 }
 const channels=["whatsapp","facebook","instagram"];
 return <div className="crm-integrations">
  <section className="panel">
   <div className="panel-head"><div><h2>Redes sociales STECH</h2><p>Conexiones específicas del proyecto artosperu_workspace_first_project</p></div>
   <div className="crm-integration-controls">
     <button className="secondary-button" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={16}/> Actualizar vista</button>
     {isAdmin&&<button className="primary-button" onClick={()=>void checkComposio()} disabled={checking}><PlugZap size={16}/>{checking?"Comprobando…":"Verificar en Composio"}</button>}
   </div></div>
   {error&&<div className="auth-error" role="alert">{error}</div>}
   {notice&&<div className="notice" role="status">{notice}</div>}
   <div className="integration-grid">{channels.map(channel=>{
     const link=items.find(i=>i.channel===channel&&i.provider==="composio");
     const linked=accounts.filter(i=>i.channel===channel);
     const active=linked.filter(i=>i.auth_status==="ACTIVE").length;
     return <article className="integration crm-channel-card" key={channel}>
       <span className="integration-icon"><PlugZap size={22}/></span>
       <div><h3>{channel==="whatsapp"?"WhatsApp Business":channel==="facebook"?"Facebook Pages":"Instagram Business"}</h3>
         <small>Composio OAuth 2.0 · {authConfigs[channel]}</small>
         <p>{active} cuenta(s) ACTIVE verificadas por la API · {linked.length} registrada(s) en ARM-CRM</p>
         {linked.map(a=><div className="crm-connection-row" key={a.id}><span>{a.alias||a.connected_account_id}</span><strong>{a.auth_status}</strong></div>)}
         {link?.last_checked_at&&<small>Última revisión: {new Date(link.last_checked_at).toLocaleString("es-PE")}</small>}
       </div><span className={"tiny-pill "+(active?"":"orange")}>{active?"OAuth verificado":"Por verificar"}</span>
     </article>;
   })}</div>
   <a className="crm-composio-link" href="https://dashboard.composio.dev/artosperu_workspace/artosperu_workspace_first_project/auth-configs" target="_blank" rel="noopener noreferrer">
     Administrar Auth Configs en Composio <ExternalLink size={15}/>
   </a>
  </section>
  <div className="info-strip"><ShieldAlert size={20}/><div><strong>WhatsApp manual: piloto autorizado</strong><span>El receptor firmado Meta y la conexión de WhatsApp están activos. Solo el asesor asignado puede responder desde la bandeja a los dos números de prueba, si el cliente escribió dentro de las últimas 24 horas y no se opuso al contacto. Los envíos automáticos y los demás canales permanecen deshabilitados.</span></div></div>
  <div className="info-strip"><LockKeyhole size={20}/><div><strong>Clave privada solo en servidor</strong><span>Para verificar el proyecto de Composio desde ARM-CRM, registra COMPOSIO_API_KEY como secreto de Supabase, nunca en una variable VITE_ ni en GitHub.</span></div></div>
  <div className="info-strip"><CheckCircle2 size={20}/><div><strong>Supabase CRM y autenticación con Google</strong><span>Datos separados por workspace y acceso restringido a usuarios de STECH.</span></div></div>
 </div>;
}
