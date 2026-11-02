import {createClient} from "npm:@supabase/supabase-js@2.112.3";

// Read-only authentication status check for the user's actual Composio project.
// Never fetch tokens from response fields or execute Meta actions.
const configs:Record<string,string>={
 whatsapp:"ac_CBs5uIOC0LuD",
 facebook:"ac_WyKgzw8NEaji",
 instagram:"ac_eSPuwK-LxqE4",
};
const allow="http://127.0.0.1:5175";
const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":allow,
 "Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type",
 "Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin"};
const reply=(code:number,obj:Record<string,unknown>)=>new Response(JSON.stringify(obj),{status:code,headers});
const authStatuses=["ACTIVE","FAILED","EXPIRED","INITIALIZING","INITIATED","INACTIVE","REVOKED"] as const;
type Connected={id:string;alias?:string|null;status?:string;toolkit?:{slug?:string};
  auth_config?:{id?:string};authConfig?:{id?:string}};
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return reply(405,{error:"Método no permitido"});
 const origin=req.headers.get("origin");
 if(origin && origin!==allow)return reply(403,{error:"Origen no autorizado"});
 const base=Deno.env.get("SUPABASE_URL"),pub=Deno.env.get("SUPABASE_ANON_KEY"),
  server=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),composioKey=Deno.env.get("COMPOSIO_API_KEY");
 if(!base||!pub||!server)return reply(503,{error:"Configuración de Supabase incompleta"});
 const jwt=(req.headers.get("authorization")||"").replace(/^Bearer /,"");
 if(!jwt)return reply(401,{error:"Autenticación requerida"});
 const userClient=createClient(base,pub,{auth:{persistSession:false,autoRefreshToken:false}});
 const admin=createClient(base,server,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await userClient.auth.getUser(jwt);
 if(authError||!user?.email)return reply(401,{error:"Sesión inválida"});
 const {data:profile,error:profileError}=await admin.from("crm_usuarios")
  .select("rol,activo").eq("email",user.email.toLowerCase()).maybeSingle();
 if(profileError||!profile?.activo||profile.rol!=="ADMIN")return reply(403,{error:"Solo el administrador puede verificar conexiones"});
 let workspaceId="";
 try{const body=await req.json();workspaceId=typeof body?.workspaceId==="string"?body.workspaceId:"";}
 catch{return reply(400,{error:"Solicitud inválida"});}
 if(!/^[a-f0-9-]{36}$/i.test(workspaceId))return reply(400,{error:"Workspace inválido"});
 const {data:ws,error:wsError}=await admin.from("arm_workspaces").select("id")
  .eq("id",workspaceId).eq("owner_id",user.id).maybeSingle();
 if(wsError||!ws)return reply(403,{error:"Workspace no autorizado"});
 if(!composioKey)return reply(503,{error:"Falta configurar COMPOSIO_API_KEY en secretos de Supabase para este proyecto"});
 const found:Connected[]=[];let cursor:string|undefined;
 try {
  for(let batch=0;batch<5;batch++){
   const url=new URL("https://backend.composio.dev/api/v3.1/connected_accounts");
   url.searchParams.set("limit","100");url.searchParams.set("account_type","ALL");
   if(cursor)url.searchParams.set("cursor",cursor);
   const remote=await fetch(url,{headers:{"x-api-key":composioKey,"accept":"application/json"},signal:AbortSignal.timeout(12000)});
   if(!remote.ok)return reply(502,{error:"Composio no aceptó la clave del proyecto o devolvió un error: HTTP "+remote.status});
   const body=await remote.json() as {items?:Connected[];next_cursor?:string|null};
   if(!Array.isArray(body.items))return reply(502,{error:"Respuesta no reconocida de Composio"});
   found.push(...body.items);cursor=body.next_cursor||undefined;
   if(!cursor)break;
  }
 }catch(e){console.error("Composio status read error",e instanceof Error?e.name:"unknown");return reply(502,{error:"No fue posible consultar las cuentas de Composio"});}
 const now=new Date().toISOString();const summary:Record<string,{active:number;pending:number;total:number}>={};
 for(const channel of Object.keys(configs))summary[channel]={active:0,pending:0,total:0};
 for(const row of found){
  const channel=row.toolkit?.slug;
  if(!channel||!configs[channel])continue;
  const cfg=row.auth_config?.id||row.authConfig?.id;
  if(cfg!==configs[channel]||typeof row.id!=="string"||row.id.length>120)continue;
  const valid=authStatuses.includes(row.status as typeof authStatuses[number])?row.status!:"UNKNOWN";
  summary[channel].total++;
  if(valid==="ACTIVE")summary[channel].active++;else summary[channel].pending++;
  const {error:upsertError}=await admin.from("arm_channel_accounts").upsert({
   workspace_id:workspaceId,channel,provider:"composio",auth_config_id:cfg,
   connected_account_id:row.id,alias:typeof row.alias==="string"?row.alias.slice(0,180):null,
   auth_status:valid,write_enabled:false,last_checked_at:now
  },{onConflict:"workspace_id,provider,connected_account_id"});
  if(upsertError)return reply(500,{error:"Error al guardar estado de conexión"});
 }
 for(const [channel,counts] of Object.entries(summary)){
  const {error:updateError}=await admin.from("arm_channel_connections").update({
    status:counts.active>0?"read_only":"authorization_required",
    write_enabled:false,last_checked_at:now
  }).eq("workspace_id",workspaceId).eq("channel",channel).eq("provider","composio");
  if(updateError)return reply(500,{error:"No fue posible actualizar estado de canal"});
 }
 return reply(200,{ok:true,project:"artosperu_workspace_first_project",summary,
   note:"Conexiones verificadas; envío y recepción automáticos siguen deshabilitados"});
});
