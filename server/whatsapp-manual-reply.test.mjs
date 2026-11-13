import {describe,it,expect,vi} from "vitest";
import {createManualWhatsAppService,manualReplyEligibility} from "./whatsapp-manual-reply.mjs";
const now=Date.parse("2026-11-13T22:00:00.000Z");
const workspaceId="11111111-1111-4111-8111-111111111111";
const threadId="22222222-2222-4222-8222-222222222222";
const userId="33333333-3333-4333-8333-333333333333";
const phoneId="test-business-id";
const recipient="51987654321";
const thread={
 id:threadId,workspace_id:workspaceId,contact_id:"44444444-4444-4444-8444-444444444444",
 channel:"whatsapp",status:"human",assigned_to:userId,
 external_sender_id:recipient,external_account_ref:phoneId
};
const context={thread,workspaceId,userId,phoneId,allowlist:[recipient],
 lastInboundAt:new Date(now-30*60000).toISOString(),now};
const requestId="55555555-5555-4555-8555-555555555555";
function testDb({t=thread,lead={opt_out:false},
 lastInboundAt=context.lastInboundAt,insertError=null}={}){
 const writes=[];
 const db={from(table){
  if(table==="arm_messages"){
   const query={select(){return this},eq(){return this},order(){return this},limit(){
    return Promise.resolve({data:lastInboundAt?[{created_at:lastInboundAt}]:[],error:null});
   },insert(row){
    writes.push(row);return {select(){return {single:async()=>({
     data:insertError?null:{id:"new-msg-id"},error:insertError
    })}}};
   }};
   return query;
  }
  if(table==="arm_threads"){
   return {select(){return this},eq(){return this},maybeSingle:async()=>({data:t,error:null}),
    update(row){writes.push({update:row});return {eq(){return this},then(cb){
     return Promise.resolve({data:null,error:null}).then(cb);
    }};}
   };
  }
  if(table==="arm_lead_insights"){
   return {select(){return this},eq(){return this},maybeSingle:async()=>({data:lead,error:null})};
  }
  throw Error("unexpected table: "+table);
 }};
 return {db,writes};
}
function sender(fake=testDb(),fetcher=vi.fn(async()=>({
 ok:true,status:200,json:async()=>({messages:[{id:"wamid.TEST"}]})
}))){
 const service=createManualWhatsAppService({
  db:fake.db,fetcher,phoneId,allowlist:[recipient],
  accessToken:"server-only-token",now:()=>now
 });
 return {service,fetcher,writes:fake.writes};
}
describe("Manual human WhatsApp composer protection",()=>{
 it("allows an assigned human thread with recent inbound and an allowlisted sender",()=>{
  expect(manualReplyEligibility(context)).toMatchObject({allowed:true,reason:null});
 });
 it.each([
  [{thread:{...thread,status:"pending"}},"assigned_elsewhere"],
  [{thread:{...thread,assigned_to:null}},"assigned_elsewhere"],
  [{thread:{...thread,assigned_to:"other-user"}},"assigned_elsewhere"],
  [{thread:{...thread,channel:"instagram"}},"wrong_channel"],
  [{thread:{...thread,external_sender_id:"51900111222"}},"unauthorized_recipient"],
  [{thread:{...thread,external_account_ref:"wrong-id"}},"unauthorized_recipient"],
  [{lead:{opt_out:true}},"no_contact"],
  [{lastInboundAt:null},"no_inbound"],
  [{lastInboundAt:new Date(now-25*3600000).toISOString()},"window_expired"],
  [{configured:false},"service_unavailable"]
 ])("blocks unsafe recipient/window state: %j",(patch,reason)=>{
  expect(manualReplyEligibility({...context,...patch})).toMatchObject({allowed:false,reason});
 });
 it("rejects blank messages before any Meta request",async()=>{
  const {service,fetcher}=sender();
  await expect(service.send({workspaceId,threadId,userId,text:"   ",requestId})).rejects.toMatchObject({status:400});
  expect(fetcher).not.toHaveBeenCalled();
 });
 it("sends only the selected test recipient and persists Meta accepted ID",async()=>{
  const {service,fetcher,writes}=sender();
  const result=await service.send({workspaceId,threadId,userId,text:"Hola Jaime",requestId});
  expect(result).toMatchObject({ok:true,acceptedByMeta:true,delivered:false,persisted:true});
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url,req]=fetcher.mock.calls[0];
  expect(url).toContain("test-business-id/messages");
  expect(JSON.parse(req.body)).toMatchObject({to:recipient,type:"text",text:{body:"Hola Jaime"}});
  expect(writes[0]).toMatchObject({thread_id:threadId,direction:"outbound",external_message_id:"wamid.TEST",content:"Hola Jaime"});
  const repeat=await service.send({workspaceId,threadId,userId,text:"Hola Jaime",requestId});
  expect(repeat.repeated).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const secondId="66666666-6666-4666-8666-666666666666";
  const doubleClick=await service.send({workspaceId,threadId,userId,text:"Hola Jaime",requestId:secondId});
  expect(doubleClick.repeated).toBe(true);
  expect(doubleClick.notice).toContain("no se duplicó");
  expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it("blocks sending after the inbound window expires",async()=>{
  const {service,fetcher}=sender(testDb({lastInboundAt:new Date(now-30*3600000).toISOString()}));
  const state=await service.status({workspaceId,threadId,userId});
  expect(state.reason).toBe("window_expired");
  await expect(service.send({workspaceId,threadId,userId,text:"Hola",requestId})).rejects.toMatchObject({status:409});
  expect(fetcher).not.toHaveBeenCalled();
 });
 it("blocks sending even with a valid allowlist if the thread belongs to another advisor",async()=>{
  const {service,fetcher}=sender(testDb({t:{...thread,assigned_to:"other"}}));
  await expect(service.send({workspaceId,threadId,userId,text:"Hola",requestId})).rejects.toMatchObject({status:403});
  expect(fetcher).not.toHaveBeenCalled();
 });
 it("Meta failure does not save an outbound message",async()=>{
  const fetcher=vi.fn(async()=>({ok:false,status:400,json:async()=>({error:{message:"Outside allowed window"}})}));
  const {service,writes}=sender(testDb(),fetcher);
  await expect(service.send({workspaceId,threadId,userId,text:"Hola",requestId})).rejects.toMatchObject({status:502});
  expect(writes).toHaveLength(0);
 });
 it("Meta acceptance with DB failure cannot be sent twice by same request ID",async()=>{
  const fake=testDb({insertError:{code:"DB_ERROR"}});
  const {service,fetcher}=sender(fake);
  const first=await service.send({workspaceId,threadId,userId,text:"Hola",requestId});
  expect(first).toMatchObject({acceptedByMeta:true,persisted:false});
  const repeat=await service.send({workspaceId,threadId,userId,text:"Hola",requestId});
  expect(repeat.repeated).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(1);
 });
});
