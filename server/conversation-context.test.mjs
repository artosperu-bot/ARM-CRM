import {describe,it,expect} from "vitest";
import {buildConversationContext} from "./conversation-context.mjs";
describe("conversation continuity without extra AI calls",()=>{
 it("keeps the initial need and recent buying decision in the correct order",()=>{
  const start=[{id:"1",role:"user",content:"Lo usaré en construcción",created_at:"2026-11-02T10:00:00Z"},
               {id:"2",role:"assistant",content:"¿Qué priorizas?",created_at:"2026-11-02T10:01:00Z"}];
  const end=[{id:"4",role:"assistant",content:"Tenemos dos opciones",created_at:"2026-11-02T10:03:00Z"},
             {id:"3",role:"user",content:"Quiero buena batería",created_at:"2026-11-02T10:02:00Z"}];
  expect(buildConversationContext(start,end).map(x=>x.content)).toEqual(["Lo usaré en construcción","¿Qué priorizas?","Quiero buena batería","Tenemos dos opciones"]);
 });
 it("avoids duplicating overlapping turns",()=>{
  const turn={id:"1",role:"user",content:"Necesito celular",created_at:"2026-11-02T10:00:00Z"};
  expect(buildConversationContext([turn],[turn])).toHaveLength(1);
 });
});
