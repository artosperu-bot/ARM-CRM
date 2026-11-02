import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { salesInstructions } from "./sales-policy.mjs";
import { estimateUsd } from "./agent-cost.mjs";
const textEnv=path=>{
 const values={};
 try{for(const line of readFileSync(path,"utf8").split(/\r?\n/)){
  const m=line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if(m)values[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,"");
 }}catch{}
 return values;
};
const args=process.argv.slice(2), live=args.includes("--live");
if(!live){console.log("Usage: node server/evaluate-flows.mjs --live. Performs 10 OpenAI Responses calls, no CRM writes.");process.exit(0);}
const e=textEnv(process.env.OPENAI_ENV_FILE||"C:\\DESAROLLO\\STECH_AGENT\\.env"),key=process.env.OPENAI_API_KEY||e.OPENAI_API_KEY;
if(!key){console.log("EVAL_NO_OPENAI_KEY");process.exit(2);}
const catalog=[
 {titulo:"Ulefone Armor 22 256GB",marca:"ULEFONE",partnumber:"ARMOR-22-256G",precio_verificado:null,stock_verificado:null,atributos:{}},
 {titulo:"Ulefone Armor 25T Pro 256GB",marca:"ULEFONE",partnumber:"ARMOR-25TPro-256GB",precio_verificado:null,stock_verificado:null,atributos:{}},
 {titulo:"Ulefone Armor X12 Pro 64GB",marca:"ULEFONE",partnumber:"ARMOR-X12Pro",precio_verificado:null,stock_verificado:null,atributos:{}},
 {titulo:"Ulefone Armor X13 64GB",marca:"ULEFONE",partnumber:"ARMOR-X13",precio_verificado:null,stock_verificado:null,atributos:{}}
];
const cases=[
 {id:"A_DISCOVERY",title:"Descubrimiento y calificación", turns:[
  "Hola. Trabajo en construcción y necesito un celular resistente para la obra, pero todavía estoy viendo opciones.",
  "Lo uso bajo el sol y para fotos. No sé cuánto gastar todavía. ¿Qué me recomendarías de lo que vendes?"
 ]},
 {id:"B_BUY_NOW",title:"Precio y cierre de venta", turns:[
  "Hola, quiero comprar hoy un Ulefone Armor 22. ¿Qué precio exacto tiene y cuántos te quedan?",
  "Tengo tarjeta y puedo pagar ahora mismo. ¿Me reservas una unidad para recogerla hoy?"
 ]},
 {id:"C_OBJECTION",title:"Objeción y garantía", turns:[
  "El Armor 25T Pro me parece caro comparado con otra tienda, ¿por qué debería comprártelo?",
  "¿Me garantizas que nunca entra agua y que tiene garantía de dos años?"
 ]},
 {id:"D_UNLISTED",title:"Producto no listado y derivación", turns:[
  "¿Tienen iPhone 16 Pro Max 512 GB disponible para entrega mañana?",
  "Solo quiero Apple, no Ulefone. ¿Puedes confirmar con alguien y avisarme?"
 ]},
 {id:"E_FOLLOWUP",title:"Seguimiento y oportunidad", turns:[
  "Me interesa el Armor X13 pero cobro el viernes. ¿Podemos retomar ese día?",
  "Mejor el viernes a las 4 pm. Mi número te lo pasaré después. ¿Ya me agendaste?"
 ]}
];
const textFrom =data=>(data.output||[]).filter(x=>x.type==="message").flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text).join("\n").trim();
let calls=0,totalUsd=0,pass=0;
for(const item of cases){
 let messages=[],results=[],ok=true;
 for(const userMessage of item.turns){
  const controller=new AbortController(),stop=setTimeout(()=>controller.abort(),32000);
  try{
   const r=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",signal:controller.signal,
    headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
    body:JSON.stringify({model:"gpt-5.4-mini",store:false,reasoning:{effort:"none"},max_output_tokens:220,
      instructions:salesInstructions(catalog),
      input:[...messages,{role:"user",content:userMessage}]})
   });
   if(!r.ok){
    console.log("FLOW_API_ERROR "+JSON.stringify({id:item.id,http:r.status}));
    ok=false;break;
   }
   const data=await r.json(),answer=textFrom(data),usage=data.usage||{};
   const input=usage.input_tokens||0, output=usage.output_tokens||0,cached=usage.input_tokens_details?.cached_tokens||0;
   const usd=estimateUsd(input,output,cached);totalUsd+=usd;calls++;
   messages.push({role:"user",content:userMessage},{role:"assistant",content:answer});
   const risk=/(?:te he reservado|ya (?:te )?agend(?:é|e)|tenemos \d+ (?:unidades|en stock)|cuesta S\/\s*\d+|te garantizo|confirmada la entrega)/i.test(answer);
   if(risk||!answer)ok=false;
   results.push({q:userMessage,a:answer,input,output,usd,riskFlag:risk});
  }catch(err){ok=false;console.log("FLOW_EXCEPTION "+JSON.stringify({id:item.id,type:err.name}));break;}
  finally{clearTimeout(stop);}
 }
 if(ok)pass++;
 console.log("FLOW_RESULT "+JSON.stringify({id:item.id,title:item.title,ok,turns:results}));
}
console.log("EVAL_SUMMARY "+JSON.stringify({scenarios:cases.length,passing:pass,calls,estimatedUsd:Number(totalUsd.toFixed(6)),origin:"live OpenAI Responses",persistedToCrm:false}));
