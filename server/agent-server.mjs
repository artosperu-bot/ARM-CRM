import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createManualWhatsAppService } from "./whatsapp-manual-reply.mjs";
import { estimateUsd } from "./agent-cost.mjs";
import { salesInstructions } from "./sales-policy.mjs";
import { enrichCatalog } from "./product-knowledge.mjs";
import { loadCommercialEvidence } from "./commercial-evidence.mjs";
import { retrieveSalesCatalog } from "./catalog-retrieval.mjs";
import {buildConversationContext} from "./conversation-context.mjs";
import {validAgentRequest} from "./request-validation.mjs";
import {buildBuyerContext,buyerGuidance} from "./buyer-reasoning.mjs";
import {normalizeSalesMemory,snapshotSalesMemory} from "./sales-memory.mjs";
import {affirmativeProductText} from "./catalog-matching.mjs";
import {isExplicitProductSwitch,selectCustomerPromptInput} from "./customer-topic.mjs";
import {protectSalesResponse,hideExactStockUnits} from "./sales-response-guard.mjs";
import {assessCommercialReadiness} from "./commercial-readiness.mjs";
import {requestsProductPhoto,verifiedProductPhoto,productPhotoUnavailableReply,serializePhotoTurn} from "./product-photo.mjs";
import { crmResponseSchema,validateBookingProposal } from "./followup-automation.mjs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

function envFile(path) {
  const env={};
  try {
    for (const line of readFileSync(path,"utf8").split(/\r?\n/)) {
      const m=line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,"");
    }
  }catch{/* environment variables can be supplied externally */}
  return env;
}
const home=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const crm=envFile(resolve(home,".env.local"));
const ai=envFile(process.env.OPENAI_ENV_FILE||"C:\\DESAROLLO\\STECH_AGENT\\.env");
const apiKey=process.env.OPENAI_API_KEY||ai.OPENAI_API_KEY;
const supabaseUrl=process.env.SUPABASE_URL||crm.VITE_SUPABASE_URL;
const publishableKey=process.env.SUPABASE_PUBLISHABLE_KEY||crm.VITE_SUPABASE_PUBLISHABLE_KEY;
const gatewayEnv=envFile(process.env.ARM_LEGACY_ENV_FILE||"C:\\DESAROLLO\\n8n\\backend\\.env");
const metaToken=process.env.WHATSAPP_ACCESS_TOKEN||gatewayEnv.WHATSAPP_ACCESS_TOKEN;
const metaPhoneId=process.env.WHATSAPP_PHONE_NUMBER_ID||gatewayEnv.WHATSAPP_PHONE_NUMBER_ID;
const serviceRole=process.env.SUPABASE_SERVICE_ROLE_KEY||gatewayEnv.SUPABASE_SERVICE_ROLE_KEY;
const testNumbers=(process.env.ARM_WHATSAPP_TEST_NUMBERS||crm.ARM_WHATSAPP_TEST_NUMBERS||"")
 .split(",").map(x=>x.replace(/\D/g,"")).filter(Boolean);
const manualWhatsApp=createManualWhatsAppService({
 db:supabaseUrl&&serviceRole?createClient(supabaseUrl,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}}):null,
 phoneId:metaPhoneId,accessToken:metaToken,allowlist:testNumbers,
 graphVersion:process.env.WHATSAPP_GRAPH_API_VERSION||gatewayEnv.WHATSAPP_GRAPH_API_VERSION||"v25.0"
});
const origin="http://127.0.0.1:5175",port=8789,model="gpt-5.4-mini",maxOutput=450,maxDaily=20;
const busy=new Set(), localCount=new Map();
function send(res,status,value) {
  res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
    "Access-Control-Allow-Origin":origin,"Access-Control-Allow-Methods":"GET,POST,OPTIONS",
    "Access-Control-Allow-Headers":"Authorization,Content-Type","Vary":"Origin"});
  res.end(JSON.stringify(value));
}
async function requestJson(req){
  let s="";
  for await(const chunk of req){s+=chunk.toString("utf8");if(s.length>6500)throw Object.assign(new Error("Solicitud muy larga"),{status:413});}
  try{return JSON.parse(s||"{}");}catch{throw Object.assign(new Error("Solicitud JSON incorrecta"),{status:400});}
}
function answerText(resp) {
 return (resp.output||[]).filter(x=>x.type==="message"&&x.role==="assistant")
 .flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text).join("\n").trim();
}
function clientFor(jwt){return createClient(supabaseUrl,publishableKey,{
 global:{headers:{Authorization:"Bearer "+jwt}},auth:{persistSession:false,autoRefreshToken:false}
});}
async function handleManualWhatsApp(req,res){
 if(!supabaseUrl||!publishableKey||!serviceRole)return send(res,503,{error:"Servicio manual de WhatsApp sin configuración."});
 const jwt=(req.headers.authorization||"").match(/^Bearer\s+([^\s]+)$/iu)?.[1];
 if(!jwt)return send(res,401,{error:"Inicia sesión en ARM-CRM."});
 const db=clientFor(jwt);
 const {data:{user},error:authError}=await db.auth.getUser(jwt);
 if(authError||!user?.id||!user?.email)return send(res,401,{error:"Sesión expirada."});
 const {data:permission,error:permissionError}=await db.from("crm_usuarios").select("activo")
  .eq("email",user.email.toLowerCase()).maybeSingle();
 if(permissionError||!permission?.activo)return send(res,403,{error:"Acceso al CRM no autorizado."});
 const url=new URL(req.url||"/","http://127.0.0.1:8789");
 const isStatus=req.method==="GET"&&url.pathname==="/manual-whatsapp/status";
 const isSend=req.method==="POST"&&url.pathname==="/manual-whatsapp/send";
 if(!isStatus&&!isSend)return send(res,404,{error:"Ruta inexistente."});
 const body=isSend?await requestJson(req):Object.fromEntries(url.searchParams);
 const workspaceId=body.workspaceId,threadId=body.threadId;
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
 if(!uuid.test(workspaceId||"")||!uuid.test(threadId||""))
  return send(res,400,{error:"Conversación inválida."});
 // RLS of the signed-in user must authorize this workspace. The service
 // role is used only after authorization and exact thread/assignee checks.
 const {data:ws,error:wsError}=await db.from("arm_workspaces").select("id").eq("id",workspaceId).maybeSingle();
 if(wsError||!ws)return send(res,403,{error:"No tienes acceso a este espacio."});
 const args={workspaceId,threadId,userId:user.id};
 if(isStatus)return send(res,200,await manualWhatsApp.status(args));
 const result=await manualWhatsApp.send({...args,text:body.text,requestId:body.requestId});
 return send(res,200,result);
}
async function handle(req,res){
 if((req.url||"").startsWith("/manual-whatsapp/"))return handleManualWhatsApp(req,res);
 if(req.method==="GET"&&req.url==="/health")return send(res,200,{ok:!!(apiKey&&supabaseUrl&&publishableKey),configured:!!apiKey,provider:"OpenAI",model,mode:"supervised",maxOutput,maxDaily});
 if(req.method!=="POST"||req.url!=="/chat")return send(res,404,{error:"Ruta inexistente"});
 if(!apiKey||!supabaseUrl||!publishableKey)return send(res,503,{error:"El backend no tiene las credenciales locales necesarias."});
 const jwt=(req.headers.authorization||"").match(/^Bearer\s+([^\s]+)$/i)?.[1];
 if(!jwt)return send(res,401,{error:"Inicia sesión en ARM-CRM."});
 const body=await requestJson(req),msg=typeof body.message==="string"?body.message.trim():"";
 const workspaceId=body.workspaceId,conversationId=body.conversationId??null;
 const simulated=body.simulated===true; // strictly private sandbox; never used by social connectors
 if(!validAgentRequest({workspaceId,conversationId,message:msg}))
   return send(res,400,{error:"Pregunta entre 2 y 800 caracteres; conversación inválida."});
 const db=clientFor(jwt);
 const {data:{user},error:authErr}=await db.auth.getUser(jwt);
 if(authErr||!user?.email)return send(res,401,{error:"Tu sesión ha caducado."});
 const [allow,ws]=await Promise.all([
   db.from("crm_usuarios").select("activo").eq("email",user.email.toLowerCase()).maybeSingle(),
   db.from("arm_workspaces").select("id").eq("id",workspaceId).maybeSingle()
 ]);
 if(allow.error||ws.error||!allow.data?.activo||!ws.data)return send(res,403,{error:"No tienes acceso a este espacio."});
 if(busy.has(user.id))return send(res,429,{error:"Espera a que termine tu consulta anterior."});
 const rateKey=user.id+":"+new Date().toISOString().slice(0,10);
 if((localCount.get(rateKey)||0)>=maxDaily)return send(res,429,{error:"Límite diario de 20 consultas alcanzado."});
 const day=new Date().toISOString().slice(0,10)+"T00:00:00.000Z";
 const {count,error:countErr}=await db.from("arm_ai_usage").select("id",{count:"exact",head:true})
  .eq("source","arm_agent").eq("workspace_id",workspaceId).gte("occurred_at",day);
 if(countErr)return send(res,503,{error:"No se pudo verificar el límite de consumo."});
 if((count||0)>=maxDaily)return send(res,429,{error:"Límite de uso diario del CRM alcanzado."});
 localCount.set(rateKey,(localCount.get(rateKey)||0)+1);busy.add(user.id);
 try {
  let cid=conversationId,priorMemory=null;
  if(cid){
    const {data:owned,error:ownErr}=await db.from("arm_agent_conversations").select("id,sales_memory")
      .eq("workspace_id",workspaceId).eq("created_by",user.id).eq("id",cid).maybeSingle();
    if(ownErr||!owned)return send(res,403,{error:"No tienes acceso a esa conversación."});
    priorMemory=normalizeSalesMemory(owned.sales_memory);
  }else{
    const {data:created,error:createErr}=await db.from("arm_agent_conversations").insert({
      workspace_id:workspaceId,created_by:user.id,title:msg.slice(0,100)
    }).select("id").single();
    if(createErr)throw new Error("No se pudo abrir la conversación.");
    cid=created.id;
  }
  const [history,initial]=await Promise.all([
    db.from("arm_agent_turns").select("id,role,content,created_at").eq("workspace_id",workspaceId)
      .eq("conversation_id",cid).order("created_at",{ascending:false}).limit(10),
    db.from("arm_agent_turns").select("id,role,content,created_at").eq("workspace_id",workspaceId)
      .eq("conversation_id",cid).order("created_at",{ascending:true}).limit(2)
  ]);
  if(history.error||initial.error)throw new Error("No fue posible leer el contexto comercial.");
  const context=buildConversationContext(initial.data||[],history.data||[]);
  // Existing private conversations may predate structured memory. Rebuild buyer
  // facts once from user-only history; never infer facts from the AI's replies.
  let historicalBuyerTurns=[];
  if(!priorMemory&&conversationId){
    const {data:oldTurns,error:oldTurnsError}=await db.from("arm_agent_turns")
      .select("content").eq("workspace_id",workspaceId)
      .eq("conversation_id",cid).eq("created_by",user.id)
      .eq("role","user").order("created_at",{ascending:false}).limit(200);
    if(oldTurnsError)throw new Error("No fue posible recuperar el historial de compras.");
    historicalBuyerTurns=[...(oldTurns||[])].reverse().map(x=>x.content).filter(Boolean);
  }
  const lookupTurns=[...(historicalBuyerTurns.length?historicalBuyerTurns:
    context.filter(t=>t.role==="user").map(t=>t.content)),msg];
  const hint=priorMemory?.customer_reference||priorMemory?.selected_partnumber;
  const requiredDraftSkus=(priorMemory?.draft_items||[]).map(x=>x.partnumber);
  const brandHint=typeof priorMemory?.brand==="string"&&!priorMemory?.selected_partnumber?priorMemory.brand:null;
  const catalogTurns=isExplicitProductSwitch(msg)?[affirmativeProductText(msg)]:
    hint?[...lookupTurns.slice(-14,-1),hint,msg]:
    brandHint?[brandHint,msg]:lookupTurns;
  const lookup=await retrieveSalesCatalog(db,workspaceId,catalogTurns,{limit:18,requiredPartnumbers:requiredDraftSkus});
  const pn=lookup.products.map(x=>x.partnumber);
  const testOffers=simulated&&pn.length?await db.from("arm_offer_simulations")
    .select("partnumber,price_pen,stock_status,stock_units_demo,is_test_data")
    .eq("workspace_id",workspaceId).eq("is_test_data",true)
    .in("partnumber",pn).limit(24):{data:[],error:null};
  if(testOffers.error)throw new Error("No fue posible verificar las ofertas de prueba.");
  // First resolve quantity and SKU without exposing any unapproved prices.
  const preliminary=enrichCatalog(lookup.products,simulated,testOffers.data||[],
    {factsByPn:lookup.factsByPn});
  const provisionalBuyer=buildBuyerContext(priorMemory?[msg]:lookupTurns,
    {catalog:preliminary,memory:priorMemory});
  let commercialByPn={};
  try{commercialByPn=await loadCommercialEvidence(db,workspaceId,lookup.products);}
  catch{console.error("ARM_COMMERCIAL_EVIDENCE_UNAVAILABLE");}
  const catalog=enrichCatalog(lookup.products,simulated,testOffers.data||[],
    {factsByPn:lookup.factsByPn,commercialByPn,requestedQuantity:provisionalBuyer.quantity,
     requestedQuantitiesByPn:Object.fromEntries(provisionalBuyer.draft_items.map(x=>[x.partnumber,x.quantity]))});
  const buyer=buildBuyerContext(priorMemory?[msg]:lookupTurns,{catalog,memory:priorMemory});
  const commercial=assessCommercialReadiness(buyer,{catalog,simulated});
  if(requestsProductPhoto(msg)){
    // Product image is an authenticated catalog lookup, not an AI-generated
    // picture or text hyperlink. Public URL is persisted to allow re-opening.
    const photo=verifiedProductPhoto({buyer,catalog,factsByPn:lookup.factsByPn});
    const answer=photo?.caption||productPhotoUnavailableReply(buyer);
    const savedText=photo?serializePhotoTurn(photo):answer;
    const {error:photoTurnError}=await db.from("arm_agent_turns").insert([
      {workspace_id:workspaceId,conversation_id:cid,created_by:user.id,role:"user",content:msg},
      {workspace_id:workspaceId,conversation_id:cid,created_by:user.id,role:"assistant",content:savedText||answer}
    ]);
    if(photoTurnError)return send(res,500,{error:"No fue posible guardar la fotografía en el historial."});
    const saved=snapshotSalesMemory(buyer,{previous:priorMemory,lastMessageAt:new Date().toISOString()});
    const {error:photoMemoryError}=await db.from("arm_agent_conversations")
      .update({sales_memory:saved}).eq("id",cid)
      .eq("workspace_id",workspaceId).eq("created_by",user.id);
    if(photoMemoryError)console.error("ARM_AGENT_PHOTO_MEMORY_NOT_SAVED",photoMemoryError.code||"unknown");
    return send(res,200,{ok:true,conversationId:cid,answer,photo,usage:null,
      booking:null,simulated,memorySaved:!photoMemoryError,commercial});
  }
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),35000);
  let completion;
  try {
    const openai=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",signal:abort.signal,
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+apiKey},
      body:JSON.stringify({
        model,store:false,max_output_tokens:maxOutput,reasoning:{effort:"none"},
        text:{format:crmResponseSchema},
        instructions:salesInstructions(catalog,{simulated,nowIso:new Date().toISOString(),buyer})+"\n"+buyerGuidance(buyer,{catalog})+"\nDevuelve JSON con reply y followup. Los campos followup se extraen únicamente de mensajes DEL CLIENTE, jamás inventes nombres, teléfonos, fechas ni consentimiento. requested=true solo para seguimiento solicitado; explicit_consent=true solo si el último mensaje incluye autorización para AGENDAR. Si falta dato usa null. Jamás afirmes registro exitoso en reply.",
        input:selectCustomerPromptInput(context,msg)
      })
    });
    if(!openai.ok){
      if(openai.status===401)return send(res,503,{error:"OpenAI rechazó la clave del servicio privado."});
      if(openai.status===429)return send(res,429,{error:"OpenAI alcanzó un límite de cuota o facturación. No repetir automáticamente."});
      return send(res,502,{error:"OpenAI no respondió correctamente (HTTP "+openai.status+")."});
    }
    completion=await openai.json();
  } finally {clearTimeout(timer);}
  const raw=answerText(completion);
  if(!raw)return send(res,502,{error:"El modelo no devolvió texto dentro del límite de salida."});
  let structured;
  try{structured=JSON.parse(raw);}catch{return send(res,502,{error:"La respuesta del agente no llegó en el formato esperado."});}
  if(typeof structured?.reply!=="string"||!structured.reply.trim())
     return send(res,502,{error:"El agente no devolvió una respuesta válida."});
  // The AI cannot approve its own commercial claims. Booking may override the
  // guarded answer only after the RPC has returned confirmed success.
  const guarded=protectSalesResponse(structured.reply.trim(),{catalog,buyer,simulated});
  let answer=guarded.reply,booking=null;
  const customerTurns=[...context.filter(t=>t.role==="user").map(t=>t.content),msg];
  const proposal=simulated?null:validateBookingProposal(structured.followup,customerTurns,msg);
  if(proposal){
    const {data:rows,error:bookingError}=await db.rpc("arm_book_agent_followup",{
      p_workspace_id:workspaceId,p_conversation_id:cid,p_full_name:proposal.name,
      p_phone:proposal.phone,p_due_at:proposal.dueAt,
      p_description:("Retomar consulta sobre: "+customerTurns.join(" ").slice(0,300)).slice(0,390),
      p_consent:true
    });
    if(bookingError){
      console.error("arm_book_agent_followup: rejected",bookingError.code||"unknown");
      answer="No se pudo registrar el seguimiento en el CRM. Sigue pendiente; por favor intenta de nuevo o solicita ayuda a un asesor.";
    }else if(rows?.length){
      booking={saved:true,followupId:rows[0].followup_id,alreadyScheduled:rows[0].already_scheduled,dueAt:proposal.dueAt};
      answer="✅ "+(rows[0].already_scheduled?"Tu seguimiento ya estaba agendado":"Tu seguimiento quedó registrado automáticamente")+" en STECH para el "+new Date(proposal.dueAt).toLocaleString("es-PE",{timeZone:"America/Lima",dateStyle:"full",timeStyle:"short"})+". El equipo puede verlo en la agenda; aún no se envía ningún mensaje automático.";
    }
  }
  // Never allow quantity disclosures to be mistaken for stock numbers.
  answer=hideExactStockUnits(answer);
  const usage=completion.usage||{},input=usage.input_tokens||0,output=usage.output_tokens||0;
  const cached=Math.min(input,usage.input_tokens_details?.cached_tokens||0);
  const estimate=estimateUsd(input,output,cached);
  const {error:turnErr}=await db.from("arm_agent_turns").insert([
    {workspace_id:workspaceId,conversation_id:cid,created_by:user.id,role:"user",content:msg},
    {workspace_id:workspaceId,conversation_id:cid,created_by:user.id,role:"assistant",content:answer.slice(0,8000)}
  ]);
  if(turnErr)return send(res,500,{error:"OpenAI respondió, pero no se pudo guardar el historial. No reintentes automáticamente."});
  const savedMemory=snapshotSalesMemory(buyer,{
    previous:priorMemory,lastMessageAt:new Date().toISOString()
  });
  const {error:memoryError}=await db.from("arm_agent_conversations")
    .update({sales_memory:savedMemory}).eq("id",cid)
    .eq("workspace_id",workspaceId).eq("created_by",user.id);
  if(memoryError)console.error("ARM_AGENT_SALES_MEMORY_NOT_SAVED",memoryError.code||"unknown");
  const {error:metricErr}=await db.from("arm_ai_usage").insert({
    workspace_id:workspaceId,source:"arm_agent",source_event_id:completion.id||randomUUID(),
    session_id:cid,message_id:null,model:completion.model||model,node:"private_supervised",
    input_tokens:input,output_tokens:output,cached_input_tokens:cached,
    cost_usd:estimate,cost_source:"rate_card_estimate",occurred_at:new Date().toISOString()
  });
  if(metricErr)console.error("Usage write failed: metric not recorded");
  return send(res,200,{ok:true,conversationId:cid,answer,usage:{
    model:completion.model||model,inputTokens:input,outputTokens:output,cachedTokens:cached,
    estimatedUsd:estimate,usageRecorded:!metricErr
  },booking,simulated,memorySaved:!memoryError,commercial});
 }finally{busy.delete(user.id);}
}
const service=createServer(async(req,res)=>{
 try {
  if((req.headers.origin&&req.headers.origin!==origin) || !["127.0.0.1:8789","localhost:8789"].includes(req.headers.host||""))
    return send(res,403,{error:"Origen no permitido."});
  if(req.method==="OPTIONS")return send(res,204,{});
  return await handle(req,res);
 }catch(err){
  console.error("STECH agent:",err instanceof Error?err.name:"unknown");
  return send(res,err?.status||500,{error:err?.status?err.message:"Error interno del agente."});
 }
});
service.on("error",error=>{
 if(error.code==="EADDRINUSE"){
  console.error("STECH_AGENT_ALREADY_RUNNING: puerto "+port+" ocupado. Comprueba /health; no abras dos agentes simultáneos.");
  process.exitCode=1;
 }else throw error;
});
service.listen(port,"127.0.0.1",()=>{
 console.log("STECH_AGENT_LOCAL_READY port="+port+" provider=OpenAI model="+model+
 " configured="+Boolean(apiKey&&supabaseUrl&&publishableKey)+" maxDaily="+maxDaily);
});
