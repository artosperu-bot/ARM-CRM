import {describe,it,expect} from "vitest";
import {createWhatsAppDeliveryRecorder} from "./whatsapp-delivery-recorder.mjs";

function fixture({status="sent",account="phone-qa"}={}){
 const job={id:"job",workspace_id:"ws",thread_id:"thread",delivery_status:status,
  provider_message_id:"wamid.qa",state:"sent"};
 const thread={external_account_ref:account};
 let written=0;
 const db={from(table){
  const filters=[];
  let values=null;
  const q={
   select(){return q;},eq(k,v){filters.push([k,v]);return q;},
   is(k,v){filters.push([k,v]);return q;},
   update(v){values=v;return q;},
   async maybeSingle(){
    if(table==="arm_threads")return {data:thread,error:null};
    if(filters.some(([k,v])=>job[k]!==v))return {data:null,error:null};
    if(values){Object.assign(job,values);written++;return {data:{id:job.id},error:null};}
    return {data:job,error:null};
   }
  };
  return q;
 }};
 const record=createWhatsAppDeliveryRecorder({db,phoneId:"phone-qa"});
 return {record,job,writes:()=>written};
}
describe("signed Graph delivery receipts persisted without downgrades",()=>{
 it("upgrades accepted Graph message to delivered",async()=>{
  const f=fixture();
  const result=await f.record({messageId:"wamid.qa",phoneNumberId:"phone-qa",
   status:"delivered",timestamp:1794500000});
  expect(result.status).toBe("updated");
  expect(f.job.delivery_status).toBe("delivered");
  expect(f.job.delivered_at).toMatch(/^2026-/);
 });
 it("does not downgrade read to sent",async()=>{
  const f=fixture({status:"read"});
  expect((await f.record({messageId:"wamid.qa",phoneNumberId:"phone-qa",status:"sent"})).status)
   .toBe("unchanged");
  expect(f.writes()).toBe(0);
 });
 it("rejects a receipt for the wrong WABA phone id",async()=>{
  const f=fixture();
  expect((await f.record({messageId:"wamid.qa",phoneNumberId:"foreign",status:"delivered"})).status)
   .toBe("blocked");
  expect(f.writes()).toBe(0);
 });
 it("rejects a receipt when the recorded account differs",async()=>{
  const f=fixture({account:"foreign"});
  expect((await f.record({messageId:"wamid.qa",phoneNumberId:"phone-qa",status:"delivered"})).status)
   .toBe("blocked");
 });
});
