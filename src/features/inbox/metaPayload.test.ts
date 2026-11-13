import {describe,expect,it} from "vitest";
import {parseMetaMessages} from "../../../supabase/functions/arm-meta-webhook/parse";
describe("Meta webhook normalization",()=>{
 it("reads WhatsApp inbound text, ignoring delivery statuses",()=>{
  const p={object:"whatsapp_business_account",entry:[{changes:[{value:{
   metadata:{phone_number_id:"phone123"},contacts:[{wa_id:"51987654321",profile:{name:"Cliente"}}],
   messages:[{id:"wamid.11",from:"51987654321",timestamp:"1789000000",type:"text",text:{body:"Hola"}}],
   statuses:[{id:"status1"}]
  }}]}]};
  const msgs=parseMetaMessages(p);
  expect(msgs).toHaveLength(1);expect(msgs[0]).toMatchObject({channel:"whatsapp",accountRef:"phone123",senderName:"Cliente",content:"Hola"});
 });
 it("ignores Messenger echoes and page events without message",()=>{
  const p={object:"page",entry:[{id:"page5",messaging:[
   {sender:{id:"u1"},message:{mid:"m1",text:"Quiero precio"},timestamp:1790000000000},
   {sender:{id:"page5"},message:{mid:"m2",text:"respuesta",is_echo:true}},
   {sender:{id:"u1"},delivery:{mids:["m1"]}}
  ]}]};
  expect(parseMetaMessages(p)).toMatchObject([{channel:"facebook",accountRef:"page5",senderId:"u1",content:"Quiero precio"}]);
 });
 it("accepts Instagram business messages but not unsupported events",()=>{
  const p={object:"instagram",entry:[{id:"igbiz",messaging:[{sender:{id:"iguser"},message:{mid:"igmsg",text:"Hola"}}]}]};
  expect(parseMetaMessages(p)[0]).toMatchObject({channel:"instagram",accountRef:"igbiz",senderId:"iguser"});
  expect(parseMetaMessages({object:"other",entry:[{}]})).toHaveLength(0);
 });
 it("ignores malformed messages without sender and id",()=>{
  expect(parseMetaMessages({object:"page",entry:[{id:"p",messaging:[{message:{text:"oops"}}]}]})).toHaveLength(0);
 });
});
