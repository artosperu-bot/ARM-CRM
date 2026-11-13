import {describe,it,expect} from "vitest";
import {assessCommercialReadiness} from "./commercial-readiness.mjs";
import {buildBuyerContext} from "./buyer-reasoning.mjs";
const priced={titulo:"Ulefone Armor X13",partnumber:"ARMOR-X13",marca:"ULEFONE",
 precio_soles:799,disponibilidad:"por confirmar",oferta_simulada:false,origen_datos:"precio_vigente_verificado"};
const catalog=[priced];
const buyer=(turns,items=catalog)=>buildBuyerContext(turns,{catalog:items});
describe("ALEX commercial operation readiness",()=>{
 it("returns actual selected SKU and buyer quantity, without generating quote",()=>{
  const x=assessCommercialReadiness(buyer(["Quiero comprar 2 Ulefone Armor X13"]),{catalog});
  expect(x.product.partnumber).toBe("ARMOR-X13");
  expect(x.quantity).toBe(2);
  expect(x.priceEvidence).toBe(true);
  expect(x.saleableStock).toBe(false);
  expect(x.quoteCreated).toBe(false);
  expect(x.orderCreated).toBe(false);
  expect(x.paymentRegistered).toBe(false);
  expect(x.advisorAssigned).toBe(false);
  expect(x.blockers).toContain("disponibilidad_vendible_por_confirmar");
 });
 it("does not accept stale, unavailable, or simulated prices as verified",()=>{
  const x=assessCommercialReadiness(buyer(["¿Precio del Armor X13?"]),{catalog:[{
   ...priced,precio_soles:699,origen_datos:"precio_no_verificado"}]});
  expect(x.priceEvidence).toBe(false);
  const test=assessCommercialReadiness(buyer(["¿Precio del Armor X13?"]),{
   catalog:[{...priced,oferta_simulada:true,precio_soles:1,disponibilidad:"disponible"}],simulated:true});
  expect(test.priceEvidence).toBe(false);
  expect(test.saleableStock).toBe(false);
  expect(test.canManuallyCreateOpportunity).toBe(false);
 });
 it("computes a clearly fake total only for selected quantity in the private sandbox",()=>{
  const simulatedItem={...priced,oferta_simulada:true,origen_datos:"simulacion_solo_pruebas",
    disponibilidad:"disponible"};
  const b=buyer(["Quiero 3 Ulefone Armor X13"],[simulatedItem]);
  const result=assessCommercialReadiness(b,{catalog:[simulatedItem],simulated:true});
  expect(result.demoEstimate).toMatchObject({
   testOnly:true,partnumber:"ARMOR-X13",quantity:3,unitPricePen:799,totalPen:2397,status:"disponible"
  });
  expect(result.quoteCreated).toBe(false);
  expect(result.orderCreated).toBe(false);
  expect(result.paymentRegistered).toBe(false);
  expect(result.canManuallyCreateOpportunity).toBe(false);
 });
 it("calculates a two-line pilot basket without creating a real quote",()=>{
  const rows=[
   {...priced,oferta_simulada:true,origen_datos:"simulacion_solo_pruebas",disponibilidad:"disponible"},
   {titulo:"Ulefone Armor 22",partnumber:"ARMOR-22-256G",marca:"ULEFONE",
    precio_soles:999,disponibilidad:"disponible",oferta_simulada:true,origen_datos:"simulacion_solo_pruebas"}
  ];
  const b=buyer(["quiero 3 Armor X13 y 2 Armor 22"],rows);
  const result=assessCommercialReadiness(b,{catalog:rows,simulated:true});
  expect(result.draftLines).toHaveLength(2);
  expect(result.demoBasket?.lines).toMatchObject([
   {partnumber:"ARMOR-X13",quantity:3,unitPricePen:799,subtotalPen:2397},
   {partnumber:"ARMOR-22-256G",quantity:2,unitPricePen:999,subtotalPen:1998}
  ]);
  expect(result.demoBasket).toMatchObject({testOnly:true,totalPen:4395,allPriced:true,allAvailable:true});
  expect(result.quoteCreated).toBe(false);
  expect(result.orderCreated).toBe(false);
  expect(result.paymentRegistered).toBe(false);
 });
 it("does not output a basket total if one line lacks a verified demo price",()=>{
  const rows=[
   {...priced,oferta_simulada:true,origen_datos:"simulacion_solo_pruebas",disponibilidad:"disponible"},
   {titulo:"Impresora Epson L1250",partnumber:"E-L1250",precio_soles:null,disponibilidad:"por confirmar",oferta_simulada:true,origen_datos:"simulacion_solo_pruebas"}
  ];
  const b=buyer(["quiero 2 Armor X13 y 1 Epson L1250"],rows);
  const result=assessCommercialReadiness(b,{catalog:rows,simulated:true});
  expect(result.demoBasket?.totalPen).toBeNull();
  expect(result.demoBasket?.allPriced).toBe(false);
 });
 it("tracks out-of-stock lines separately, not as a confirmed sale",()=>{
  const rows=[
   {...priced,oferta_simulada:true,origen_datos:"simulacion_solo_pruebas",disponibilidad:"disponible"},
   {titulo:"Ulefone Armor X12 Pro",partnumber:"ARMOR-X12Pro",precio_soles:659,
    oferta_simulada:true,origen_datos:"simulacion_solo_pruebas",disponibilidad:"no disponible"}
  ];
  const b=buyer(["quiero 2 Armor X13 y 1 Armor X12 Pro"],rows);
  const result=assessCommercialReadiness(b,{catalog:rows,simulated:true});
  expect(result.demoBasket?.allAvailable).toBe(false);
  expect(result.demoBasket?.lines[1].availability).toBe("no disponible");
  expect(result.orderCreated).toBe(false);
 });
 it("shows simulated insufficiency without pretending a reservation occurred",()=>{
  const demo={...priced,oferta_simulada:true,disponibilidad:"no disponible"};
  const result=assessCommercialReadiness(buyer(["Quiero comprar 6 Armor X13"],[demo]),{
   catalog:[demo],simulated:true
  });
  expect(result.demoEstimate?.status).toBe("no disponible");
  expect(result.saleableStock).toBe(false);
  expect(result.quoteCreated).toBe(false);
 });
 it("never computes a demo total from unverified real data",()=>{
  const result=assessCommercialReadiness(buyer(["Quiero 3 Armor X13"]),{catalog});
  expect(result.demoEstimate).toBeNull();
 });
 it("does not turn physical stock labels into available-to-promise stock",()=>{
  const x=assessCommercialReadiness(buyer(["Lo compro, Armor X13"]),{
   catalog:[{...priced,disponibilidad:"disponible",origen_datos:"precio_vigente_verificado"}]});
  expect(x.saleableStock).toBe(false);
 });
 it("does not invent a quote total by multiplying an observed unit price",()=>{
  const x=assessCommercialReadiness(buyer(["Quiero 2 Armor X13, mi presupuesto total es S/ 3000"]),{catalog});
  expect(x.budget.pen).toBe(3000);
  expect(x.budget.scope).toBe("total");
  expect(x).not.toHaveProperty("totalPrice");
  expect(x.blockers).toContain("condiciones_cotizacion_por_confirmar");
 });
 it("cannot create an opportunity with an unknown model or absent exact SKU",()=>{
  const b=buyer(["Quiero la Brother HL-L2340, ¿la cotizas?"]);
  const x=assessCommercialReadiness(b,{catalog});
  expect(x.product).toBeNull();
  expect(x.canManuallyCreateOpportunity).toBe(false);
  expect(x.blockers).toContain("modelo_por_confirmar");
 });
 it("never returns contact, phone, DNI or raw customer message",()=>{
  const x=assessCommercialReadiness(buyer(["Quiero el Ulefone Armor X13. Mi DNI es 12345678 y mi celular es 987654321"]),{catalog});
  const json=JSON.stringify(x);
  for(const token of ["12345678","987654321","DNI","celular es"])expect(json).not.toContain(token);
 });
 it("readiness does not itself send, register or assign anything",()=>{
  const x=assessCommercialReadiness(buyer(["¿Me comunicas con un asesor? Quiero comprar el Armor X13"]),{catalog});
  expect(x.nextAction).toMatch(/verificar/i);
  expect(x).not.toHaveProperty("assignedTo");
  expect(x).not.toHaveProperty("quoteId");
  expect(x).not.toHaveProperty("orderId");
 });
});
