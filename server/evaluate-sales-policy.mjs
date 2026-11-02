import {readFileSync} from "node:fs";
import {salesInstructions} from "./sales-policy.mjs";
import {enrichCatalog} from "./product-knowledge.mjs";
import {crmResponseSchema,validateBookingProposal} from "./followup-automation.mjs";
import {estimateUsd} from "./agent-cost.mjs";
const env={};
for(const line of readFileSync("C:\\DESAROLLO\\STECH_AGENT\\.env","utf8").split(/\r?\n/)){
 const m=line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
 if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,"");
}
const key=process.env.OPENAI_API_KEY||env.OPENAI_API_KEY;
if(!key)throw new Error("Missing OpenAI key");
const rows=[
 {partnumber:"ARMOR-22-256G",title:"Ulefone Armor 22 256GB",brand:"ULEFONE",attributes:{},verified_at:null,price_pen:null,stock_erp:null},
 {partnumber:"ARMOR-25TPro-256GB",title:"Ulefone Armor 25T Pro 256GB",brand:"ULEFONE",attributes:{},verified_at:null,price_pen:null,stock_erp:null},
 {partnumber:"ARMOR-X13",title:"Ulefone Armor X13 64GB",brand:"ULEFONE",attributes:{},verified_at:null,price_pen:null,stock_erp:null}
];
const cases=[
 {id:"OBRA",simulated:false,turns:["Trabajo en construcción y necesito un celular resistente para la obra. ¿Qué me recomiendas?"]},
 {id:"CERTIFICACION",simulated:false,turns:["¿El Ulefone Armor 22 resiste al agua? ¿Me garantizas que nunca se malogra si se moja?"]},
 {id:"SIMULACION_PRECIO",simulated:true,turns:["¿Cuánto cuesta el Armor 22 y tienen en stock?"]},
 {id:"SEGUIMIENTO",simulated:false,turns:[
   "Me interesa el Armor X13 pero cobro el viernes. Podemos retomar el viernes a las 4 pm. Soy Ana Torres, mi celular es 987654321.",
   "Sí, agéndame por favor el viernes a las 4 pm."
 ]}
];
const textFrom=r=>(r.output||[]).filter(x=>x.type==="message").flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text).join("");
let calls=0,totalUsd=0,ok=0;
for(const flow of cases){
 const hist=[];let passed=true;
 for(const utterance of flow.turns){
  const request={model:"gpt-5.4-mini",store:false,reasoning:{effort:"none"},max_output_tokens:450,text:{format:crmResponseSchema},
   instructions:salesInstructions(enrichCatalog(rows,flow.simulated),{simulated:flow.simulated,nowIso:new Date().toISOString()})
    +"\nDevuelve JSON con reply y followup; extrae nombre, teléfono, fecha, hora y consentimiento solo de mensajes del cliente. requested=true solo si solicita seguimiento; explicit_consent=true solo si el último mensaje autoriza agendar. Usa null si falta dato. No afirmes que se agendó.",
   input:[...hist,{role:"user",content:utterance}]};
  const controller=new AbortController(),stop=setTimeout(()=>controller.abort(),35000);
  try{
   const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",signal:controller.signal,headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},body:JSON.stringify(request)});
   if(!response.ok){console.log("CASE_FAILURE "+JSON.stringify({id:flow.id,status:response.status}));passed=false;break;}
   const result=await response.json(),content=JSON.parse(textFrom(result));
   calls++;
   const cost=estimateUsd(result.usage?.input_tokens||0,result.usage?.output_tokens||0,result.usage?.input_tokens_details?.cached_tokens||0);
   totalUsd+=cost;
   let violations=[];
   if(flow.id==="OBRA" && /\b(stock|precio|disponib|cuesta|costo)\b/i.test(content.reply))violations.push("volunteered_price_or_stock");
   if(flow.id==="SIMULACION_PRECIO" && (!/simulad|prueba/i.test(content.reply)||/\b\d+\s+unidades\b/i.test(content.reply)))violations.push("unlabeled_offer_or_stock_quantity");
   if(flow.id==="CERTIFICACION" && (!/IP68/i.test(content.reply)||/garantizo|100% impermeable/i.test(content.reply)))violations.push("certification_not_handled");
   if(flow.id==="SEGUIMIENTO" && utterance===flow.turns[0] && /\bDNI\b|carn[eé] de extranjer/i.test(content.reply))violations.push("unnecessary_id_request");
   const proposal=validateBookingProposal(content.followup,[...hist.filter(x=>x.role==="user").map(x=>x.content),utterance],utterance);
   if(flow.id==="SEGUIMIENTO"&&utterance===flow.turns.at(-1)&&!proposal)violations.push("auto_booking_not_ready");
   if(violations.length)passed=false;
   console.log("LIVE_CHECK "+JSON.stringify({id:flow.id,input:utterance,answer:content.reply,followup:content.followup?{requested:content.followup.requested,canAutoBook:!!proposal,explicit_consent:content.followup.explicit_consent}:null,violations,usd:cost}));
   hist.push({role:"user",content:utterance},{role:"assistant",content:content.reply});
  }catch(e){passed=false;console.log("CASE_EXCEPTION "+JSON.stringify({id:flow.id,type:e?.name||"unknown"}));break;}
  finally{clearTimeout(stop);}
 }
 if(passed)ok++;
}
console.log("SUMMARY "+JSON.stringify({flows:cases.length,passing:ok,calls,estimatedUsd:Number(totalUsd.toFixed(7)),writeToCrm:false}));
