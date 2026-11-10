import {createServer} from "node:http";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {parseWhatsAppEvents,selectAuthorizedEvents,verifyMetaSignature,summarizeWhatsAppEnvelope} from "./whatsapp-webhook.mjs";
import {createArmWhatsAppIngest} from "./whatsapp-ingest.mjs";
import {createWhatsAppTestResponder} from "./whatsapp-test-responder.mjs";
import {createLeadIntelligenceProcessor} from "./lead-intelligence-processor.mjs";
import {createWhatsAppHandoffAck} from "./whatsapp-handoff-ack.mjs";

function loadEnv(path) {
  const result={};
  try {
    for(const line of readFileSync(path,"utf8").split(/\r?\n/)) {
      const match=line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)\s*$/);
      if(match)result[match[1]]=match[2].trim().replace(/^(['"])(.*)\1$/,"$2");
    }
  }catch{/* explicit environment variables take precedence */}
  return result;
}
const home=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const legacy=loadEnv(process.env.ARM_LEGACY_ENV_FILE||"C:\\DESAROLLO\\n8n\\backend\\.env");
const local=loadEnv(resolve(home,".env.local"));
const get=k=>process.env[k]||local[k]||legacy[k]||"";
const verification=get("WHATSAPP_VERIFY_TOKEN");
const appSecret=get("ARM_META_APP_SECRET")||get("WHATSAPP_APP_SECRET")||get("META_APP_SECRET");
const expectedPhoneId=get("WHATSAPP_PHONE_NUMBER_ID");
const authorizedNumbers=(get("ARM_WHATSAPP_TEST_NUMBERS")||"").split(",").map(x=>x.replace(/\D/g,"")).filter(Boolean);
const port=3000, started=Date.now();
const autoReplyEnabled=get("ARM_WHATSAPP_AUTO_REPLY")==="enabled";
const simulatedOffers=get("ARM_WHATSAPP_TEST_OFFERS")==="enabled";
const modelEnv=loadEnv(process.env.OPENAI_ENV_FILE||"C:\\DESAROLLO\\STECH_AGENT\\.env");
let received=0, authorized=0;
const known=new Set();
function send(res,status,body,contentType="application/json; charset=utf-8") {
  res.writeHead(status,{"Content-Type":contentType,"Cache-Control":"no-store"});
  res.end(contentType.startsWith("application/json")?JSON.stringify(body):String(body));
}
async function receive(req, limit=262144) {
  const buffers=[];let size=0;
  for await (const chunk of req) {
    size+=chunk.length;
    if(size>limit)throw Object.assign(new Error("BODY_TOO_LARGE"),{status:413});
    buffers.push(chunk);
  }
  return Buffer.concat(buffers);
}
export function createGateway({verifyToken=verification,secret=appSecret,phoneId=expectedPhoneId,
  allowlist=authorizedNumbers,onAuthorizedEvent=null,since=started,autoReplies=false,getReplyStats=()=>({sent:0,failed:0})}={}) {
  const localKnown = onAuthorizedEvent ? new Set() : known;
  const metrics={signedRequests:0,invalidSignatures:0,eligibleEvents:0,acceptedEvents:0,
    incomingMessages:0,statusUpdates:0,lastSignedAt:null,
    deliveryStatuses:{sent:0,delivered:0,read:0,failed:0,other:0}};
  const server=createServer(async(req,res)=>{
    const url=new URL(req.url||"/","http://localhost");
    if(req.method==="GET" && url.pathname==="/health")
      return send(res,200,{status:secret&&verifyToken&&phoneId&&allowlist.length&&onAuthorizedEvent?"ready_for_signed_ingest":"missing_config",
        service:"arm-whatsapp-gateway",webhookVerifiedReady:Boolean(secret&&verifyToken),
        phoneConfigured:Boolean(phoneId),testNumbersConfigured:allowlist.length,
        inboundConnected:Boolean(onAuthorizedEvent),automaticReplies:Boolean(autoReplies&&onAuthorizedEvent),
        signedRequests:metrics.signedRequests,invalidSignatures:metrics.invalidSignatures,
        incomingMessages:metrics.incomingMessages,statusUpdates:metrics.statusUpdates,
        deliveryStatuses:metrics.deliveryStatuses,lastSignedAt:metrics.lastSignedAt,
        eligibleEvents:metrics.eligibleEvents,acceptedEvents:metrics.acceptedEvents,
        replyStats:getReplyStats()});
    if(url.pathname!=="/webhooks/whatsapp")return send(res,404,{error:"NOT_FOUND"});
    if(req.method==="GET"){
      const mode=url.searchParams.get("hub.mode"),token=url.searchParams.get("hub.verify_token");
      const challenge=url.searchParams.get("hub.challenge");
      if(mode!=="subscribe"||!verifyToken||token!==verifyToken||challenge===null)return send(res,403,"Forbidden","text/plain");
      return send(res,200,challenge,"text/plain");
    }
    if(req.method!=="POST")return send(res,405,{error:"METHOD_NOT_ALLOWED"});
    if(!secret)return send(res,503,{error:"META_APP_SECRET_NOT_CONFIGURED"});
    let raw;
    try{raw=await receive(req);}catch(e){return send(res,e.status||400,{error:"INVALID_BODY"});}
    if(!verifyMetaSignature(raw,req.headers["x-hub-signature-256"],secret)){
      metrics.invalidSignatures++;return send(res,403,{error:"INVALID_SIGNATURE"});
    }
    metrics.signedRequests++;metrics.lastSignedAt=new Date().toISOString();
    let json;
    try{json=JSON.parse(raw.toString("utf8"));}
    catch{return send(res,400,{error:"INVALID_JSON"});}
    const summary=summarizeWhatsAppEnvelope(json);
    metrics.incomingMessages+=summary.receivedMessages;
    metrics.statusUpdates+=summary.statusUpdates;
    for(const key of Object.keys(metrics.deliveryStatuses)){
      metrics.deliveryStatuses[key]+=summary.deliveryStatuses[key];
    }
    const events=parseWhatsAppEvents(json);
    const allowed=selectAuthorizedEvents(events,{phoneNumberId:phoneId,authorizedNumbers:allowlist,enabledSince:since});
    metrics.eligibleEvents+=allowed.length;
    // Never acknowledge as processed a real customer message until the new CRM
    // has a durable persistence handler. This gateway cannot send to Graph API.
    if(events.length && !onAuthorizedEvent)return send(res,503,{error:"CRM_INBOUND_NOT_CONNECTED"});
    for(const event of allowed){
      if(localKnown.has(event.messageId))continue;
      try{await onAuthorizedEvent(event);}
      catch{return send(res,503,{error:"INBOUND_PERSISTENCE_FAILED"});}
      localKnown.add(event.messageId);
      if(localKnown.size>5000)localKnown.clear();
      metrics.acceptedEvents++;
    }
    received+=events.length;authorized+=allowed.length;
    return send(res,200,{received:true});
  });
  server.on("error",err=>{
    if(err.code==="EADDRINUSE"){console.error("WHATSAPP_GATEWAY_PORT_IN_USE: only one receiver may bind port 3000");process.exitCode=1;}
    else throw err;
  });
  return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const ingest=appSecret&&authorizedNumbers.length>0?createArmWhatsAppIngest({
    supabaseUrl:get("SUPABASE_URL"),serviceRoleKey:get("SUPABASE_SERVICE_ROLE_KEY")
  }):null;
  const triage=ingest?createLeadIntelligenceProcessor({
    supabaseUrl:get("SUPABASE_URL"),serviceRoleKey:get("SUPABASE_SERVICE_ROLE_KEY")
  }):null;
  const responder=ingest&&triage&&autoReplyEnabled?createWhatsAppTestResponder({
    supabaseUrl:get("SUPABASE_URL"),serviceRoleKey:get("SUPABASE_SERVICE_ROLE_KEY"),
    openaiKey:get("OPENAI_API_KEY")||modelEnv.OPENAI_API_KEY,
    whatsappToken:get("WHATSAPP_ACCESS_TOKEN"),phoneId:expectedPhoneId,
    allowedNumbers:authorizedNumbers,testOffers:simulatedOffers,
    graphVersion:get("WHATSAPP_GRAPH_API_VERSION")||"v25.0"
  }):null;
  const handoffAck=ingest&&triage&&autoReplyEnabled?createWhatsAppHandoffAck({
    supabaseUrl:get("SUPABASE_URL"),serviceRoleKey:get("SUPABASE_SERVICE_ROLE_KEY"),
    whatsappToken:get("WHATSAPP_ACCESS_TOKEN"),phoneId:expectedPhoneId,
    allowedNumbers:authorizedNumbers,graphVersion:get("WHATSAPP_GRAPH_API_VERSION")||"v25.0"
  }):null;
  const replyStats={sent:0,failed:0,lastReplyAt:null};
  const receiveEvent=ingest?async e=>{
    const result=await ingest(e);
    if(result==="stored"){
      // Every signed message is durably recorded first. A failed triage does not
      // trigger speculative AI responses, lead creation or automated followups.
      let decision={should_reply:false};
      if(triage){
        try{decision=await triage(e);}
        catch{console.error("ARM_LEAD_TRIAGE_FAILED");}
      }
      if(handoffAck&&decision.handoff_queued&&!decision.opt_out)queueMicrotask(()=>{
        void handoffAck(e,decision).then(status=>{
          if(status?.status==="sent"){replyStats.sent++;replyStats.lastReplyAt=new Date().toISOString();}
        }).catch(err=>{
          replyStats.failed++;
          console.error("WHATSAPP_HANDOFF_ACK_FAILED",err instanceof Error?err.message:"unknown");
        });
      });
      if(responder&&decision.should_reply)queueMicrotask(()=>{
      void responder(e,decision).then(result=>{
        if(result?.status==="sent"){replyStats.sent++;replyStats.lastReplyAt=new Date().toISOString();}
      }).catch(err=>{
        replyStats.failed++;
        // Sanitized diagnostic; no phone, message, API key or third-party body.
        console.error("WHATSAPP_TEST_REPLY_FAILED",err instanceof Error?err.message.replace(/\d{8,}/g,"[ID]"):"unknown");
      });
    });
    }
    return result;
  }:null;
  createGateway({onAuthorizedEvent:receiveEvent,autoReplies:Boolean(responder),getReplyStats:()=>replyStats}).listen(port,"127.0.0.1",()=>{
    console.log("ARM_WHATSAPP_GATEWAY_READY port="+port+" signedValidation="+Boolean(appSecret)+
      " verifyConfigured="+Boolean(verification)+" testNumbers="+authorizedNumbers.length+
      " durableIngest="+Boolean(ingest)+" replies="+Boolean(responder)+" testOffers="+Boolean(responder&&simulatedOffers));
  });
}
