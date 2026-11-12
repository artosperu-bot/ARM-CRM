import {describe,it,expect,vi} from "vitest";
import {createWhatsAppHandoffAck,HANDOFF_MESSAGE} from "./whatsapp-handoff-ack.mjs";
const timestamp=()=>Math.floor(Date.now()/1000);
const event=()=>({sender:"51900000001",phoneNumberId:"phone-qa",messageId:"wamid.new",timestamp:timestamp()});
function fixture({status="human",optOut=false,assignedTo=null}={}){
 const sent=[],written=[];
 const rows={
  arm_threads:{id:"thread-1",workspace_id:"ws",contact_id:"contact",status,assigned_to:assignedTo},
  arm_lead_insights:{opt_out:optOut}
 };
 const db={from(table){
  const q={
   select(){return q},eq(){return q},
   maybeSingle:async()=>({data:rows[table]||null,error:null}),
   insert:async value=>{written.push({table,value});return {error:null}}
  };
  return q;
 }};
 const fetcher=vi.fn(async(url,options)=>{
  sent.push({url,options});
  return {ok:true,json:async()=>({messages:[{id:"wamid.outbound"}]})};
 });
 const service=createWhatsAppHandoffAck({
  phoneId:"phone-qa",allowedNumbers:["51900000001"],whatsappToken:"token-test",
  db,fetcher
 });
 return {service,sent,written,fetcher};
}
describe("Short customer acknowledgment is conditional on persisted human handoff",()=>{
 it("sends exactly the requested natural one-line message and logs it",async()=>{
  const f=fixture();
  const result=await f.service(event(),{handoff_queued:true,opt_out:false});
  expect(result.status).toBe("sent");
  expect(HANDOFF_MESSAGE).toMatch(/qued[oó] en cola.*atenci[oó]n humana/i);
  expect(HANDOFF_MESSAGE).not.toMatch(/ya te paso|ya te pas[eé]|asignad[oa] (?:a|para) (?:un|una) asesor/i);
  expect(f.sent).toHaveLength(1);
  expect(JSON.parse(f.sent[0].options.body).text.body).toBe(HANDOFF_MESSAGE);
  expect(f.written).toHaveLength(1);
  expect(f.written[0].table).toBe("arm_messages");
  expect(f.written[0].value.content).toBe(HANDOFF_MESSAGE);
 });
 it.each([
  ["not actually queued",{handoff_queued:false,opt_out:false}],
  ["opted out",{handoff_queued:true,opt_out:true}]
 ])("never sends if %s",async(_,decision)=>{
  const f=fixture();
  expect((await f.service(event(),decision)).status).toBe("blocked");
  expect(f.fetcher).not.toHaveBeenCalled();
 });
 it("never sends to unapproved phone numbers",async()=>{
  const f=fixture(),e={...event(),sender:"51900000002"};
  expect((await f.service(e,{handoff_queued:true})).status).toBe("blocked");
  expect(f.fetcher).not.toHaveBeenCalled();
 });
 it("never acknowledges when the thread was not actually moved to human",async()=>{
  const f=fixture({status:"pending"});
  expect((await f.service(event(),{handoff_queued:true})).status).toBe("not_queued");
  expect(f.fetcher).not.toHaveBeenCalled();
 });
 it("never tells the customer a case is waiting if an advisor already claimed it",async()=>{
  const f=fixture({status:"human",assignedTo:"advisor-id"});
  expect((await f.service(event(),{handoff_queued:true})).status).toBe("not_queued");
  expect(f.fetcher).not.toHaveBeenCalled();
 });
 it("never acknowledges an opt-out recorded after triage",async()=>{
  const f=fixture({optOut:true});
  expect((await f.service(event(),{handoff_queued:true})).status).toBe("blocked");
  expect(f.fetcher).not.toHaveBeenCalled();
 });
 it("does not send for stale inbound WhatsApp events",async()=>{
  const f=fixture(),e={...event(),timestamp:timestamp()-7200};
  expect((await f.service(e,{handoff_queued:true})).status).toBe("stale");
  expect(f.fetcher).not.toHaveBeenCalled();
 });
 it("does not log an outbound message if Graph API fails",async()=>{
  const f=fixture();f.fetcher.mockImplementationOnce(async()=>({ok:false,status:503}));
  await expect(f.service(event(),{handoff_queued:true})).rejects.toThrow("ARM_HANDOFF_SEND_HTTP_503");
  expect(f.written).toHaveLength(0);
 });
});
