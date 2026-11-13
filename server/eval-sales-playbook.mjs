/**
 * Real-model, PRIVATE QA of the sales conversation logic.
 * No Meta calls, no CRM writes, no messages to customers, no real identities.
 * Models are hypothetical test catalogue entries: no price/stock assertions.
 * Run manually on PC020: node server/eval-sales-playbook.mjs
 */
import {readFileSync} from "node:fs";
import {salesInstructions} from "./sales-policy.mjs";
import {buildBuyerContext,buyerGuidance} from "./buyer-reasoning.mjs";
import {crmResponseSchema} from "./followup-automation.mjs";
import {protectSalesResponse} from "./sales-response-guard.mjs";
function readEnv(path){
 try{
  const rows={};
  for(const line of readFileSync(path,"utf8").split(/\r?\n/u)){
   const m=line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/u);
   if(m)rows[m[1]]=m[2].trim().replace(/^['"]|['"]$/gu,"");
  }
  return rows;
 }catch{return {};}
}
const key=process.env.OPENAI_API_KEY||
 readEnv("C:\\DESAROLLO\\STECH_AGENT\\.env").OPENAI_API_KEY||
 readEnv("C:\\DESAROLLO\\ARM-CRM\\.env.local").OPENAI_API_KEY;
if(!key)throw new Error("QA_OPENAI_CREDENTIAL_UNAVAILABLE");
const catalogue=[
 {titulo:"Impresora Hogar A4 - ficha de prueba",marca:"MARCA-QA",partnumber:"QA-PRINT-001",
  especificaciones_fabricante:null,atributos_ficha:{},precio_soles:null,disponibilidad:"por confirmar"},
 {titulo:"Silla de escritorio - ficha de prueba",marca:"MARCA-QA",partnumber:"QA-SEAT-001",
  especificaciones_fabricante:null,atributos_ficha:{},precio_soles:null,disponibilidad:"por confirmar"},
 {titulo:"Suite de ofimática - ficha de prueba",marca:"MARCA-QA",partnumber:"QA-SOFT-001",
  especificaciones_fabricante:null,atributos_ficha:{},precio_soles:null,disponibilidad:"por confirmar"},
 {titulo:"Cargador USB-C - ficha de prueba",marca:"MARCA-QA",partnumber:"QA-CHARGE-001",
  especificaciones_fabricante:null,atributos_ficha:{},precio_soles:null,disponibilidad:"por confirmar"}
];
const scenarios=[
 {name:"necesidad_hogar",turns:["Hola, busco una impresora para mi casa, ¿qué me recomiendas?"]},
 {name:"uso_ya_explicado",turns:["Busco una silla de escritorio","La necesito para estudiar varias horas. ¿Cuál me recomiendas?"]},
 {name:"objecion_de_precio",turns:["Quiero una suite de ofimática","Me parece muy caro, ¿tienen algún descuento?"]},
 {name:"cliente_decidido",turns:["Busco un cargador USB-C","Ya elegí, lo compro. ¿Dónde pago?"]},
 {name:"cancelacion",turns:["Quiero una silla para el escritorio","Mejor ya no voy a comprar, gracias."]},
 {name:"compatibilidad_incierta",turns:["Quiero un cargador para mi equipo pero no sé qué potencia usa. ¿Cuál compro?"]}
];
let succeeded=0,blocks=0,totalInput=0,totalOutput=0;
for(const case_ of scenarios){
 const buyer=buildBuyerContext(case_.turns,{catalog:catalogue});
 const response=await fetch("https://api.openai.com/v1/responses",{
  method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},
  body:JSON.stringify({
   model:"gpt-5.4-mini",store:false,max_output_tokens:420,reasoning:{effort:"none"},
   text:{format:crmResponseSchema},
   instructions:salesInstructions(catalogue,{simulated:false})+"\n"+buyerGuidance(buyer,{catalog:catalogue})+
    "\nENTORNO DE QA: No ejecutes operaciones ni envíes mensajes. Responde con JSON reply y followup. No inventes garantías, precio, compatibilidad ni entregas.",
   input:case_.turns.map(x=>({role:"user",content:x}))
  })
 });
 if(!response.ok){console.log("CASE="+case_.name+" OPENAI_HTTP="+response.status);continue;}
 const data=await response.json();
 const raw=(data.output||[]).filter(x=>x.type==="message"&&x.role==="assistant")
  .flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text).join("");
 let reply;
 try{reply=JSON.parse(raw).reply;}catch{console.log("CASE="+case_.name+" MALFORMED_MODEL_OUTPUT");continue;}
 const guard=protectSalesResponse(reply,{catalog:catalogue,buyer});
 if(guard.blocked)blocks++;
 succeeded++;
 totalInput+=data.usage?.input_tokens||0;
 totalOutput+=data.usage?.output_tokens||0;
 console.log("CASE="+case_.name+" STAGE="+buyer.current_intent+
   " BLOCKED="+guard.blocked+" REASON="+(guard.reason||"none"));
 console.log("REPLY="+String(guard.reply||"").replace(/\s+/gu," ").slice(0,380));
}
console.log("QA_CASES_COMPLETED="+succeeded+" EXPECTED="+scenarios.length);
console.log("QA_GUARD_BLOCKS="+blocks);
console.log("QA_INPUT_TOKENS="+totalInput+" QA_OUTPUT_TOKENS="+totalOutput);
console.log("WHATSAPP_MESSAGES_SENT=0 CRM_WRITES=0");
