import {createClient} from "@supabase/supabase-js";
import {salesInstructions} from "./sales-policy.mjs";
import {enrichCatalog} from "./product-knowledge.mjs";
import {crmResponseSchema} from "./followup-automation.mjs";
import {estimateUsd} from "./agent-cost.mjs";
import {whatsappPresentationInstructions,formatWhatsAppReply} from "./whatsapp-format.mjs";
import {buildBuyerContext,buyerGuidance} from "./buyer-reasoning.mjs";
import {protectSalesResponse} from "./sales-response-guard.mjs";

function textFrom(response){
  return (response.output||[]).filter(o=>o.type==="message"&&o.role==="assistant")
    .flatMap(o=>o.content||[]).filter(o=>o.type==="output_text").map(o=>o.text).join("\n").trim();
}
function normalizeTestPhone(v){return String(v||"").replace(/\D/g,"");}
export function createWhatsAppTestResponder({
  supabaseUrl,serviceRoleKey,openaiKey,whatsappToken,phoneId,allowedNumbers=[],
  testOffers=false,graphVersion="v25.0",maxDaily=12,db=null,fetcher=fetch
}={}){
 if((!db&&(!supabaseUrl||!serviceRoleKey))||!openaiKey||!whatsappToken||!phoneId)
   return null;
 const client=db||createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const allowed=new Set(allowedNumbers.map(normalizeTestPhone).filter(Boolean));
 return async function replyToTestNumber(event,leadProfile=null){
  if(!event||event.phoneNumberId!==phoneId||!allowed.has(event.sender)||!event.text)
    return {status:"blocked"};
  // Never send outside the fresh customer-initiated conversation window.
  if(event.timestamp*1000<Date.now()-60*60*1000 || event.timestamp*1000>Date.now()+120000)
    return {status:"stale"};
  const {data:thread,error:threadError}=await client.from("arm_threads")
    .select("id,workspace_id,contact_id,status,assigned_to")
    .eq("channel","whatsapp").eq("external_account_ref",phoneId)
    .eq("external_sender_id",event.sender).maybeSingle();
  if(threadError||!thread)throw new Error("ARM_THREAD_LOOKUP_FAILED");
  // Human handoff or finished tickets always take precedence over AI.
  if(thread.status!=="pending"||thread.assigned_to)return {status:"human_handoff"};
  const today=new Date().toISOString().slice(0,10)+"T00:00:00Z";
  const {count,error:countError}=await client.from("arm_ai_usage")
    .select("id",{count:"exact",head:true}).eq("workspace_id",thread.workspace_id)
    .eq("source","arm_agent").eq("node","whatsapp_test").gte("occurred_at",today);
  if(countError)throw new Error("ARM_USAGE_CHECK_FAILED");
  if((count||0)>=maxDaily)return {status:"daily_limit"};
  const [recent,first,products,offers]=await Promise.all([
    client.from("arm_messages").select("id,direction,content,created_at").eq("thread_id",thread.id)
      .order("created_at",{ascending:false}).limit(24),
    client.from("arm_messages").select("id,direction,content,created_at").eq("thread_id",thread.id)
      .order("created_at",{ascending:true}).limit(2),
    client.from("arm_products").select("title,brand,partnumber,attributes,price_pen,stock_erp,verified_at")
      .eq("workspace_id",thread.workspace_id).limit(25),
    testOffers?client.from("arm_offer_simulations").select("partnumber,price_pen,stock_status,is_test_data")
      .eq("workspace_id",thread.workspace_id).eq("is_test_data",true).limit(25):
      Promise.resolve({data:[],error:null})
  ]);
  if(recent.error||first.error||products.error||offers.error)throw new Error("ARM_CONTEXT_READ_FAILED");
  // Last 8 turns + original intent, no extra LLM calls.
  const history=new Map();
  for(const m of [...(first.data||[]),...(recent.data||[])]){
    if(!m?.id||!m.content||!["inbound","outbound"].includes(m.direction))continue;
    history.set(m.id,m);
  }
  const ordered=[...history.values()].sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)))
    .map(m=>({role:m.direction==="inbound"?"user":"assistant",content:m.content}));
  const catalog=enrichCatalog(products.data||[],testOffers,offers.data||[]);
  // The latest inbound turn always drives the response. Long-lived facts are
  // reconstructed from the earliest need and latest 24 messages at no extra AI cost.
  const buyerTurns=ordered.filter(x=>x.role==="user").map(x=>x.content);
  if(buyerTurns.at(-1)!==event.text)buyerTurns.push(event.text);
  const buyer=buildBuyerContext(buyerTurns,{leadProfile,catalog});
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
  let result;
  try{
    const response=await fetcher("https://api.openai.com/v1/responses",{
      method:"POST",signal:controller.signal,
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+openaiKey},
      body:JSON.stringify({
        model:"gpt-5.4-mini",store:false,max_output_tokens:450,reasoning:{effort:"none"},
        text:{format:crmResponseSchema},
        instructions:salesInstructions(catalog,{simulated:testOffers,nowIso:new Date().toISOString()})+
          "\n"+whatsappPresentationInstructions()+"\n"+buyerGuidance(buyer,{catalog})+
          (leadProfile?("\nCONTEXTO COMERCIAL INTERNO: señal="+String(leadProfile.intent||"consulta_general")+
           "; B2B="+Boolean(leadProfile.is_b2b)+"; cantidad de equipos confirmada="+
           (Number.isInteger(leadProfile.quantity_min)?leadProfile.quantity_min:"no confirmada")+
           ". Utiliza estas señales solamente como hipótesis para orientar la respuesta. NO reveles puntuaciones ni etiquetas internas; confirma antes de tratar al cliente como empresa, ni afirmes cierre o cotización registrada."):"")+
          "\nEres una prueba PRIVADA por WhatsApp para un destinatario autorizado. No inventes que creaste reservas, seguimientos o enviaste archivos. El agendamiento automático por WhatsApp no está habilitado: solicita datos necesarios y explica que la confirmación requiere el backend. Devuelve JSON reply y followup. Evita mencionar cantidades exactas de stock.",
        input:ordered.length?ordered:[{role:"user",content:event.text}]
      })
    });
    if(!response.ok)throw new Error("OPENAI_HTTP_"+response.status);
    result=await response.json();
  }finally{clearTimeout(timeout);}
  let answer;
  try{answer=JSON.parse(textFrom(result)).reply?.trim();}catch{throw new Error("OPENAI_INVALID_JSON");}
  if(!answer||typeof answer!=="string")throw new Error("OPENAI_EMPTY_REPLY");
  const gate=protectSalesResponse(answer,{catalog,buyer,simulated:testOffers});
  answer=formatWhatsAppReply(gate.reply,{simulated:testOffers});
  const tokens=result.usage||{};
  const usedInput=tokens.input_tokens||0,usedOutput=tokens.output_tokens||0;
  const cached=tokens.input_tokens_details?.cached_tokens||0;
  const cost=estimateUsd(usedInput,usedOutput,cached);
  const metric=await client.from("arm_ai_usage").insert({
    workspace_id:thread.workspace_id,source:"arm_agent",
    source_event_id:result.id||("whatsapp-test:"+event.messageId),
    session_id:thread.id,message_id:event.messageId,model:result.model||"gpt-5.4-mini",
    node:"whatsapp_test",input_tokens:usedInput,output_tokens:usedOutput,
    cached_input_tokens:cached,cost_usd:cost,cost_source:"rate_card_estimate",occurred_at:new Date().toISOString()
  });
  if(metric.error)throw new Error("ARM_USAGE_RECORD_FAILED");
  const send=await fetcher("https://graph.facebook.com/"+encodeURIComponent(graphVersion)+"/"+
    encodeURIComponent(phoneId)+"/messages",{
      method:"POST",headers:{"Authorization":"Bearer "+whatsappToken,"Content-Type":"application/json"},
      body:JSON.stringify({messaging_product:"whatsapp",recipient_type:"individual",
        to:event.sender,type:"text",text:{preview_url:false,body:answer}})
    });
  if(!send.ok)throw new Error("WHATSAPP_SEND_HTTP_"+send.status);
  const sent=await send.json();
  const outboundId=sent?.messages?.[0]?.id;
  if(typeof outboundId!=="string")throw new Error("WHATSAPP_SEND_UNCONFIRMED");
  const logged=await client.from("arm_messages").insert({
    workspace_id:thread.workspace_id,contact_id:thread.contact_id,thread_id:thread.id,
    provider:"whatsapp",external_message_id:outboundId,direction:"outbound",
    message_type:"text",content:answer,created_at:new Date().toISOString()
  });
  if(logged.error)throw new Error("ARM_OUTBOUND_LOG_FAILED");
  return {status:"sent",messageId:outboundId,costUsd:cost};
 };
}
