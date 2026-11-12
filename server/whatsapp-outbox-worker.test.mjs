import {describe,it,expect,vi} from "vitest";
import {createWhatsAppOutboxWorker} from "./whatsapp-outbox-worker.mjs";

function fixture({sender="51900000001",phoneId="phone-qa",
  text="oe que tal el Armor 22",timestamp=Date.now(),
  decision={should_reply:true,handoff_queued:false,opt_out:false},
  response={status:"sent",messageId:"wamid.sent.qa"},
  throwTriage=false,throwSend=false,allowed=["51900000001"]}={}){
 const job={id:"job-1",workspace_id:"ws",thread_id:"thread",
  inbound_id:"message-1",state:"pending",kind:null,attempts:0,updated_at:new Date(timestamp).toISOString()};
 const message={id:"message-1",external_message_id:"wamid.input.qa",direction:"inbound",
   provider:"whatsapp",message_type:"text",content:text,created_at:new Date(timestamp).toISOString()};
 const thread={id:"thread",status:"pending",assigned_to:null,
   external_account_ref:phoneId,external_sender_id:sender,workspace_id:"ws"};
 const calls={triage:[],responder:[],ack:[],claims:[]};
 const db={
  async rpc(name,{p_phase}){
   expect(name).toBe("arm_claim_whatsapp_outbox");
   calls.claims.push(p_phase);
   if(p_phase==="triage"&&job.state==="pending"){
    job.state="triaging";job.attempts++;return {data:{...job},error:null};
   }
   if(p_phase==="send"&&job.state==="ready"){
    job.state="sending";job.attempts++;return {data:{...job},error:null};
   }
   return {data:null,error:null};
  },
  from(table){
   let result=null,update=null,filters=[];
   const q={
    select(){return q;},eq(column,value){filters.push([column,value]);return q;},
    lt(){return q;},gte(){return q;},
    update(value){update=value;return q;},
    async maybeSingle(){
     if(table==="arm_whatsapp_outbox"){
      if(filters.some(([k,v])=>job[k]!==v))return {data:null,error:null};
      Object.assign(job,update);
      return {data:{id:job.id},error:null};
     }
     result=table==="arm_messages"?message:table==="arm_threads"?thread:
      table==="arm_lead_insights"?{sales_memory:null,intent:"consulta_producto"}:null;
     return {data:result,error:null};
    },
    then(resolve){return Promise.resolve({data:[],error:null}).then(resolve);}
   };
   return q;
  }
 };
 const triage=vi.fn(async event=>{
  calls.triage.push(event);
  if(throwTriage)throw Error("triage fail");
  return decision;
 });
 const responder=vi.fn(async (event,lead)=>{
  calls.responder.push({event,lead});
  if(throwSend)throw Error("Graph timeout");
  return response;
 });
 const handoffAck=vi.fn(async event=>{
  calls.ack.push(event);
  if(throwSend)throw Error("Graph timeout");
  return response;
 });
 const reports=[];
 const worker=createWhatsAppOutboxWorker({
  db,phoneId,allowedNumbers:allowed,triage,responder,handoffAck,
  onResult:message=>reports.push(message)
 });
 return {job,worker,calls,reports};
}
describe("durable WhatsApp outbox: no duplicate or unauthorized sends",()=>{
 it("processes one verified inbound once and records accepted provider id",async()=>{
  const f=fixture();
  expect((await f.worker.runOnce()).processed).toBe(2);
  expect(f.job.state).toBe("sent");
  expect(f.job.provider_message_id).toBe("wamid.sent.qa");
  expect(f.calls.triage).toHaveLength(1);
  expect(f.calls.responder).toHaveLength(1);
  expect((await f.worker.runOnce()).processed).toBe(0);
  expect(f.calls.responder).toHaveLength(1);
 });
 it("skips non-allowlisted sender before triage, OpenAI and Graph",async()=>{
  const f=fixture({sender:"51999999999"});
  await f.worker.runOnce();
  expect(f.job.state).toBe("skipped");
  expect(f.calls.triage).toHaveLength(0);
  expect(f.calls.responder).toHaveLength(0);
  expect(f.calls.ack).toHaveLength(0);
 });
 it("routes human handoff acknowledgment only through a confirmed queue decision",async()=>{
  const f=fixture({decision:{should_reply:false,handoff_queued:true,opt_out:false}});
  await f.worker.runOnce();
  expect(f.job.kind).toBe("handoff_ack");
  expect(f.calls.ack).toHaveLength(1);
  expect(f.calls.responder).toHaveLength(0);
  expect(f.job.state).toBe("sent");
 });
 it("never retries an ambiguous Graph delivery",async()=>{
  const f=fixture({throwSend:true});
  await f.worker.runOnce();
  expect(f.job.state).toBe("review");
  await f.worker.runOnce();
  expect(f.calls.responder).toHaveLength(1);
  expect(f.reports).toContainEqual({phase:"send",status:"review"});
 });
 it("drops stale jobs without calling Graph",async()=>{
  const f=fixture({timestamp:Date.now()-2*3600000});
  await f.worker.runOnce();
  expect(f.job.state).toBe("skipped");
  expect(f.calls.responder).toHaveLength(0);
 });
 it("retries triage safely before any Graph call",async()=>{
  const f=fixture({throwTriage:true});
  await f.worker.runOnce();
  expect(f.job.state).toBe("pending");
  expect(f.job.attempts).toBe(1);
  expect(f.calls.responder).toHaveLength(0);
  expect(f.reports).toContainEqual({phase:"triage",status:"retry"});
 });
 it("never treats opt-out as approval to send",async()=>{
  const f=fixture({decision:{should_reply:true,handoff_queued:true,opt_out:true}});
  await f.worker.runOnce();
  expect(f.job.state).toBe("skipped");
  expect(f.calls.responder).toHaveLength(0);
  expect(f.calls.ack).toHaveLength(0);
 });
});
