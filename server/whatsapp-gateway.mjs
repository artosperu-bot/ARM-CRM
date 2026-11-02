import {createServer} from "node:http";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {parseWhatsAppEvents,selectAuthorizedEvents,verifyMetaSignature} from "./whatsapp-webhook.mjs";

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
  allowlist=authorizedNumbers,onAuthorizedEvent=null,since=started}={}) {
  const localKnown = onAuthorizedEvent ? new Set() : known;
  const metrics={signedRequests:0,eligibleEvents:0,acceptedEvents:0};
  const server=createServer(async(req,res)=>{
    const url=new URL(req.url||"/","http://localhost");
    if(req.method==="GET" && url.pathname==="/health")
      return send(res,200,{status:secret&&verifyToken&&phoneId?"standby":"missing_config",
        service:"arm-whatsapp-gateway",webhookVerifiedReady:Boolean(secret&&verifyToken),
        phoneConfigured:Boolean(phoneId),testNumbersConfigured:allowlist.length,
        inboundConnected:Boolean(onAuthorizedEvent),automaticReplies:false,
        signedRequests:metrics.signedRequests,eligibleEvents:metrics.eligibleEvents,acceptedEvents:metrics.acceptedEvents});
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
    if(!verifyMetaSignature(raw,req.headers["x-hub-signature-256"],secret))return send(res,403,{error:"INVALID_SIGNATURE"});
    metrics.signedRequests++;
    let json;
    try{json=JSON.parse(raw.toString("utf8"));}
    catch{return send(res,400,{error:"INVALID_JSON"});}
    const events=parseWhatsAppEvents(json);
    const allowed=selectAuthorizedEvents(events,{phoneNumberId:phoneId,authorizedNumbers:allowlist,enabledSince:since});
    metrics.eligibleEvents+=allowed.length;
    // Never acknowledge as processed a real customer message until the new CRM
    // has a durable persistence handler. This gateway cannot send to Graph API.
    if(allowed.length && !onAuthorizedEvent)return send(res,503,{error:"CRM_INBOUND_NOT_CONNECTED"});
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
  createGateway().listen(port,"127.0.0.1",()=>{
    console.log("ARM_WHATSAPP_GATEWAY_READY port="+port+" signedValidation="+Boolean(appSecret)+
      " verifyConfigured="+Boolean(verification)+" testNumbers="+authorizedNumbers.length+
      " messages=disabled replies=disabled");
  });
}
