import {describe,it,expect} from "vitest";
import {buildBuyerContext,buyerGuidance} from "./buyer-reasoning.mjs";
import {salesMove} from "./sales-playbook.mjs";
import {protectSalesResponse} from "./sales-response-guard.mjs";
const catalog=[
 {titulo:"Cargador USB-C",marca:"GENERIC",partnumber:"QA-CHARGER",precio_soles:null},
 {titulo:"Impresora Epson L1250",marca:"EPSON",partnumber:"QA-L1250",precio_soles:null},
 {titulo:"Microsoft Office Home",marca:"MICROSOFT",partnumber:"QA-OFFICE",precio_soles:null}
];
describe("ALEX real dialogue review: grounded conversation coherence",()=>{
 it("remembers human handoff when customer asks if advisor was notified next turn",()=>{
  const buyer=buildBuyerContext(["Quiero hablar con un asesor","¿Ya le avisaste?"],{catalog});
  expect(buyer.requires_human).toBe(true);
  const reply=protectSalesResponse("Claro, pásame tu nombre completo y celular.",{catalog,buyer});
  expect(reply.reason).toBe("human_requested");
  expect(reply.reply).toMatch(/no tengo confirmación/i);
  expect(reply.reply).not.toMatch(/nombre|celular|p[aá]same/i);
 });
 it("does not invent advisor assignment on first request",()=>{
  const buyer=buildBuyerContext(["Quiero hablar con un asesor"],{catalog});
  const reply=protectSalesResponse("Tu caso ya fue asignado.",{buyer,catalog});
  expect(reply).toMatchObject({blocked:true,reason:"human_requested"});
  expect(reply.reply).not.toMatch(/fue asignado/);
 });
 it("allows a customer to withdraw a human request",()=>{
  const b=buildBuyerContext(["Necesito un asesor","No quiero hablar con un asesor, prefiero seguir aquí"],{catalog});
  expect(b.requires_human).toBe(false);
 });
 it("classifies physical compatibility separately from inventory availability",()=>{
  const b=buildBuyerContext(["Busco un cargador USB-C","Es de 65W, ¿el cargador que tienes sirve?"],{catalog});
  expect(b.current_intent).toBe("compatibilidad");
  expect(salesMove(b,{catalog}).stage).toBe("compatibilidad");
  expect(salesMove(b,{catalog}).move).toMatch(/no se puede confirmar/);
 });
 it("distinguishes a time-sensitive delivery question from generic stock",()=>{
  const b=buildBuyerContext(["Necesito una impresora Epson L1250 hoy","¿Me confirmas entrega hoy?"],{catalog});
  expect(b.current_intent).toBe("entrega");
  expect(salesMove(b,{catalog}).stage).toBe("logistica");
 });
 it("remembers unknown SKU typed by the customer rather than asking again",()=>{
  const b=buildBuyerContext(["¿Venden impresora Brother HL-L2340?","¿Cuál es el precio exacto?"],{catalog});
  expect(b.customer_reference).toBe("HL-L2340");
  expect(buyerGuidance(b,{catalog})).toContain("HL-L2340");
  expect(b.matched_partnumber).toBeNull();
 });
 it("doesn't treat the buyer's phone number as SKU",()=>{
  const b=buildBuyerContext(["Mi celular es 987654321, necesito un cargador USB-C"],{catalog});
  expect(b.customer_reference).toBeNull();
 });
 it("blocks promises to verify price/availability/compatibility without an actual tool",()=>{
  const b=buildBuyerContext(["Necesito el precio del cargador USB-C"],{catalog});
  for(const text of [
   "Puedo verificar el precio y luego te aviso.",
   "Podemos consultar la disponibilidad del cargador.",
   "Voy a confirmar la compatibilidad de ese cargador."
  ])expect(protectSalesResponse(text,{catalog,buyer:b}).reason).toBe("unconfirmed_action");
 });
 it("honors explicit no-ID preference without upselling followup data collection",()=>{
  const b=buildBuyerContext(["Busco impresora Epson","No quiero dar mi DNI, ¿igual puedo consultar?"],{catalog});
  const out=protectSalesResponse("Para hacerlo necesito tu nombre y celular.",{catalog,buyer:b});
  expect(out).toMatchObject({blocked:true,reason:"privacy_preference"});
  expect(out.reply).not.toMatch(/nombre|celular/i);
 });
 it("rejects invented numeric prices in soles, PEN, US dollars, not just S/",()=>{
  const b=buildBuyerContext(["¿Cuánto cuesta el cargador USB-C?"],{catalog});
  for(const offer of ["El cargador cuesta 199 soles.","Precio: PEN 199.","Sale US$ 99.","Cuesta $99."])
    expect(protectSalesResponse(offer,{catalog,buyer:b}).reason).toBe("unverified_price");
 });
 it("rejects phantom unfinished quotations or orders",()=>{
  const b=buildBuyerContext(["¿Me puedes cotizar 2 impresoras?"],{catalog});
  const res=protectSalesResponse("Puedo ayudarte a dejar lista tu cotización.",{catalog,buyer:b});
  expect(res).toMatchObject({blocked:true,reason:"unconfirmed_action"});
 });
 it("stops asking for model details already typed even if SKU isn't on file",()=>{
  const b=buildBuyerContext(["Quiero Brother HL-L2340","¿Cuál es el precio?"],{catalog});
  const res=protectSalesResponse("Si me confirmas la referencia completa, revisamos el precio.",{catalog,buyer:b});
  expect(res).toMatchObject({blocked:true,reason:"redundant_model_question"});
 });
 it("keeps normal helpful answers when no unsafe claim was made",()=>{
  const b=buildBuyerContext(["¿Cuál cargador me conviene?"],{catalog});
  const output=protectSalesResponse("Para saber si es compatible necesito la potencia y el modelo del equipo.",{catalog,buyer:b});
  expect(output.blocked).toBe(false);
 });
});
