import {describe,it,expect} from "vitest";
import {advanceDraftItems} from "./sales-draft-items.mjs";
import {buildBuyerContext} from "./buyer-reasoning.mjs";
import {enrichCatalog} from "./product-knowledge.mjs";
import {protectSalesResponse} from "./sales-response-guard.mjs";
const rows=[
 {partnumber:"ARMOR-X13",title:"Ulefone Armor X13 64GB",brand:"ULEFONE"},
 {partnumber:"ARMOR-22-256G",title:"Ulefone Armor 22 256GB",brand:"ULEFONE"}
];
const offers=[
 {partnumber:"ARMOR-X13",is_test_data:true,price_pen:799,stock_status:"disponible",stock_units_demo:5},
 {partnumber:"ARMOR-22-256G",is_test_data:true,price_pen:999,stock_status:"disponible",stock_units_demo:8}
];
const catalog=enrichCatalog(rows,true,offers);
describe("ALEX conversion 20 regression cases",()=>{
 it("changes the first listed SKU only when buyer says 'el que dije primero'",()=>{
  const first=advanceDraftItems([],"quiero 2 armor x13 y 3 armor 22",catalog);
  const ambiguous=advanceDraftItems(first.items,"noo mejor 4",catalog);
  expect(ambiguous.ambiguous).toBe(true);
  expect(ambiguous.items).toEqual(first.items);
  const fixed=advanceDraftItems(ambiguous.items,"el que dije primero, déjalo en 4",catalog);
  expect(fixed.ambiguous).toBe(false);
  expect(fixed.items).toEqual([
   {partnumber:"ARMOR-X13",quantity:4},
   {partnumber:"ARMOR-22-256G",quantity:3}
  ]);
 });
 it("understands colloquial 'sube los X13 a 6' and keeps the other SKU",()=>{
  const first=advanceDraftItems([],"necesito 3 armor x13 y 2 armor 22",catalog);
  const next=advanceDraftItems(first.items,"mejor sube los x13 a 6, el otro queda igual",catalog);
  expect(next.items).toEqual([
   {partnumber:"ARMOR-X13",quantity:6},
   {partnumber:"ARMOR-22-256G",quantity:2}
  ]);
 });
 it("understands 'me quedo con 2 Armor 22' without adding the comparison candidate",()=>{
  const selected=advanceDraftItems([],"me quedo con 2 armor 22, no con el x13",catalog);
  expect(selected.items).toEqual([{partnumber:"ARMOR-22-256G",quantity:2}]);
 });
 it("does not change buyer draft for a mere comparison",()=>{
  expect(advanceDraftItems([],"quiero comparar armor 22 y armor x13",catalog).items).toEqual([]);
 });
 it("summarizes both SKU quantities at purchase decision without creating an order",()=>{
  const buyer=buildBuyerContext(["oe quiero 3 armor x13 y 2 armor 22",
   "mejor 4 del x13, el otro dejalo en 2",
   "ya decidido, quiero comprar los 4 x13 y 2 armor 22"],{catalog});
  const result=protectSalesResponse("Compra registrada, paga ahora",{catalog,buyer,simulated:true});
  expect(result.blocked).toBe(true);
  expect(result.reason).toBe("purchase_interest_no_checkout");
  expect(result.reply).toContain("4 × Ulefone Armor X13");
  expect(result.reply).toContain("2 × Ulefone Armor 22");
  expect(result.reply).toContain("no se ha creado un pedido");
 });
 it("explains a six-unit pilot shortfall when quantity changes",()=>{
  const larger=enrichCatalog(rows,true,offers,{
   requestedQuantitiesByPn:{"ARMOR-X13":6,"ARMOR-22-256G":2}
  });
  const buyer=buildBuyerContext(["necesito 3 armor x13 y 2 armor 22",
   "mejor sube los x13 a 6, el otro queda igual"],{catalog:larger});
  const answer=protectSalesResponse("Listo, están todos disponibles y ya lo registro",{
   catalog:larger,buyer,simulated:true
  });
  expect(answer.reason).toBe("demo_draft_revision");
  expect(answer.reply).toContain("6 × Ulefone Armor X13");
  expect(answer.reply).toContain("2 × Ulefone Armor 22");
  expect(answer.reply).toContain("falta disponibilidad");
  expect(answer.reply).not.toContain("ya lo registro");
 });
});