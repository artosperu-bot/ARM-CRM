import {describe,it,expect} from "vitest";
import {matchCustomerProduct,quantityForAnyCatalogItem} from "./catalog-matching.mjs";
import {buildBuyerContext,buyerGuidance} from "./buyer-reasoning.mjs";
import {salesMove,salesMoveInstructions} from "./sales-playbook.mjs";
import {protectSalesResponse} from "./sales-response-guard.mjs";

const catalog=[
 {titulo:"Impresora Epson EcoTank L1250 Wi-Fi",marca:"EPSON",partnumber:"C11CJ71301"},
 {titulo:"Microsoft Office LTSC Standard 2024",marca:"MICROSOFT",partnumber:"SW-LTSC-2024"},
 {titulo:"Silla ergonómica de respaldo alto",marca:"ERGOMAX",partnumber:"SILLA-RALTO"},
 {titulo:"SmallRig VB99 SE V Mount Battery",marca:"SMALLRIG",partnumber:"VB99-SE"},
 {titulo:"Laptop Lenovo ThinkPad T14 Gen 5",marca:"LENOVO",partnumber:"21ML0020LM"},
 {titulo:"Ulefone Armor 22",marca:"ULEFONE",partnumber:"ARMOR-22-256G"},
 {titulo:"Microsoft Office Home 2024",marca:"MICROSOFT",partnumber:"SW-HOME-2024"}
];
describe("universal catalogue product matching",()=>{
 it("recognizes Epson printers without fixed model lists",()=>{
  const row=matchCustomerProduct("Necesito 2 impresoras Epson EcoTank L1250",catalog);
  expect(row?.partnumber).toBe("C11CJ71301");
  const buyer=buildBuyerContext(["Necesito 2 impresoras Epson EcoTank L1250 para mi casa"],{catalog});
  expect(buyer.quantity).toBe(2);
  expect(buyer.matched_partnumber).toBe("C11CJ71301");
 });
 it("supports software licenses and commercial terms instead of smartphone assumptions",()=>{
  const buyer=buildBuyerContext(["Quiero 3 licencias Microsoft Office LTSC Standard 2024","¿Cuánto cuesta?"],{catalog});
  expect(buyer.quantity).toBe(3);
  expect(buyer.brand).toBe("MICROSOFT");
  expect(buyer.matched_partnumber).toBe("SW-LTSC-2024");
  expect(salesMove(buyer,{catalog}).stage).toBe("oferta");
  expect(salesMoveInstructions(buyer,{catalog})).toContain("NO B2B POR DEFECTO");
 });
 it("handles office furniture with a brand never hardcoded",()=>{
  const buyer=buildBuyerContext(["Busco dos sillas ergonómicas de respaldo alto"],{catalog});
  expect(buyer.quantity).toBe(2);
  expect(buyer.brand).toBe("ERGOMAX");
  expect(buyer.matched_partnumber).toBe("SILLA-RALTO");
 });
 it("handles camera battery accessories and model codes",()=>{
  expect(matchCustomerProduct("Busco SmallRig VB99 SE V Mount Battery",catalog)?.partnumber).toBe("VB99-SE");
 });
 it("still resolves a previously tested rugged phone with model number",()=>{
  const buyer=buildBuyerContext(["Quiero un Armor 22 256GB"],{catalog});
  expect(buyer.matched_partnumber).toBe("ARMOR-22-256G");
  expect(buyer.mentioned_product_family).toBe("Ulefone Armor 22");
 });
 it("does not invent products or silently pick between editions",()=>{
  expect(matchCustomerProduct("¿Tienen impresora Brother HL-L2340?",catalog)).toBe(null);
  expect(matchCustomerProduct("Quiero una licencia Office, no sé cuál",catalog)).toBe(null);
  expect(quantityForAnyCatalogItem("Necesito un monitor de 144 Hz",catalog)).toBe(1);
  expect(quantityForAnyCatalogItem("Tengo 256 GB y 8 GB RAM",catalog)).toBe(null);
 });
});
describe("general catalogue safety with multiple products",()=>{
 const priced=[
  {...catalog[0],precio_soles:800},
  {...catalog[1],precio_soles:1500}
 ];
 it("rejects a valid price belonging to the wrong product",()=>{
  const buyer=buildBuyerContext(["¿Cuánto cuesta la impresora Epson EcoTank L1250?"],{catalog:priced});
  expect(buyer.matched_partnumber).toBe("C11CJ71301");
  const r=protectSalesResponse("La Epson EcoTank L1250 cuesta S/ 1500.",{catalog:priced,buyer});
  expect(r).toMatchObject({blocked:true,reason:"unverified_price"});
 });
 it("blocks model switching when other product is named with a price",()=>{
  const buyer=buildBuyerContext(["¿Cuál es el precio Epson EcoTank L1250?"],{catalog:priced});
  const r=protectSalesResponse("Microsoft Office LTSC Standard 2024 cuesta S/ 1500.",{catalog:priced,buyer});
  expect(r).toMatchObject({blocked:true,reason:"product_mismatch"});
 });
 it("allows the exact verified price of the right identified model",()=>{
  const buyer=buildBuyerContext(["Precio Epson EcoTank L1250"],{catalog:priced});
  const r=protectSalesResponse("La Epson EcoTank L1250 cuesta S/ 800.",{catalog:priced,buyer});
  expect(r).toMatchObject({blocked:false,reason:null});
 });
 it("hides warehouse licence quantities without hiding requested purchase amounts",()=>{
  const buyer=buildBuyerContext(["Deseo 3 licencias Microsoft Office LTSC Standard 2024"],{catalog});
  const r=protectSalesResponse("Tenemos 50 licencias en stock.",{catalog,buyer});
  expect(r).toMatchObject({blocked:true,reason:"exact_stock"});
 });
});

describe("sales process is driven by buying stage, not product category",()=>{
 it("asks about needs only when needed and not after customer's explanation",()=>{
  const start=buildBuyerContext(["Hola, busco una impresora"],{catalog});
  expect(salesMove(start,{catalog}).stage).toBe("descubrimiento");
  const later=buildBuyerContext(["Busco una impresora","La necesito para mi oficina"],{catalog});
  expect(salesMove(later,{catalog}).move).toContain("ya explicó su uso");
 });
 it("moves directly to closing when buyer is ready without new comparisons",()=>{
  const buyer=buildBuyerContext(["Busco una silla ergonómica","Quiero comprarla ahora"],{catalog});
  expect(salesMove(buyer,{catalog})).toMatchObject({stage:"decision",readyForAction:true});
  expect(buyerGuidance(buyer,{catalog})).toContain("deja de comparar");
 });
 it("handles objections without fabricating discounts",()=>{
  const buyer=buildBuyerContext(["Busco una licencia","Me parece caro, ¿hay descuento?"],{catalog});
  const move=salesMove(buyer,{catalog});
  expect(move.stage).toBe("objecion");
  expect(move.move).toContain("Nunca improvisar descuentos");
 });
 it("accepts a no-purchase decision or farewell without further upselling",()=>{
  expect(salesMove(buildBuyerContext(["Ya no quiero comprar"]),{catalog}).stage).toBe("desistimiento");
  expect(salesMove(buildBuyerContext(["Gracias por todo"]),{catalog}).questionPolicy).toBe("ninguna");
 });
 it("doesn't use quantity or B2B status as the selling objective",()=>{
  const b=buildBuyerContext(["Necesito 2 licencias de software"],{catalog});
  expect(salesMove(b,{catalog}).stage).toBe("descubrimiento");
  expect(salesMoveInstructions(b,{catalog})).toContain("NO B2B POR DEFECTO");
 });
});
