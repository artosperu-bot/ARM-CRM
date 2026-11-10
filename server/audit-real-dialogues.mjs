/**
 * ALEX real-model conversational QA. 100% synthetic, NO CRM/Meta writes.
 * Sequential turns per scenario preserve the assistant's actual answers.
 * Hard rules are separate from qualitative human review.
 */
import {readFileSync} from "node:fs";
import {buildBuyerContext,buyerGuidance} from "./buyer-reasoning.mjs";
import {snapshotSalesMemory} from "./sales-memory.mjs";
import {isExplicitProductSwitch} from "./customer-topic.mjs";
import {matchCustomerProduct} from "./catalog-matching.mjs";
import {salesInstructions} from "./sales-policy.mjs";
import {reviewCommercialTurn} from "./commercial-service-standard.mjs";
import {protectSalesResponse} from "./sales-response-guard.mjs";
import {formatWhatsAppReply} from "./whatsapp-format.mjs";
import {crmResponseSchema} from "./followup-automation.mjs";
function envFile(file){const x={};try{for(const line of readFileSync(file,"utf8").split(/\r?\n/u)){const m=line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/u);if(m)x[m[1]]=m[2].trim().replace(/^['"]|['"]$/gu,"");}}catch{}return x;}
const env={...envFile("C:\\DESAROLLO\\STECH_AGENT\\.env"),...envFile("C:\\DESAROLLO\\ARM-CRM\\.env.local"),...process.env};
if(!env.OPENAI_API_KEY)throw Error("OPENAI_TEST_KEY_UNAVAILABLE");
const catalog=[
 {titulo:"Ulefone Armor 22 256GB",marca:"ULEFONE",partnumber:"ARMOR-22-256G",precio_soles:null,disponibilidad:"por confirmar",especificaciones_fabricante:{certificaciones:"IP68/IP69K; sujeto a límites de fabricante",bateria:"6600 mAh"},nivel_evidencia:"ficha_fabricante"},
 {titulo:"Impresora Epson EcoTank L1250",marca:"EPSON",partnumber:"E-L1250",precio_soles:null,disponibilidad:"por confirmar",especificaciones_fabricante:null,nivel_evidencia:"sin_ficha_verificada"},
 {titulo:"Laptop Lenovo ThinkPad T14 16 GB",marca:"LENOVO",partnumber:"T14-16",precio_soles:null,disponibilidad:"por confirmar",especificaciones_fabricante:null,nivel_evidencia:"sin_ficha_verificada"},
 {titulo:"Laptop Lenovo ThinkPad T14 32 GB",marca:"LENOVO",partnumber:"T14-32",precio_soles:null,disponibilidad:"por confirmar",especificaciones_fabricante:null,nivel_evidencia:"sin_ficha_verificada"},
 {titulo:"Microsoft Office Home 2024",marca:"MICROSOFT",partnumber:"OH2024",precio_soles:null,disponibilidad:"por confirmar",especificaciones_fabricante:null,nivel_evidencia:"sin_ficha_verificada"},
 {titulo:"Microsoft Office LTSC Standard 2024",marca:"MICROSOFT",partnumber:"OL2024",precio_soles:null,disponibilidad:"por confirmar",especificaciones_fabricante:null,nivel_evidencia:"sin_ficha_verificada"},
 {titulo:"Cargador USB-C",marca:"ANONIMO",partnumber:"CARGADOR-A",precio_soles:null,disponibilidad:"por confirmar",especificaciones_fabricante:null,nivel_evidencia:"sin_ficha_verificada"}
];
const allScenarios=[
 {name:"IMPRESORA_CASA",turns:["Busco impresora para tareas de mis hijos, para la casa","¿Y cuánto cuesta la Epson L1250?","Gracias por todo"]},
 {name:"LAPTOP_AMBIGUA",turns:["Estoy viendo laptops Lenovo ThinkPad T14","¿Cuál de las dos conviene para trabajar con varias aplicaciones?"]},
 {name:"LICENCIA_SOFTWARE",turns:["Necesito Office para Windows 10","¿La licencia es para siempre o se renueva?"]},
 {name:"PRECIO_Y_DESCUENTO",turns:["¿Cuánto cuesta la Ulefone Armor 22?","Muy caro, ¿me das 30% de descuento?"]},
 {name:"PRODUCTO_NO_EXISTE",turns:["¿Venden impresora Brother HL-L2340?","¿Me confirma el precio exacto?"]},
 {name:"CARGADOR_COMPATIBILIDAD",turns:["Necesito un cargador USB-C para mi laptop Lenovo","Es de 65W, ¿el cargador que tienes sirve?"]},
 {name:"DESISTIMIENTO",turns:["Quiero la laptop Lenovo para la oficina","Ya no voy a comprar, gracias"]},
 {name:"DECISION_COMPRAR",turns:["Quiero el Armor 22","Listo, lo compro, ¿dónde pago?"]},
 {name:"SEGUIMIENTO_Y_PRIVACIDAD",turns:["Necesito una impresora para mi trabajo","No quiero dar mi DNI, ¿igual puedo consultar?"]},
 {name:"CAMBIO_CANTIDAD",turns:["Quiero 3 laptops para mi oficina con presupuesto de S/ 12000 en total","Mejor 2 laptops","¿Puedes cotizar?"]},
 {name:"PIDE_ASESOR",turns:["Quiero hablar con un asesor","¿Ya le avisaste?"]},
 {name:"ENTREGA_URGENTE",turns:["Necesito la impresora Epson L1250 hoy mismo","¿Me confirmas entrega hoy?"]},
 {name:"MEMORIA_COTIZACION",turns:[
  "Quiero 3 laptops Lenovo con un presupuesto de S/ 12000 en total",
  "Mejor 2 laptops",
  "Es para trabajar con varias aplicaciones",
  "¿Cuál configuración me conviene?",
  "¿Puedes cotizar las 2?"
 ]},
 {name:"CAMBIO_MODELO_DESCONOCIDO",turns:[
  "¿Cuál es el precio del Armor 22?",
  "Mejor quiero la Brother HL-L2340",
  "¿Y su precio exacto?"
 ]},
 {name:"ASESOR_PERSISTENTE",turns:[
  "Quiero hablar con un asesor",
  "¿Ya le avisaste?",
  "Quiero que me atienda una persona, por favor"
 ]},
 {name:"CLIENTE_DECIDIDO_SIN_COMPARAR",turns:[
  "Me interesa la Epson L1250 para imprimir documentos en mi tienda, no quiero comparar",
  "Necesito 2 unidades, ¿cuál es el siguiente paso para comprarlas?"
 ]},
 {name:"ATENCION_CON_POCO_TIEMPO",turns:[
  "Estoy trabajando, tengo un minuto. Busco el Ulefone Armor 22 para reparto. Explícame rápido y sin tanto tecnicismo.",
  "Me gustó el modelo. No me muestres otros, solo dime qué me aporta."
 ]},
 {name:"CLIENTE_SIN_PRESION",turns:[
  "Estoy viendo una laptop Lenovo para oficina, recién estoy averiguando",
  "Gracias, por ahora lo voy a pensar"
 ]},
 {name:"LICENCIAS_SIN_ASUMIR",turns:[
  "Busco Microsoft Office Home 2024 para mis documentos personales",
  "¿Debo pagar cada año o es otra modalidad? Háblame normal."
 ]},
 {name:"GARANTIA_SOLO_SI_PREGUNTA",turns:[
  "¿Recomiendas el Armor 22 para llevar al trabajo?",
  "Y si se moja, ¿qué significa IP68? ¿La garantía cubre daños por agua?"
 ]},
 {name:"SALTO_TEMAS_FACTURA",turns:[
  "Quiero dos Ulefone Armor 22 para mi negocio",
  "Oye, otra cosa, ¿emiten factura electrónica y se puede pagar con tarjeta?",
  "Ya, volviendo a los 2 celulares, ¿cuánto salen?"
 ]},
 {name:"POSTVENTA_IMPRESORA",turns:[
  "Compré una Epson L1250 antes y ahora no imprime negro, ¿qué hago?",
  "La compré con ustedes, ¿me la cambian inmediatamente o devuelven mi plata?",
  "¿Ya me abriste un reclamo?"
 ]},
 {name:"TEMA_AJENO_Y_REGRESO",turns:[
  "Busco una laptop Lenovo para mi negocio",
  "Oye cambiando de tema, ¿quién ganó el partido de fútbol de ayer?",
  "Ya, volviendo a la laptop, ¿cuál era el modelo que estábamos viendo?"
 ]},
 {name:"CAMBIO_CATEGORIA_ACCESORIO",turns:[
  "Busco cargador USB-C para mi laptop Lenovo",
  "Pero ahora estoy viendo una tablet Samsung, ¿cuál me recomiendas?",
  "Regresemos al cargador Lenovo de 65W, ¿ese que tienes sirve?"
 ]},
 {name:"PRIVACIDAD_DOCUMENTOS",turns:[
  "Me interesa una impresora Epson L1250",
  "¿Necesitas foto de mi DNI o mi RUC para responderme?",
  "¿Y cómo funciona la garantía?"
 ]},
 {name:"EXPLICACION_TERMINOS",turns:[
  "¿Qué significan SSD y RAM en una laptop?",
  "Entonces para Excel y documentos, ¿cuál de las Lenovo me recomiendas?"
 ]}
];
const requested=(process.env.ALEX_QA_CASES||"").split(",").map(x=>x.trim()).filter(Boolean);
const scenarios=requested.length?allScenarios.filter(x=>requested.includes(x.name)):allScenarios;
if(!scenarios.length)throw new Error("UNKNOWN_QA_CASE_SELECTION");
const prompt=(buyer,products=catalog)=>salesInstructions(products,{simulated:false,buyer})+"\n"+buyerGuidance(buyer,{catalog:products})+
 "\nPRUEBA SINTÉTICA PRIVADA. Contesta normalmente al cliente con JSON reply/followup. No existe herramienta de pedidos, cobros ni seguimientos salientes. No inventes datos, cotizaciones, precios, entregas o contactos humanos.";
let completed=0,valid=0,blocked=0,requests=0,usedInput=0,usedOutput=0;
async function execute(s){
 const history=[],texts=[];
 let memory=null;
 const report=[];
 for(let i=0;i<s.turns.length;i++){
  const question=s.turns[i];texts.push(question);
  // Simulate retrieval scope: a new product request must not inherit unrelated
  // product candidates from earlier turns, even though those remain in history.
  const turnCatalog=isExplicitProductSwitch(question)?
    catalog.filter(p=>Boolean(matchCustomerProduct(question,[p]))):catalog;
  const buyer=buildBuyerContext(memory?[question]:texts,{catalog:turnCatalog,memory});
  memory=snapshotSalesMemory(buyer,{
    previous:memory,lastMessageAt:new Date(Date.UTC(2026,10,7,19,0,i)).toISOString(),
    lastMessageId:s.name+"-"+i
  });
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),30000);
  let result;
  try{
   const api=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",signal:ctrl.signal,
    headers:{"Authorization":"Bearer "+env.OPENAI_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({model:"gpt-5.4-mini",store:false,max_output_tokens:380,reasoning:{effort:"none"},
      text:{format:crmResponseSchema},instructions:prompt(buyer,turnCatalog),
      input:[...history,{role:"user",content:question}]})
   });
   requests++;
   if(!api.ok){report.push({turn:i+1,q:question,error:"HTTP_"+api.status});break;}
   result=await api.json();
  }catch(e){report.push({turn:i+1,q:question,error:e?.name||"OPENAI_EXCEPTION"});break;}
  finally{clearTimeout(timer);}
  const out=(result.output||[]).filter(x=>x.type==="message"&&x.role==="assistant")
    .flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text).join("");
  let body;try{body=JSON.parse(out).reply;}catch{report.push({turn:i+1,q:question,error:"NON_JSON"});break;}
  const guard=protectSalesResponse(body,{catalog:turnCatalog,buyer});
  const reply=formatWhatsAppReply(guard.reply,{simulated:false,maxChars:1300});
  if(guard.blocked)blocked++;
  usedInput+=result.usage?.input_tokens||0;usedOutput+=result.usage?.output_tokens||0;
  const nQuestions=(reply.match(/[?¿]/gu)||[]).filter(c=>c==="?").length;
  const quality=reviewCommercialTurn({reply,buyer,
    previousReplies:history.filter(x=>x.role==="assistant").map(x=>x.content)});
  report.push({turn:i+1,q:question,intent:buyer.current_intent,reply,
    guard:guard.reason,questions:nQuestions,qualityNotes:quality.notes,
    qualityNeedsReview:quality.needsReview,needsHuman:buyer.requires_human,
    rememberedQuantity:memory.quantity,rememberedBudget:memory.budget?.pen||null,
    rememberedSku:memory.selected_partnumber});
  history.push({role:"user",content:question},{role:"assistant",content:reply});
  valid++;
 }
 completed++;
 return {case:s.name,turns:report};
}
// Bounded concurrency (3) without requiring any third-party orchestrator.
const tasks=[[],[],[]];scenarios.forEach((s,i)=>tasks[i%3].push(s));
const all=await Promise.all(tasks.map(async q=>{const out=[];for(const s of q)out.push(await execute(s));return out;}));
for(const c of all.flat()) console.log("DIALOGUE="+JSON.stringify(c));
console.log("AUDIT_CASES="+completed+" TOTAL="+scenarios.length);
console.log("AUDIT_TURNS_VALID="+valid+" BLOCKS="+blocked+" REQUESTS="+requests);
console.log("TOTAL_INPUT_TOKENS="+usedInput+" TOTAL_OUTPUT_TOKENS="+usedOutput);
console.log("META_SENT=0 CRM_WRITES=0");
