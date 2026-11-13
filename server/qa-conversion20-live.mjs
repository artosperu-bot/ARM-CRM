/**
 * 20 end-to-end, read-only ALEX selling conversations. Reads ONLY Supabase
 * pilot catalog and simulated offers; no CRM, WhatsApp, order or payment writes.
 * Invokes the configured ALEX model per turn, preserving real assistant replies.
 * Outputs a complete auditable trace to docs/ (synthetic customers only).
 */
import {readFileSync,writeFileSync} from "node:fs";
import {createClient} from "@supabase/supabase-js";
import {conversionJourneys20} from "./qa-conversion20-scenarios.mjs";
import {enrichCatalog} from "./product-knowledge.mjs";
import {buildBuyerContext,buyerGuidance} from "./buyer-reasoning.mjs";
import {snapshotSalesMemory} from "./sales-memory.mjs";
import {salesInstructions} from "./sales-policy.mjs";
import {protectSalesResponse} from "./sales-response-guard.mjs";
import {assessCommercialReadiness} from "./commercial-readiness.mjs";
import {reviewCommercialTurn} from "./commercial-service-standard.mjs";
import {formatWhatsAppReply} from "./whatsapp-format.mjs";
import {crmResponseSchema} from "./followup-automation.mjs";
import {selectCustomerPromptInput} from "./customer-topic.mjs";
const cleanEnv=path=>{const vars={};try{for(const line of readFileSync(path,"utf8").split(/\r?\n/u)){
 const m=line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/u);
 if(m)vars[m[1]]=m[2].trim().replace(/^['"]|['"]$/gu,"");
}}catch{}return vars;};
const env={...cleanEnv("C:\\DESAROLLO\\n8n\\backend\\.env"),
 ...cleanEnv("C:\\DESAROLLO\\STECH_AGENT\\.env"),
 ...cleanEnv("C:\\DESAROLLO\\ARM-CRM\\.env.local"),...process.env};
const url=env.SUPABASE_URL||env.VITE_SUPABASE_URL;
if(!url||!env.SUPABASE_SERVICE_ROLE_KEY||!env.OPENAI_API_KEY)
 throw Error("PRIVATE_QA_CONFIG_MISSING");
const db=createClient(url,env.SUPABASE_SERVICE_ROLE_KEY,{
 auth:{persistSession:false,autoRefreshToken:false}
});
const {data:workspaces,error:workspacesErr}=await db.from("arm_workspaces")
 .select("id").limit(1);
if(workspacesErr||!workspaces?.length)throw Error("NO_SUPABASE_WORKSPACE");
const ws=workspaces[0].id;
const pilotSkus=["ARMOR-X13","ARMOR-22-256G","ARMOR-X12Pro","ARMOR-25TPro-256GB"];
async function currentCatalog(){
 const {data:rows,error:a}=await db.from("arm_products")
  .select("id,workspace_id,partnumber,title,brand,attributes,category_path,family_key,variant_options")
  .eq("workspace_id",ws).in("partnumber",pilotSkus).limit(10);
 if(a)throw Error("SUPABASE_PRODUCTS_READ_FAILED");
 const {data:offers,error:b}=await db.from("arm_offer_simulations")
  .select("partnumber,price_pen,stock_status,stock_units_demo,is_test_data")
  .eq("workspace_id",ws).eq("is_test_data",true)
  .in("partnumber",pilotSkus).limit(10);
 if(b)throw Error("SUPABASE_TEST_OFFERS_READ_FAILED");
 const count=(rows||[]).length;
 if(count<4)throw Error("PILOT_CATALOG_INCOMPLETE_"+count);
 return {rows:rows||[],offers:offers||[]};
}
const check=await currentCatalog();
const scenarios=conversionJourneys20.filter(s=>!process.env.ALEX_QA_IDS||process.env.ALEX_QA_IDS.split(",").includes(s.id));
if(!process.env.ALEX_QA_IDS&&(scenarios.length!==20||scenarios.filter(x=>x.kind==="decision").length!==5))
 throw Error("SCENARIOS_MUST_BE_20_WITH_5_BUYERS");
let apiCalls=0,guardCorrections=0,totalTurns=0,qualityAlerts=0,apiErrors=0;
let tokensIn=0,tokensOut=0;
async function modelReply(buyer,catalog,history,q){
 const api=await fetch("https://api.openai.com/v1/responses",{
  method:"POST",
  headers:{"Authorization":"Bearer "+env.OPENAI_API_KEY,
   "Content-Type":"application/json"},
  signal:AbortSignal.timeout(45000),
  body:JSON.stringify({
   model:"gpt-5.4-mini",store:false,max_output_tokens:460,
   reasoning:{effort:"none"},text:{format:crmResponseSchema},
   instructions:salesInstructions(catalog,{simulated:true,buyer})+
    "\n"+buyerGuidance(buyer,{catalog})+
    "\nPRUEBA PRIVADA: no tienes herramientas para crear pedidos, cotizar formalmente, cobrar, reservar, entregar ni asignar asesores. No afirmes que se realizó ninguna de esas acciones. Usa únicamente los datos del catálogo simulado y verifica cualquier disponibilidad antes de confirmar una compra.",
   input:selectCustomerPromptInput(history,q)
  })
 });
 apiCalls++;
 if(!api.ok)throw Error("OPENAI_HTTP_"+api.status);
 const result=await api.json();
 tokensIn+=result.usage?.input_tokens||0;
 tokensOut+=result.usage?.output_tokens||0;
 const text=(result.output||[]).filter(x=>x.type==="message"&&x.role==="assistant")
  .flatMap(x=>x.content||[]).filter(x=>x.type==="output_text")
  .map(x=>x.text).join("");
 const parsed=JSON.parse(text);
 if(typeof parsed.reply!=="string")throw Error("OPENAI_MISSING_REPLY");
 return parsed.reply;
}
async function simulate(s){
 let memory=null;
 const history=[];
 const trace=[];
 for(let i=0;i<s.turns.length;i++){
  const q=s.turns[i];
  try{
   // Re-read Supabase pilot data on every turn. No stale offer caching.
   const live=await currentCatalog();
   const preview=enrichCatalog(live.rows,true,live.offers);
   const preliminary=buildBuyerContext([q],{catalog:preview,memory});
   const qtyMap=Object.fromEntries((preliminary.draft_items||[])
    .map(x=>[x.partnumber,x.quantity]));
   const catalog=enrichCatalog(live.rows,true,live.offers,{
    requestedQuantity:preliminary.quantity||1,requestedQuantitiesByPn:qtyMap
   });
   const buyer=buildBuyerContext([q],{catalog,memory});
   const dayOffset=(s.id==="C16"&&i>=2)?5:0;
   const at=new Date(Date.UTC(2026,10,13+dayOffset,16,i)).toISOString();
   memory=snapshotSalesMemory(buyer,{
    previous:memory,lastMessageAt:at,lastMessageId:s.id+"-"+i
   });
   const raw=await modelReply(buyer,catalog,history,q);
   const guarded=protectSalesResponse(raw,{catalog,buyer,simulated:true});
   const answer=formatWhatsAppReply(guarded.reply,{simulated:true,maxChars:1300});
   const quality=reviewCommercialTurn({
    reply:answer,buyer,
    previousReplies:history.filter(x=>x.role==="assistant").map(x=>x.content)
   });
   const readiness=assessCommercialReadiness(buyer,{catalog,simulated:true});
   const noOps=!readiness.quoteCreated&&!readiness.orderCreated&&
    !readiness.paymentRegistered&&!readiness.advisorAssigned;
   if(!noOps)throw Error("UNAUTHORIZED_COMMERCIAL_OPERATION");
   if(guarded.blocked)guardCorrections++;
   if(quality.needsReview)qualityAlerts++;
   totalTurns++;
   trace.push({
    turn:i+1,customer:q,alex:answer,intent:buyer.current_intent,
    topic:buyer.current_topic,
    corrected:guarded.blocked,guardReason:guarded.reason||null,
    qualityNotes:quality.notes||[],
    draft:memory.draft_items,ambiguous:memory.draft_ambiguous,
    mathematicalTotal:readiness.demoBasket?.totalPen??null,
    allAvailable:readiness.demoBasket?.allAvailable??null,
    noQuoteOrderPayment:true
   });
   history.push({role:"user",content:q},{role:"assistant",content:answer});
  }catch(error){
   apiErrors++;
   trace.push({turn:i+1,customer:q,error:String(error?.message||error)});
   break;
  }
 }
 return {id:s.id,type:s.kind,persona:s.name,
  completed:trace.length===s.turns.length&&!trace.some(t=>t.error),
  decisionBySyntheticBuyer:s.kind==="decision",
  finalDraft:memory?.draft_items||[],turns:trace};
}
// Three concurrent full journeys; turns within a journey always sequential.
const buckets=[[],[],[]];
scenarios.forEach((s,i)=>buckets[i%3].push(s));
const result=(await Promise.all(buckets.map(async bucket=>{
 const out=[];for(const s of bucket)out.push(await simulate(s));return out;
}))).flat().sort((a,b)=>a.id.localeCompare(b.id));
const completed=result.filter(x=>x.completed).length;
const decisionBuyerResults=result.filter(x=>x.decisionBySyntheticBuyer);
const metrics={
 scenarios:result.length,completed,syntheticBuyerDecisions:decisionBuyerResults.length,
 decisionsWithCompletedDialogue:decisionBuyerResults.filter(x=>x.completed).length,
 actualOrders:0,actualPayments:0,crmWrites:0,whatsappSends:0,
 totalTurns,guardCorrections,qualityAlerts,apiErrors,apiCalls,
 inputTokens:tokensIn,outputTokens:tokensOut,
 source:"Supabase pilot read-only + OpenAI model per turn",
 simulatedPrices:true,realStockApproved:false
};
const report={generatedAt:new Date().toISOString(),metrics,
 pilotSkus:check.rows.map(x=>x.partnumber),journeys:result};
writeFileSync(process.env.ALEX_QA_IDS?"docs/ALEX-QA-RETEST-20261113.json":"docs/ALEX-QA-20-CHATS-20261113.json",JSON.stringify(report,null,2)+"\n");
console.log("ALEX_QA20_METRICS="+JSON.stringify(metrics));
for(const run of result){
 const t=run.turns.at(-1)||{};
 console.log("JOURNEY="+JSON.stringify({
  id:run.id,complete:run.completed,kind:run.type,
  turnCount:run.turns.length,finalDraft:run.finalDraft,
  lastQuestion:t.customer,lastAnswer:t.alex,
  lastGuard:t.guardReason,errors:run.turns.filter(x=>x.error)
 }));
}
if(completed!==scenarios.length||apiErrors)process.exitCode=1;
