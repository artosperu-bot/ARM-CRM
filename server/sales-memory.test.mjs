import {describe,it,expect} from "vitest";
import {normalizeSalesMemory,foldSalesMemory,snapshotSalesMemory} from "./sales-memory.mjs";
import {buildBuyerContext} from "./buyer-reasoning.mjs";
import {protectSalesResponse} from "./sales-response-guard.mjs";

const catalog=[
 {titulo:"Ulefone Armor X13",marca:"ULEFONE",partnumber:"ARMOR-X13",precio_soles:799},
 {titulo:"Impresora Epson L1250",marca:"EPSON",partnumber:"EPSON-L1250",precio_soles:null}
];
const event=(id,content,second)=>({
 direction:"inbound",external_message_id:id,content,
 created_at:new Date(Date.UTC(2026,10,7,19,0,second)).toISOString()
});
describe("ALEX durable commercial memory (only customer facts)",()=>{
 it("remembers quantity, budget and corrections after limited context windows",()=>{
  let memory=foldSalesMemory(null,[
   event("m1","Quiero 3 laptops con presupuesto de S/ 12000 en total",0)
  ]);
  expect(memory.quantity).toBe(3);
  expect(memory.budget).toEqual({pen:12000,scope:"total"});
  memory=foldSalesMemory(memory,[
   event("m1","Quiero 3 laptops con presupuesto de S/ 12000 en total",0),
   event("m2","Mejor 2 laptops",1)
  ]);
  expect(memory.quantity).toBe(2);
  const revived=buildBuyerContext(["¿Y cuánto me sale?"],{memory,catalog});
  expect(revived.quantity).toBe(2);
  expect(revived.budget).toEqual({pen:12000,scope:"total"});
 });
 it("keeps verified SKU after many generic turns but only when still in the catalog",()=>{
  const old=foldSalesMemory(null,[event("a","Quiero Ulefone Armor X13",0)],{catalog});
  expect(old.selected_partnumber).toBe("ARMOR-X13");
  const memory=foldSalesMemory(old,[event("b","Y en qué colores viene",1)]);
  expect(memory.selected_partnumber).toBe("ARMOR-X13");
  expect(buildBuyerContext(["¿Cuánto cuesta?"],{memory,catalog}).matched_partnumber).toBe("ARMOR-X13");
  expect(buildBuyerContext(["¿Cuánto cuesta?"],{memory,catalog:[]}).matched_partnumber).toBeNull();
 });
 it("never transfers an old SKU's price to a different unknown model",()=>{
  const old=foldSalesMemory(null,[event("a","Quiero Ulefone Armor X13",0)],{catalog});
  const memory=foldSalesMemory(old,[event("b","Ahora quiero la Brother HL-L2340, ¿cuánto cuesta?",1)]);
  expect(memory.selected_partnumber).toBeNull();
  expect(memory.customer_reference).toBe("HL-L2340");
  const buyer=buildBuyerContext(["¿Y su precio exacto?"],{memory,catalog});
  expect(protectSalesResponse("Cuesta S/ 799.",{buyer,catalog}).reason).toBe("unverified_price");
 });
 it("restores a selected product when the buyer switches back explicitly",()=>{
  const a=foldSalesMemory(null,[event("a","Quiero Ulefone Armor X13",0)],{catalog});
  const b=foldSalesMemory(a,[event("b","Ahora quiero la Brother HL-L2340",1)]);
  const c=foldSalesMemory(b,[event("c","Al final quiero Ulefone Armor X13",2)],{catalog});
  expect(c.selected_partnumber).toBe("ARMOR-X13");
  expect(c.customer_reference).toBeNull();
 });
 it("persists human preference until explicitly released",()=>{
  const a=foldSalesMemory(null,[event("a","Quiero hablar con un asesor",0)]);
  const b=foldSalesMemory(a,[event("b","¿Ya le avisaste?",1)]);
  expect(b.requires_human).toBe(true);
  expect(buildBuyerContext(["¿Ya le avisaste?"],{memory:b}).requires_human).toBe(true);
  const c=foldSalesMemory(b,[event("c","No necesito un asesor, prefiero seguir aquí",2)]);
  expect(c.requires_human).toBe(false);
 });
 it("is idempotent when Meta retries the same recorded message",()=>{
  const m1=foldSalesMemory(null,[event("a","Quiero 3 laptops",0)]);
  const replay=foldSalesMemory(m1,[event("a","Quiero 3 laptops",0)]);
  expect(replay).toEqual(m1);
 });
 it("ignores older out-of-order events instead of overwriting newer corrections",()=>{
  const m=foldSalesMemory(null,[event("b","Necesito 2 laptops",2)]);
  const result=foldSalesMemory(m,[event("a","Necesito 9 laptops",0)]);
  expect(result).toEqual(m);
 });
 it("stores no raw identifiers or sensitive message content",()=>{
  const raw="Mi DNI es 12345678 y mi celular 987654321, necesito 2 laptops";
  const m=foldSalesMemory(null,[event("a",raw,0)]);
  expect(m.quantity).toBe(2);
  expect(JSON.stringify(m)).not.toContain("12345678");
  expect(JSON.stringify(m)).not.toContain("987654321");
  expect(JSON.stringify(m)).not.toContain("Mi DNI");
 });
 it("rejects malformed or unknown-version snapshots",()=>{
  expect(normalizeSalesMemory({version:999,quantity:200})).toBeNull();
  expect(normalizeSalesMemory({version:1,quantity:999999,customer_reference:"987654321",budget:{pen:-5,scope:"total"}}))
   .toMatchObject({quantity:null,customer_reference:null,budget:null});
 });
 it("never replaces an explicit correction with a generated assistant message",()=>{
  const m=foldSalesMemory(null,[
   event("a","Quiero 3 laptops",0),
   {direction:"outbound",content:"Tu pedido de 8 laptops está registrado",created_at:new Date(Date.UTC(2026,10,7,19,0,1)).toISOString()},
   event("b","Mejor 2",2)
  ]);
  expect(m.quantity).toBe(2);
 });
 it("retains prior selected product when a new generic message arrives",()=>{
  const buyer=buildBuyerContext(["Quiero Ulefone Armor X13"],{catalog});
  const earlier=snapshotSalesMemory(buyer);
  const current=buildBuyerContext(["¿Y el envío?"],{catalog,memory:earlier});
  const updated=snapshotSalesMemory(current,{previous:earlier});
  expect(updated.selected_partnumber).toBe("ARMOR-X13");
 });
});
