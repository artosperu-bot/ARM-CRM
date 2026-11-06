import {describe,it,expect} from "vitest";
import {createArmWhatsAppIngest} from "./whatsapp-ingest.mjs";
const event={messageId:"wamid.test",sender:"51922920517",phoneNumberId:"1283086411554196",timestamp:1793649600,text:"Hola",senderName:"Cliente QA"};
describe("ARM-CRM durable WhatsApp ingest",()=>{
 it("requires a server-only client or service-role credentials",()=>{
  expect(createArmWhatsAppIngest({supabaseUrl:"",serviceRoleKey:""})).toBe(null);
 });
 it("invokes existing RPC without revealing tokens",async()=>{
  const calls=[],db={rpc:async(name,args)=>{calls.push({name,args});return {data:"stored",error:null};}};
  const ingest=createArmWhatsAppIngest({db});
  await expect(ingest(event)).resolves.toBe("stored");
  expect(calls).toHaveLength(1);
  expect(calls[0].name).toBe("arm_ingest_meta_message");
  expect(calls[0].args.p_channel).toBe("whatsapp");
  expect(calls[0].args.p_account_ref).toBe("1283086411554196");
  expect(calls[0].args.p_message_id).toBe("wamid.test");
 });
 it("recognizes duplicates and paused accounts",async()=>{
  for(const status of ["duplicate","ignored"]){
   const ingest=createArmWhatsAppIngest({db:{rpc:async()=>({data:status,error:null})}});
   await expect(ingest(event)).resolves.toBe(status);
  }
 });
 it("fails closed on RPC and malformed messages",async()=>{
  const f=createArmWhatsAppIngest({db:{rpc:async()=>({data:null,error:{code:"DB_ERR"}})}});
  await expect(f(event)).rejects.toThrow("ARM_RPC_FAILED");
  await expect(f({...event,messageId:""})).rejects.toThrow("INCOMPLETE_META_EVENT");
 });
});
