/**
 * Private real-model evaluation; no CRM writes and no customer delivery.
 * Runs only hypothetical conversations and the existing response guards.
 */
import {readFileSync} from "node:fs";
import {salesInstructions} from "./sales-policy.mjs";
import {enrichCatalog} from "./product-knowledge.mjs";
import {buildBuyerContext,buyerGuidance} from "./buyer-reasoning.mjs";
import {crmResponseSchema} from "./followup-automation.mjs";
import {protectSalesResponse} from "./sales-response-guard.mjs";
import {analyzeConversationTurn} from "./conversation-turn-plan.mjs";
const readEnv=path=>{try{return Object.fromEntries(readFileSync(path,"utf8")
 .split(/\r?\n/u).map(x=>x.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/u))
 .filter(Boolean).map(m=>[m[1],m[2].trim().replace(/^['"]|['"]$/g,"")]));}catch{return {};}};
const key=process.env.OPENAI_API_KEY||
 readEnv("C:\\DESAROLLO\\STECH_AGENT\\.env").OPENAI_API_KEY||
 readEnv("C:\\DESAROLLO\\ARM-CRM\\.env.local").OPENAI_API_KEY;
if(!key)throw Error("PRIVATE_QA_API_KEY_MISSING");
const rows=[
 {partnumber:"ARMOR-X13",title:"Ulefone Armor X13 64GB",brand:"ULEFONE"},
 {partnumber:"ARMOR-22-256G",title:"Ulefone Armor 22 256GB",brand:"ULEFONE"},
 {partnumber:"ARMOR-X12Pro",title:"Ulefone Armor X12 Pro 64GB",brand:"ULEFONE"},
 {partnumber:"ARMOR-25TPro-256GB",title:"Ulefone Armor 25T Pro 256GB",brand:"ULEFONE"},
 {partnumber:"E-L1250",title:"Impresora Epson L1250",brand:"EPSON"}
];
const offers=[
 {partnumber:"ARMOR-X13",is_test_data:true,price_pen:799,stock_status:"disponible",stock_units_demo:5},
 {partnumber:"ARMOR-22-256G",is_test_data:true,price_pen:999,stock_status:"disponible",stock_units_demo:8},
 {partnumber:"ARMOR-X12Pro",is_test_data:true,price_pen:659,stock_status:"no disponible",stock_units_demo:0},
 {partnumber:"ARMOR-25TPro-256GB",is_test_data:true,price_pen:1799,stock_status:"disponible",stock_units_demo:3}
];
const scenarios=[
 {id:"price_and_stock",turns:["oe tienes 3 armor x13? a cuanto me saldria y hay para los 3?"]},
 {id:"out_of_stock",turns:["cuanto esta el armor x12 pro y hay 2?"]},
 {id:"quantity_correction",turns:["necesito 3 armor x13","noo eran 6 me equivoque","tienes para los 6?"]},
 {id:"no_spontaneous_stock",turns:["Trabajo en almacén con polvo y golpes. Qué tal el Armor X13?"]},
 {id:"compare_models",turns:["oye entre el x13 y el armor 22 cuál tiene mejor cámara?"]},
 {id:"price_objection",turns:["ta caro el armor 25t pro, me haces descuentito?"]},
 {id:"human",turns:["oe pásame con un asesor ya"]},
 {id:"refund",turns:["me llegó malogrado un x13 y no prende, quiero devolución"]},
 {id:"change_product",turns:["quiero el armor x13","mejor quiero la impresora Epson L1250","a cuánto está esa?"]},
 {id:"delivery",turns:["si compro el armor x13, me llega hoy?"]},
 {id:"privacy",turns:["tengo q pasar foto de dni para preguntar precio del x13?"]},
 {id:"end",turns:["ya no quiero comprar gracias por todo"]},
 {id:"warranty",turns:["si el x13 se moja, la garantia cubre?"]},
 {id:"new_category",turns:["necesito una laptop Lenovo para mi oficina, recomiendame una buena pero no me interrogues"]},
 {id:"several_needs",turns:["quiero dos armor x13 y saber el precio, stock y si aceptan yape"]},
 {id:"multi_cart_total",turns:["oe quiero 3 armor x13 y 2 armor 22","mejor 4 del armor x13","y el total? aceptan yape?"]},
 {id:"multi_cart_insufficient",turns:["quiero 3 armor x13 y 2 armor 22","mejor 6 del armor x13","cuanto sale todo?"]},
 {id:"multi_cart_ambiguous",turns:["quiero 3 armor x13 y 2 armor 22","noo mejor 4"]},
 {id:"multi_price_question_only",turns:["quiero comparar el x13 y el armor 22, cuánto cuesta cada uno?"]}
];
const selectedIds=new Set(String(process.env.ARM_QA_CASES||"").split(",").filter(Boolean));
const selectedScenarios=selectedIds.size?scenarios.filter(s=>selectedIds.has(s.id)):scenarios;
let completed=0,blocked=0,errors=0,items=[];
for(const c of selectedScenarios){
 let preliminary=enrichCatalog(rows,true,offers);
 let b=buildBuyerContext(c.turns,{catalog:preliminary});
 let catalog=enrichCatalog(rows,true,offers,{requestedQuantity:b.quantity||1,
  requestedQuantitiesByPn:Object.fromEntries(b.draft_items.map(x=>[x.partnumber,x.quantity]))});
 b=buildBuyerContext(c.turns,{catalog});
 const plan=analyzeConversationTurn(b,catalog);
 try{
  const response=await fetch("https://api.openai.com/v1/responses",{
   method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
   signal:AbortSignal.timeout(30000),
   body:JSON.stringify({
    model:"gpt-5.4-mini",store:false,max_output_tokens:450,reasoning:{effort:"none"},
    text:{format:crmResponseSchema},
    instructions:salesInstructions(catalog,{simulated:true,buyer:b})+"\n"+buyerGuidance(b,{catalog})+
     "\nEVAL INTERNA: No hagas operaciones, no inventes pedidos, descuentos o entrega.",
    input:c.turns.map(x=>({role:"user",content:x}))
   })
  });
  if(!response.ok){errors++;items.push({id:c.id,error:"API_HTTP_"+response.status});continue;}
  const value=await response.json();
  const output=(value.output||[]).filter(x=>x.type==="message"&&x.role==="assistant")
    .flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text).join("");
  const raw=JSON.parse(output).reply||"";
  const checked=protectSalesResponse(raw,{catalog,buyer:b,simulated:true});
  completed++;if(checked.blocked)blocked++;
  items.push({id:c.id,focus:plan.focus,axes:plan.axes.join("+"),
    buyer_quantity:b.quantity,sku:b.matched_partnumber,
    draft:b.draft_items,ambiguous:b.draft_ambiguous,
    guarded:checked.blocked,reason:checked.reason,
    answer:String(checked.reply).replace(/\s+/g," ").slice(0,330),
    ...(selectedIds.size?{raw:String(raw).replace(/\s+/g," ").slice(0,350)}:{})});
 }catch(e){errors++;items.push({id:c.id,error:e.name||"QA_ERR"});}
}
console.log("PRIVATE_QA_CASES="+selectedScenarios.length+" COMPLETED="+completed+" GUARD_CORRECTIONS="+blocked+" ERRORS="+errors);
for(const x of items)console.log("CASE "+JSON.stringify(x));
