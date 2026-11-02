import {describe,it,expect} from "vitest";
import {createHmac} from "node:crypto";
import {createGateway} from "./whatsapp-gateway.mjs";
import {parseWhatsAppEvents,verifyMetaSignature,selectAuthorizedEvents,summarizeWhatsAppEnvelope} from "./whatsapp-webhook.mjs";

const original = {
 object:"whatsapp_business_account",
 entry:[{id:"123",changes:[{field:"messages",value:{
   messaging_product:"whatsapp",
   metadata:{phone_number_id:"phone-123",display_phone_number:"15550001111"},
   contacts:[{wa_id:"51922920517",profile:{name:"QA"}}],
   messages:[{from:"51922920517",id:"wamid.qa1",timestamp:String(Math.floor(Date.now()/1000)),
      type:"text",text:{body:"Hola, busco un Armor X13"}}]
 }}]}]
};
function signature(body,secret){return "sha256="+createHmac("sha256",secret).update(body).digest("hex");}
async function withGateway(options,fn){
 const server=createGateway(options);
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const addr=server.address(),url="http://127.0.0.1:"+addr.port;
 try {await fn(url);}finally{await new Promise(resolve=>server.close(resolve));}
}
describe("signed WhatsApp gateway based on legacy CRM",()=>{
 it("rejects invalid HMAC and missing secrets",()=>{
  const body=Buffer.from('{"object":"whatsapp_business_account"}');
  expect(verifyMetaSignature(body,signature(body,"right"),"right")).toBe(true);
  expect(verifyMetaSignature(body,signature(body,"wrong"),"right")).toBe(false);
  expect(verifyMetaSignature(body,"sha256=0000","right")).toBe(false);
  expect(verifyMetaSignature(body,signature(body,"right"),"")).toBe(false);
 });
 it("matches only explicit allowed sender and phone id",()=>{
  const events=parseWhatsAppEvents(original);
  expect(events).toHaveLength(1);
  expect(selectAuthorizedEvents(events,{phoneNumberId:"phone-123",authorizedNumbers:[],enabledSince:0})).toHaveLength(0);
  expect(selectAuthorizedEvents(events,{phoneNumberId:"wrong",authorizedNumbers:["51922920517"],enabledSince:0})).toHaveLength(0);
  expect(selectAuthorizedEvents(events,{phoneNumberId:"phone-123",authorizedNumbers:["51922920517"],enabledSince:0})).toHaveLength(1);
 });
 it("measures delivery acknowledgements without exposing message IDs",()=>{
  const sample={object:"whatsapp_business_account",entry:[{changes:[{field:"messages",value:{
    statuses:[{id:"wm1",status:"sent"},{id:"wm1",status:"delivered"},{id:"wm2",status:"read"}]
  }}]}]};
  expect(summarizeWhatsAppEnvelope(sample)).toEqual({
    statusUpdates:3,receivedMessages:0,
    deliveryStatuses:{sent:1,delivered:1,read:1,failed:0,other:0}
  });
 });
 it("validates GET Meta challenge without exposing secret",async()=>{
  await withGateway({verifyToken:"private-test",secret:"secret",phoneId:"phone-123",allowlist:[]},async url=>{
   const ok=await fetch(url+"/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=private-test&hub.challenge=abc123");
   expect(ok.status).toBe(200);expect(await ok.text()).toBe("abc123");
   const fail=await fetch(url+"/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=x");
   expect(fail.status).toBe(403);
  });
 });
 it("fails closed if app secret is missing",async()=>{
  await withGateway({verifyToken:"private-test",secret:"",phoneId:"phone-123"},async url=>{
   const r=await fetch(url+"/webhooks/whatsapp",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(original)});
   expect(r.status).toBe(503);
  });
 });
 it("does not acknowledge authorized messages without durable CRM handler",async()=>{
  const raw=JSON.stringify(original);
  await withGateway({verifyToken:"private-test",secret:"secret",phoneId:"phone-123",
    allowlist:["51922920517"],since:0},async url=>{
    const r=await fetch(url+"/webhooks/whatsapp",{method:"POST",
      headers:{"content-type":"application/json","x-hub-signature-256":signature(raw,"secret")},body:raw});
    expect(r.status).toBe(503);
  });
 });
 it("delivers signed allowlisted events exactly once in current process",async()=>{
  const processed=[],raw=JSON.stringify(original);
  await withGateway({verifyToken:"private-test",secret:"secret",phoneId:"phone-123",
    allowlist:["51922920517"],since:0,onAuthorizedEvent:async event=>processed.push(event)},async url=>{
     const headers={"content-type":"application/json","x-hub-signature-256":signature(raw,"secret")};
     expect((await fetch(url+"/webhooks/whatsapp",{method:"POST",headers,body:raw})).status).toBe(200);
     expect((await fetch(url+"/webhooks/whatsapp",{method:"POST",headers,body:raw})).status).toBe(200);
     expect(processed).toHaveLength(1);
     const health=await (await fetch(url+"/health")).json();
     expect(health.automaticReplies).toBe(false);
     expect(health.acceptedEvents).toBe(1);
  });
 });
});
