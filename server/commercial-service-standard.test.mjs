import {describe,it,expect} from "vitest";
import {COMMERCIAL_STANDARD_VERSION,commercialServiceInstructions,reviewCommercialTurn} from "./commercial-service-standard.mjs";
import {buildBuyerContext} from "./buyer-reasoning.mjs";
import {salesInstructions} from "./sales-policy.mjs";
const products=[
 {titulo:"Ulefone Armor X13",marca:"ULEFONE",partnumber:"ARMOR-X13"},
 {titulo:"Epson EcoTank L1250",marca:"EPSON",partnumber:"EPSON-L1250"},
 {titulo:"Microsoft Office LTSC Standard 2024",marca:"MICROSOFT",partnumber:"OFFICE-2024"},
 {titulo:"Lenovo ThinkPad T14",marca:"LENOVO",partnumber:"THINKPAD-T14"},
 {titulo:"SmallRig VB99 SE",marca:"SMALLRIG",partnumber:"VB99-SE"}
];
const buyer=(messages)=>buildBuyerContext(messages,{catalog:products});
const codes=(x)=>x.notes.map(n=>n.code);
describe("ALEX universal commercial service standard",()=>{
 it("has one versioned rule set for current and future product categories",()=>{
  expect(COMMERCIAL_STANDARD_VERSION).toBe("2026-11-07");
  for(const p of products){
   const b=buyer(["Me interesa "+p.titulo]);
   const guidance=commercialServiceInstructions(b);
   const overall=salesInstructions(products,{buyer:b});
   expect(guidance).toMatch(/ESTÁNDAR COMERCIAL STECH/);
   expect(guidance).toMatch(/CONTEXTO UNIVERSAL/);
   expect(overall).toContain(guidance);
  }
 });
 it("does not force comparison once a buyer has selected a product",()=>{
  const b=buyer(["Me interesa el Armor X13 para mi almacén"]);
  expect(commercialServiceInstructions(b)).toMatch(/PRODUCTO YA INDICADO/);
  const x=reviewCommercialTurn({buyer:b,reply:"Te puedo comparar con otro modelo para que elijas."});
  expect(codes(x)).toContain("unasked_comparison");
 });
 it("supports a genuinely requested comparison",()=>{
  const b=buyer(["Compárame Armor X13 con otro modelo"]);
  const x=reviewCommercialTurn({buyer:b,reply:"Puedo comparar con otro modelo usando sus fichas verificadas."});
  expect(codes(x)).not.toContain("unasked_comparison");
 });
 it("flags a scripted opener repeated in one thread",()=>{
  const b=buyer(["Busco una impresora para mi negocio"]);
  const x=reviewCommercialTurn({buyer:b,
    previousReplies:["Sí te puede servir bastante para ese uso: la Epson facilita imprimir"],
    reply:"Sí te puede servir bastante para ese uso: la Epson tiene buen diseño"
  });
  expect(codes(x)).toContain("formula_repeated");
 });
 it("flags an unsolicited risk disclaimer for review, not as a fact-check verdict",()=>{
  const b=buyer(["¿El Armor X13 me sirve para almacén?"]);
  const x=reviewCommercialTurn({buyer:b,
   reply:"Es resistente. Ojo, la resistencia no es permanente y hay pruebas de laboratorio."});
  expect(codes(x)).toContain("unprompted_warning_review");
  expect(x.needsReview).toBe(true);
 });
 it("does not penalize clear answer when buyer asks about water coverage",()=>{
  const b=buyer(["¿La garantía cubre daños por líquidos del Armor X13?"]);
  const x=reviewCommercialTurn({buyer:b,
    reply:"La ficha del fabricante dice que la garantía excluye daños por líquidos."});
  expect(codes(x)).not.toContain("unprompted_warning_review");
 });
 it("flags a list of distracting questions",()=>{
  const b=buyer(["Busco una laptop para oficina"]);
  const x=reviewCommercialTurn({buyer:b,
   reply:"¿Qué presupuesto tienes? ¿Cuántas necesitas? ¿De qué tamaño la quieres?"});
  expect(codes(x)).toContain("multiple_questions");
 });
 it("keeps one useful question for an unclear requirement",()=>{
  const b=buyer(["Busco un cargador para laptop"]);
  const x=reviewCommercialTurn({buyer:b,
    reply:"Para elegir uno compatible, ¿qué potencia indica el cargador original?"});
  expect(codes(x)).not.toContain("multiple_questions");
 });
 it("flags renewed sales discovery after explicit intent to buy",()=>{
  const b=buyer(["Listo, quiero comprar el Armor X13"]);
  const x=reviewCommercialTurn({buyer:b,
   reply:"Perfecto. ¿Para qué lo necesitas? Te muestro otros modelos."});
  expect(codes(x)).toContain("restart_after_purchase");
 });
 it("flags upselling after farewell",()=>{
  const b=buyer(["Gracias, ya no quiero comprar"]);
  const x=reviewCommercialTurn({buyer:b,
   reply:"Está bien, pero aprovecha la promoción antes de irte."});
  expect(codes(x)).toContain("upsell_after_goodbye");
 });
 it("does not treat heuristic QA as permission to issue quotes or payment",()=>{
  const b=buyer(["Quiero 2 impresoras Epson L1250"]);
  const x=reviewCommercialTurn({buyer:b,
   reply:"El modelo Epson L1250 puede ajustarse a tu uso."});
  expect(x.standardVersion).toBe(COMMERCIAL_STANDARD_VERSION);
  expect(x).not.toHaveProperty("authorizedToSell");
  expect(x).not.toHaveProperty("verifiedPrice");
 });
});
