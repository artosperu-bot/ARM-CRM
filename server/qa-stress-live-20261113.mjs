/**
 * Private ALEX 20-category matrix. Supabase read-only source:
 * arm_qa_catalog_products (16 service-role-only fixtures) + original four
 * Ulefone pilots and their offer simulations. No writes to CRM or Meta.
 */
import {readFileSync,writeFileSync} from "node:fs";
import {createClient} from "@supabase/supabase-js";
import {stressJourneys20 as categoryJourneys20} from "./qa-stress-scenarios-20261113.mjs";
import {enrichCatalog} from "./product-knowledge.mjs";
import {buildBuyerContext,buyerGuidance} from "./buyer-reasoning.mjs";
import {snapshotSalesMemory} from "./sales-memory.mjs";
import {protectSalesResponse} from "./sales-response-guard.mjs";
import {assessCommercialReadiness} from "./commercial-readiness.mjs";
import {salesInstructions} from "./sales-policy.mjs";
import {formatWhatsAppReply} from "./whatsapp-format.mjs";
import {crmResponseSchema} from "./followup-automation.mjs";
import {selectCustomerPromptInput} from "./customer-topic.mjs";
const cleanEnv=file=>{const x={};try{for(const s of readFileSync(file,"utf8").split(/\r?\n/u)){
 const m=s.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/u);
 if(m)x[m[1]]=m[2].trim().replace(/^['"]|['"]$/gu,"");
}}catch{}return x;};
const env={...cleanEnv("C:\\DESAROLLO\\n8n\\backend\\.env"),
 ...cleanEnv("C:\\DESAROLLO\\STECH_AGENT\\.env"),
 ...cleanEnv("C:\\DESAROLLO\\ARM-CRM\\.env.local"),...process.env};
const url=env.SUPABASE_URL||env.VITE_SUPABASE_URL;
if(!url||!env.SUPABASE_SERVICE_ROLE_KEY||!env.OPENAI_API_KEY)
 throw Error("QA_CONFIG_MISSING");
const db=createClient(url,env.SUPABASE_SERVICE_ROLE_KEY,{
 auth:{persistSession:false,autoRefreshToken:false}
});
const {data:workspaces,error:e}=await db.from("arm_workspaces").select("id,name")
 .eq("name","STECH PERU").limit(1);
if(e||workspaces?.length!==1)throw Error("WORKSPACE_UNAVAILABLE");
const workspace=workspaces[0].id;
const legacySku=["ARMOR-X13","ARMOR-X12Pro","ARMOR-22-256G","ARMOR-25TPro-256GB"];
async function fixtures(){
 const [{data:test,error:a},{data:legacy,error:b},{data:oldOffers,error:c}]=await Promise.all([
  db.from("arm_qa_catalog_products").select(
   "workspace_id,partnumber,title,brand,category_path,family_key,variant_options,attributes,demo_price_pen,demo_stock_units,demo_stock_status,is_test_data")
   .eq("workspace_id",workspace).eq("is_test_data",true).order("partnumber"),
  db.from("arm_products").select(
   "workspace_id,partnumber,title,brand,category_path,family_key,variant_options,attributes")
   .eq("workspace_id",workspace).in("partnumber",legacySku).limit(4),
  db.from("arm_offer_simulations").select(
   "workspace_id,partnumber,price_pen,stock_status,stock_units_demo,is_test_data")
   .eq("workspace_id",workspace).eq("is_test_data",true).in("partnumber",legacySku)
 ]);
 if(a||b||c)throw Error("SUPABASE_READ_ONLY_FIXTURE_FETCH_ERROR");
 if(test?.length!==16||legacy?.length!==4||oldOffers?.length!==4)
  throw Error("QA_MATRIX_EXPECTED_16_PLUS_4");
 if(test.some(x=>x.is_test_data!==true||!x.partnumber.startsWith("QA-")||
    x.attributes?.qa_only!==true))throw Error("QA_ISOLATION_FAILED");
 const catGroups=new Map();
 for(const x of test){
  const key=x.category_path.join(" > ");
  catGroups.set(key,(catGroups.get(key)||0)+1);
 }
 if(catGroups.size!==8||[...catGroups.values()].some(n=>n!==2))
  throw Error("QA_WRONG_CATEGORY_DISTRIBUTION");
 const products=[...legacy,...test];
 const offers=[...oldOffers,...test.map(x=>({
  partnumber:x.partnumber,price_pen:x.demo_price_pen,
  stock_status:x.demo_stock_status,stock_units_demo:x.demo_stock_units,
  is_test_data:true
 }))];
 return {products,offers,categories:[...catGroups.keys()]};
}
const initial=await fixtures();
let inputTokens=0,outputTokens=0,guardCorrections=0,apiErrors=0,turns=0;
async function callAlex(buyer,catalog,history,message){
 const response=await fetch("https://api.openai.com/v1/responses",{
  method:"POST",headers:{"Authorization":"Bearer "+env.OPENAI_API_KEY,
    "Content-Type":"application/json"},signal:AbortSignal.timeout(45000),
  body:JSON.stringify({
   model:"gpt-5.4-mini",store:false,max_output_tokens:380,
   reasoning:{effort:"none"},text:{format:crmResponseSchema},
   instructions:salesInstructions(catalog,{simulated:true,buyer})+
    "\n"+buyerGuidance(buyer,{catalog})+
    "\nEVALUACION PRIVADA DE VARIAS CATEGORIAS: No hay pedido, cotización formal, pago, reserva, asignación ni contacto saliente. El precio/stock es únicamente sintético desde Supabase. Para especificaciones, compatibilidad, entregas y certificaciones no verificadas, explica límites y no inventes datos. No asumas que comparar agrega producto.",
   input:selectCustomerPromptInput(history,message)
  })
 });
 if(!response.ok)throw Error("MODEL_HTTP_"+response.status);
 const payload=await response.json();
 inputTokens+=payload.usage?.input_tokens||0;
 outputTokens+=payload.usage?.output_tokens||0;
 const result=(payload.output||[]).filter(x=>x.type==="message"&&x.role==="assistant")
  .flatMap(x=>x.content||[]).filter(x=>x.type==="output_text")
  .map(x=>x.text).join("");
 const parsed=JSON.parse(result);
 if(typeof parsed.reply!=="string")throw Error("MODEL_MISSING_REPLY");
 return parsed.reply;
}
async function run(scenario){
 let memory=null;
 const history=[],trace=[];
 for(let i=0;i<scenario.turns.length;i++){
  const message=scenario.turns[i];
  try{
   const current=await fixtures();
   let catalog=enrichCatalog(current.products,true,current.offers);
   const preliminary=buildBuyerContext([message],{catalog,memory});
   catalog=enrichCatalog(current.products,true,current.offers,{
    requestedQuantity:preliminary.quantity||1,
    requestedQuantitiesByPn:Object.fromEntries(
     preliminary.draft_items.map(x=>[x.partnumber,x.quantity]))
   });
   const buyer=buildBuyerContext([message],{catalog,memory});
   memory=snapshotSalesMemory(buyer,{previous:memory,
    lastMessageAt:new Date(Date.UTC(2026,10,13,20,i)).toISOString(),
    lastMessageId:scenario.id+"-"+i});
   const raw=await callAlex(buyer,catalog,history,message);
   const guarded=protectSalesResponse(raw,{catalog,buyer,simulated:true});
   if(guarded.blocked)guardCorrections++;
   const reply=formatWhatsAppReply(guarded.reply,{simulated:true,maxChars:1300});
   const readiness=assessCommercialReadiness(buyer,{catalog,simulated:true});
   if(readiness.quoteCreated||readiness.orderCreated||readiness.paymentRegistered||
      readiness.advisorAssigned)throw Error("COMMERCIAL_OPERATION_NOT_ALLOWED");
   const step={
    turn:i+1,customer:message,reply,
    memory:memory.draft_items,focus:memory.draft_focus,
    ambiguous:memory.draft_ambiguous,
    guardReason:guarded.reason||null,
    total:readiness.demoBasket?.totalPen??null,
    available:readiness.demoBasket?.allAvailable??null
   };
   trace.push(step);turns++;
   history.push({role:"user",content:message},{role:"assistant",content:reply});
  }catch(error){
   apiErrors++;
   trace.push({turn:i+1,customer:message,error:String(error?.message||error)});
   break;
  }
 }
 console.log("COMPLETE "+scenario.id+" "+trace.length+"/"+scenario.turns.length+
  " DRAFT="+JSON.stringify(memory?.draft_items||[])+" ERROR="+
  JSON.stringify(trace.find(x=>x.error)?.error||null));
 return {id:scenario.id,label:scenario.label,
  completed:trace.length===scenario.turns.length&&!trace.some(x=>x.error),
  trace};
}
const selected=new Set(String(process.env.ALEX_CATEGORY_IDS||"").split(",").filter(Boolean));
const pool=selected.size?categoryJourneys20.filter(x=>selected.has(x.id)):categoryJourneys20;
const buckets=[[],[],[],[]];
pool.forEach((s,i)=>buckets[i%4].push(s));
const executions=(await Promise.all(buckets.map(async batch=>{
 const result=[];for(const s of batch)result.push(await run(s));return result;
}))).flat().sort((a,b)=>a.id.localeCompare(b.id));
const metrics={
 cases:pool.length,completed:executions.filter(x=>x.completed).length,
 turns,modelCalls:turns,apiErrors,guardCorrections,inputTokens,outputTokens,
 products:20,newQaProducts:initial.products.length-4,
 categories:initial.categories.length,commercialWrites:0,
 whatsappSends:0,orderCreated:0,paymentRegistered:0
};
const report={generatedAt:new Date().toISOString(),metrics,
 categories:initial.categories,executions};
const reportPath=process.env.ALEX_QA_OUTPUT&&
 process.env.ALEX_QA_OUTPUT.startsWith("docs/ALEX-QA-")&&
 process.env.ALEX_QA_OUTPUT.endsWith(".json")&&
 !process.env.ALEX_QA_OUTPUT.includes("..")?
 process.env.ALEX_QA_OUTPUT:selected.size?"docs/ALEX-QA-STRESS-RETEST-20261113.json":
 "docs/ALEX-QA-STRESS-20-20261113.json";
writeFileSync(reportPath,JSON.stringify(report,null,2)+"\n");
console.log("FINAL_METRICS="+JSON.stringify(metrics));
if(metrics.completed!==pool.length)process.exitCode=1;
