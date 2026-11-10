import {describe,it,expect} from "vitest";
import {createLeadIntelligenceProcessor} from "./lead-intelligence-processor.mjs";
const seed={sender:"51900000001",phoneNumberId:"phone-qa",messageId:"wamid.qa",text:"Necesito 3 laptops para mi empresa",timestamp:1793916000};
function mockDb({status="pending",previousOptOut=false,lastMessage=seed.text,failInsights=false}={}){
 const writes=[];
 const data={
  arm_threads:{id:"thread",workspace_id:"ws",contact_id:"contact",status,assigned_to:null},
  arm_lead_insights:{opt_out:previousOptOut}
 };
 const db={
  from(table){
   let action="select";
   const q={
    select(){action="select";return q},
    eq(){return q},
    order(){return q},
    limit:async()=>({data:[{direction:"inbound",content:lastMessage,
      external_message_id:"wamid.qa",created_at:"2026-11-05T17:00:00Z"}],error:null}),
    maybeSingle:async()=>({data:data[table],error:null}),
    upsert:async row=>{writes.push({table,action:"upsert",row});return {error:failInsights?{code:"BAD"}:null};},
    update(values){writes.push({table,action:"update",values});return q}
   };
   // .update().eq(...) must return awaitable query
   q.then=(resolve)=>Promise.resolve({data:[],error:null}).then(resolve);
   return q;
  }
 };
 return {db,writes};
}
describe("safe WhatsApp triage persistence",()=>{
 it("does not require Supabase credentials when disconnected",()=>{
  expect(createLeadIntelligenceProcessor({supabaseUrl:"",serviceRoleKey:""})).toBe(null);
 });
 it("stores sandbox classification but never schedules a followup or creates a deal",async()=>{
  const f=mockDb();
  const processor=createLeadIntelligenceProcessor({db:f.db});
  const decision=await processor(seed);
  expect(decision.is_b2b).toBe(true);
  expect(decision.quantity_min).toBe(3);
  expect(decision.should_reply).toBe(true);
  expect(f.writes.map(w=>w.table)).toEqual(["arm_lead_insights"]);
  expect(f.writes[0].row.followup_suppressed).toBe(true);
  expect(f.writes[0].row.source_mode).toBe("sandbox");
  expect(f.writes[0].row.should_reply).toBeUndefined();
 });
 it("auto-hands off a human request, without sending a reply",async()=>{
  const f=mockDb({lastMessage:"Quiero hablar con un asesor"});
  const result=await createLeadIntelligenceProcessor({db:f.db})({...seed,text:"Quiero hablar con un asesor"});
  expect(result.requires_human).toBe(true);
  expect(result.should_reply).toBe(false);
  expect(result.handoff_queued).toBe(true);
  expect(f.writes.map(w=>w.table)).toEqual(["arm_lead_insights","arm_threads"]);
  expect(f.writes[1].values).toEqual({status:"human"});
 });
 it.each([
   "oe mi producto llegó roto en caja",
   "mi epson se malogro, recien la compre",
   "quiero q me devuelvan la plata",
   "mi pedido no llega",
   "pasame con alguien que solucione esto ya"
 ])("places post-sale complaint into human queue, never sending AI reply: %s",async message=>{
   const f=mockDb({lastMessage:message});
   const result=await createLeadIntelligenceProcessor({db:f.db})({...seed,text:message});
   expect(result.requires_human).toBe(true);
   expect(result.should_reply).toBe(false);
   expect(f.writes.map(w=>w.table)).toEqual(["arm_lead_insights","arm_threads"]);
   expect(f.writes[1].values).toEqual({status:"human"});
   expect(f.writes.filter(w=>w.table==="arm_messages")).toHaveLength(0);
 });
 it("does not acknowledge a handoff from an already-human thread",async()=>{
   const f=mockDb({status:"human",lastMessage:"QUIERO ASESOR"});
   const result=await createLeadIntelligenceProcessor({db:f.db})({...seed,text:"QUIERO ASESOR"});
   expect(result.handoff_queued).toBe(false);
   expect(result.should_reply).toBe(false);
   expect(f.writes.filter(w=>w.table==="arm_threads")).toHaveLength(0);
 });
 it("retains previously refused outreach even after hello",async()=>{
  const f=mockDb({previousOptOut:true,lastMessage:"hola"});
  const result=await createLeadIntelligenceProcessor({db:f.db})({...seed,text:"hola"});
  expect(result.opt_out).toBe(true);
  expect(result.should_reply).toBe(false);
  expect(f.writes[0].row.suppression_reason).toBe("opt_out");
 });
 it("fails closed when the insights write fails",async()=>{
  const f=mockDb({failInsights:true});
  const result=await createLeadIntelligenceProcessor({db:f.db})(seed);
  expect(result.should_reply).toBe(false);
 });
});
