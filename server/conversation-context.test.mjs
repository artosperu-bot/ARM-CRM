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
 it("keeps product photo visible in saved history but removes link from later AI prompts",()=>{
  const photo="Foto referencial del modelo: Ulefone Armor X13\n[FOTO_VERIFICADA](https://store.ulefone.com/media/x13.jpg)";
  const turns=[
   {id:"u",role:"user",content:"foto del Armor X13",created_at:"2026-11-10T10:00:00Z"},
   {id:"a",role:"assistant",content:photo,created_at:"2026-11-10T10:01:00Z"}
  ];
  const context=buildConversationContext(turns,[]);
  expect(context[1].content).toBe("Foto referencial del modelo: Ulefone Armor X13");
  expect(context[1].content).not.toContain("https://");
  expect(turns[1].content).toContain("FOTO_VERIFICADA"); // stored view remains unchanged
 });
 it("avoids duplicating overlapping turns",()=>{
  const turn={id:"1",role:"user",content:"Necesito celular",created_at:"2026-11-02T10:00:00Z"};
  expect(buildConversationContext([turn],[turn])).toHaveLength(1);
 });
});
