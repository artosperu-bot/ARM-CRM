import {describe,it,expect} from "vitest";
import {buildBuyerContext,buyerGuidance} from "./buyer-reasoning.mjs";
import {snapshotSalesMemory,normalizeSalesMemory,foldSalesMemory} from "./sales-memory.mjs";
import {enrichCatalog} from "./product-knowledge.mjs";
import {assessCommercialReadiness} from "./commercial-readiness.mjs";
import {protectSalesResponse} from "./sales-response-guard.mjs";

const rows=[
 {workspace_id:"demo",partnumber:"ARMOR-X13",title:"Ulefone Armor X13 64GB",brand:"ULEFONE"},
 {workspace_id:"demo",partnumber:"ARMOR-22-256G",title:"Ulefone Armor 22 256GB",brand:"ULEFONE"},
 {workspace_id:"demo",partnumber:"ARMOR-X12Pro",title:"Ulefone Armor X12 Pro 64GB",brand:"ULEFONE"}
];
const offers=[
 {partnumber:"ARMOR-X13",price_pen:799,stock_status:"disponible",stock_units_demo:5,is_test_data:true},
 {partnumber:"ARMOR-22-256G",price_pen:999,stock_status:"disponible",stock_units_demo:8,is_test_data:true},
 {partnumber:"ARMOR-X12Pro",price_pen:659,stock_status:"no disponible",stock_units_demo:0,is_test_data:true}
];
function simulate(){
 let memory=null;
 const step=(message)=>{
  const draft=buildBuyerContext([message],{catalog:enrichCatalog(rows,true,offers),memory});
  const quantities=Object.fromEntries(draft.draft_items.map(x=>[x.partnumber,x.quantity]));
  const catalog=enrichCatalog(rows,true,offers,{
   requestedQuantity:draft.quantity||1,requestedQuantitiesByPn:quantities
  });
  const buyer=buildBuyerContext([message],{catalog,memory});
  memory=snapshotSalesMemory(buyer,{previous:memory});
  return {buyer,catalog,memory,commercial:assessCommercialReadiness(buyer,{catalog,simulated:true})};
 };
 return {step,memory:()=>memory};
}
describe("ALEX long buyer dialogue with multiple product lines",()=>{
 it("maintains two independent lines and computes only the correct checked pilot total",()=>{
  const c=simulate();
  const a=c.step("oe quiero 3 armor x13 y 2 armor 22");
  expect(a.memory.draft_items).toEqual([
   {partnumber:"ARMOR-X13",quantity:3},{partnumber:"ARMOR-22-256G",quantity:2}
  ]);
  const b=c.step("mejor 4 del armor x13, me equivoqué");
  expect(b.memory.draft_items).toEqual([
   {partnumber:"ARMOR-X13",quantity:4},{partnumber:"ARMOR-22-256G",quantity:2}
  ]);
  expect(b.catalog.find(x=>x.partnumber==="ARMOR-X13").disponibilidad).toBe("disponible");
  expect(b.catalog.find(x=>x.partnumber==="ARMOR-22-256G").disponibilidad).toBe("disponible");
  const d=c.step("y el total? aceptan yape?");
  expect(d.memory.draft_items).toEqual(b.memory.draft_items);
  expect(d.commercial.demoBasket?.totalPen).toBe(5194);
  const reply=protectSalesResponse("S/ 5000, acepta Yape y ya quedó reservado",{
   buyer:d.buyer,catalog:d.catalog,simulated:true
  });
  expect(reply.reason).toBe("demo_basket_calculated");
  expect(reply.reply).toContain("S/ 5194.00");
  expect(reply.reply).toContain("Los medios de pago deben confirmarse");
  expect(reply.reply).not.toContain("S/ 5000");
  expect(reply.reply).not.toMatch(/ya qued[oó] reservado/i);
  expect(d.commercial.quoteCreated).toBe(false);
  expect(d.commercial.orderCreated).toBe(false);
  expect(d.commercial.paymentRegistered).toBe(false);
 });
 it("a quantity update cannot make another line unavailable",()=>{
  const c=simulate();
  c.step("quiero 3 armor x13 y 2 armor 22");
  const b=c.step("mejor 6 del x13");
  expect(b.catalog.find(x=>x.partnumber==="ARMOR-X13").disponibilidad).toBe("no disponible");
  expect(b.catalog.find(x=>x.partnumber==="ARMOR-22-256G").disponibilidad).toBe("disponible");
  expect(b.commercial.demoBasket?.allAvailable).toBe(false);
  const d=c.step("cuanto me sale todo?");
  expect(d.commercial.demoBasket?.totalPen).toBe(6792);
  const out=protectSalesResponse("Todo disponible, S/ 6792.",{
   buyer:d.buyer,catalog:d.catalog,simulated:true
  });
  expect(out.reply).toContain("no disponible para esta cantidad");
  expect(out.reply).not.toContain("Todo disponible");
 });
 it("unsupported correction asks which SKU without changing inventory or quantities",()=>{
  const c=simulate();
  c.step("quiero 3 armor x13 y 2 armor 22");
  const b=c.step("noo mejor 4");
  expect(b.memory.draft_items).toEqual([
   {partnumber:"ARMOR-X13",quantity:3},{partnumber:"ARMOR-22-256G",quantity:2}
  ]);
  expect(buyerGuidance(b.buyer,{catalog:b.catalog})).toContain("NO cambies ninguna línea");
  const out=protectSalesResponse("Perfecto, ahora tienes 4 Armor X13.",{
   buyer:b.buyer,catalog:b.catalog,simulated:true
  });
  expect(out.reason).toBe("ambiguous_draft_quantity");
  expect(out.reply).toContain("ARMOR-X13");
  expect(out.reply).toContain("ARMOR-22-256G");
 });
 it("never creates interest lines after just comparing products",()=>{
  const c=simulate();
  const b=c.step("cual tiene mejor camara el x13 o armor 22?");
  expect(b.memory.draft_items).toEqual([]);
  expect(b.commercial.demoBasket).toBeNull();
 });
 it("answers two explicitly requested pilot prices without swapping models",()=>{
  const products=enrichCatalog(rows,true,offers);
  const buyer=buildBuyerContext(["quiero comparar x13 y armor 22, cuánto cuesta cada uno?"],{catalog:products});
  expect(buyer.draft_items).toEqual([]);
  const valid=protectSalesResponse("El Armor X13 tiene precio simulado S/ 799 y el Armor 22 cuesta S/ 999.",{
   buyer,catalog:products,simulated:true
  });
  expect(valid.blocked).toBe(false);
  const swapped=protectSalesResponse("El Armor X13 cuesta S/ 999 y el Armor 22 cuesta S/ 799.",{
   buyer,catalog:products,simulated:true
  });
  expect(swapped.blocked).toBe(true);
  expect(swapped.reason).toBe("multi_price_fact_correction");
  expect(swapped.reply).toContain("Armor X13 64GB: S/ 799");
  expect(swapped.reply).toContain("Armor 22 256GB: S/ 999");
 });
 it("real mode ignores fictitious test basket even if the user chose both",()=>{
  const c=simulate();c.step("quiero 3 armor x13 y 2 armor 22");
  const state=c.step("cuanto sale todo");
  const realCatalog=enrichCatalog(rows,false,offers);
  const readiness=assessCommercialReadiness(state.buyer,{catalog:realCatalog,simulated:false});
  expect(readiness.demoBasket).toBeNull();
  expect(realCatalog.every(p=>p.precio_soles===null&&p.disponibilidad==="por confirmar")).toBe(true);
 });
});
