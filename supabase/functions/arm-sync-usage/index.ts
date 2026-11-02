// Sincroniza historiales de tokens del CRM STECH anterior al ARM-CRM.
// Solo POST con JWT auténtico de ADMIN permitido y workspace propio.
// No modifica tablas antiguas, no contacta Meta ni envía mensajes.
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const allowOrigin = "http://127.0.0.1:5175";
const headers = {
 "Access-Control-Allow-Origin": allowOrigin,
 "Access-Control-Allow-Methods": "POST,OPTIONS",
 "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
 "Content-Type":"application/json; charset=utf-8",
};
const response = (status:number,data:Record<string,unknown>)=>
 new Response(JSON.stringify(data),{status,headers});
function getJwt(req:Request){
 const auth=req.headers.get("authorization")||"";
 return auth.startsWith("Bearer ")?auth.slice(7):"";
}
Deno.serve(async (req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return response(405,{error:"Método no permitido."});
 const origin=req.headers.get("origin");
 if(origin && origin!==allowOrigin)return response(403,{error:"Origen no autorizado."});
 const base=Deno.env.get("SUPABASE_URL");
 const publicKey=Deno.env.get("SUPABASE_ANON_KEY");
 const privateKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!base||!publicKey||!privateKey)return response(503,{error:"Configuración de servidor incompleta."});
 const jwt=getJwt(req);
 if(!jwt)return response(401,{error:"Necesitas iniciar sesión."});
 const safe=createClient(base,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const privileged=createClient(base,privateKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await safe.auth.getUser(jwt);
 if(authError || !user?.email)return response(401,{error:"La sesión no es válida."});
 const {data:profile,error:profileError}=await privileged.from("crm_usuarios")
   .select("rol,activo").eq("email",user.email.toLowerCase()).maybeSingle();
 if(profileError||!profile?.activo||profile.rol!=="ADMIN")return response(403,{error:"Solo el administrador autorizado puede actualizar métricas."});
 const provider=user.app_metadata?.provider;
 if(provider!=="google" && !user.app_metadata?.providers?.includes("google"))return response(403,{error:"La cuenta debe usar Google."});
 let workspaceId="";
 try{const body=await req.json() as {workspaceId?:unknown};if(typeof body.workspaceId==="string")workspaceId=body.workspaceId;}
 catch{return response(400,{error:"JSON inválido."});}
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workspaceId))return response(400,{error:"Identificador de espacio inválido."});
 const {data:ws,error:wsError}=await privileged.from("arm_workspaces")
    .select("id").eq("id",workspaceId).eq("owner_id",user.id).maybeSingle();
 if(wsError||!ws)return response(403,{error:"Espacio comercial no permitido."});
 let imported=0;let scanned=0;
 try{
  for(let page=0;page<40;page++){
   const size=250;
   const {data:batch,error:readError}=await privileged.from("ia_metricas_tokens")
    .select("id,session_id,message_id,modelo,nodo,tokens_entrada,tokens_salida,tokens_cacheados,creado_en")
    .order("id",{ascending:true}).range(page*size,(page+1)*size-1);
   if(readError)throw readError;
   if(!batch?.length)break;
   scanned+=batch.length;
   const prepared=batch.filter(x=>x.session_id && x.creado_en).map(x=>({
    workspace_id:workspaceId,source:"legacy_ia_metricas_tokens",
    source_event_id:String(x.id),session_id:x.session_id,message_id:x.message_id||null,
    model:x.modelo||"sin-modelo",node:x.nodo||null,
    input_tokens:Math.max(0,x.tokens_entrada||0),output_tokens:Math.max(0,x.tokens_salida||0),
    cached_input_tokens:Math.max(0,x.tokens_cacheados||0),cost_usd:null,
    cost_source:"unavailable",occurred_at:x.creado_en,
   }));
   if(prepared.length){
    const {error:writeError}=await privileged.from("arm_ai_usage").upsert(prepared,{
     onConflict:"workspace_id,source,source_event_id",ignoreDuplicates:true,
    });
    if(writeError)throw writeError;
   }
   if(batch.length<size)break;
  }
  const {count,error:countError}=await privileged.from("arm_ai_usage")
    .select("id",{count:"exact",head:true}).eq("workspace_id",workspaceId).eq("source","legacy_ia_metricas_tokens");
  if(countError)throw countError;
  imported=count??0;
  return response(200,{ok:true,scanned,recorded:imported,source:"legacy_ia_metricas_tokens",time:new Date().toISOString()});
 }catch(error){
  // Evitar exponer detalles internos al navegador.
  console.error("arm-sync-usage error",error instanceof Error?error.name:"unknown");
  return response(500,{error:"No fue posible completar la sincronización de métricas."});
 }
});
