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
  expect(reply.reply).toMatch(/no (?:hay|tengo) confirmaci[oó]n|a[uú]n no hay|todav[ií]a no se ha confirmado|desde este chat no se ha registrado/i);
  expect(reply.reply).not.toMatch(/ahora te paso|ya te pas[eé]|un asesor asignado en este chat/i);
  expect(reply.reply).not.toMatch(/nombre|celular|p[aá]same/i);
 });
 it("answers advisor-status question plainly without claiming an action",()=>{
  const b=buildBuyerContext(["Quiero hablar con un asesor","¿Ya le avisaste?"],{catalog});
  expect(b.current_topic).toBe("estado_derivacion");
  const reply=protectSalesResponse("Sí, ya está avisado.",{buyer:b,catalog});
  expect(reply.reason).toBe("human_requested");
  expect(reply.reply).toMatch(/^No\./u);
  expect(reply.reply).toMatch(/desde este chat no se ha registrado una derivaci[oó]n/i);
 });
 it("tells a ready buyer the actual next step without pretending checkout exists",()=>{
  const chosen=[{titulo:"Ulefone Armor X13",marca:"ULEFONE",partnumber:"ARMOR-X13",
     precio_soles:null,disponibilidad:"por confirmar"}];
  const b=buildBuyerContext(["Quiero el Armor X13, listo lo compro, cómo pago?"],{catalog:chosen});
  expect(b.current_intent).toBe("comprar");
  const reply=protectSalesResponse("Es un excelente celular para usarlo a diario.",{buyer:b,catalog:chosen});
  expect(reply.reason).toBe("purchase_not_ready");
  expect(reply.reply).toMatch(/no puedo crear un pedido ni un enlace de pago/i);
  expect(reply.reply).toMatch(/precio, disponibilidad/i);
 });
 it("removes unsolicited availability while retaining product benefits",()=>{
  const p=[{titulo:"Ulefone Armor 22",marca:"ULEFONE",partnumber:"ARMOR-22-256G",
   precio_soles:null,disponibilidad:"por confirmar"}];
  const buyer=buildBuyerContext(["Quiero el Armor 22, qué tal es?"],{catalog:p});
  const result=protectSalesResponse(
   "Trae batería de 6600 mAh para uso de campo. La disponibilidad está por confirmar; si lo usas en obra, su formato resistente puede servirte.",
   {buyer,catalog:p});
  expect(result.blocked).toBe(false);
  expect(result.reply).toContain("6600 mAh");
  expect(result.reply).not.toMatch(/disponibilidad|stock/i);
 });
 it("retains availability status when buyer explicitly asks",()=>{
  const p=[{titulo:"Ulefone Armor 22",marca:"ULEFONE",partnumber:"ARMOR-22-256G",
   precio_soles:null,disponibilidad:"por confirmar"}];
  const buyer=buildBuyerContext(["Hay stock del Armor 22?"],{catalog:p});
  const reply=protectSalesResponse("La disponibilidad está por confirmar.",{buyer,catalog:p});
  expect(reply.reply).toMatch(/disponibilidad/);
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
 it("blocks a phantom followup that escaped real-model QA",()=>{
  const b=buildBuyerContext(["Quiero 2 laptops Lenovo para trabajar con varias aplicaciones"]);
  const reply="Para ese uso te conviene la ThinkPad T14 de 32 GB. Si quieres, te ayudo a avanzar con ese modelo y dejar listo el seguimiento para revisar el pedido.";
  const result=protectSalesResponse(reply,{catalog,buyer:b});
  expect(result).toMatchObject({blocked:true,reason:"unconfirmed_action"});
  expect(result.reply).not.toMatch(/dejar listo el seguimiento|revisar el pedido/i);
 });
 it("allows an explicit denial that no followup was created",()=>{
  const b=buildBuyerContext(["Quiero 2 laptops para trabajar con varias aplicaciones"]);
  const reply="Todavía no se ha registrado ningún pedido ni seguimiento desde este chat.";
  const result=protectSalesResponse(reply,{catalog,buyer:b});
  expect(result.blocked).toBe(false);
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
 it("rejects conditional assertions that unpriced orders fit the client's budget",()=>{
  const buyer=buildBuyerContext(["Quiero 3 laptops con presupuesto de S/ 12000 en total"]);
  const cases=[
   "Con 3 unidades podrían encajar dentro del presupuesto.",
   "Estas laptops se ajustan a tu presupuesto.",
   "El presupuesto alcanza para estos artículos."
  ];
  for(const reply of cases)
    expect(protectSalesResponse(reply,{buyer,catalog}).reason).toBe("unverified_affordability");
 });
 it("allows truthful uncertainty about affordability",()=>{
  const buyer=buildBuyerContext(["Tengo S/ 12000 de presupuesto"]);
  const r=protectSalesResponse("No puedo confirmar que las laptops entren en ese presupuesto sin precios vigentes.",{buyer,catalog});
  expect(r.blocked).toBe(false);
 });
 it("invalidates the old SKU when a buyer switches to an unknown exact model",()=>{
  const priced=[
   {titulo:"Ulefone Armor X13",marca:"ULEFONE",partnumber:"ARMOR-X13",precio_soles:659},
   {titulo:"Impresora Epson L1250",marca:"EPSON",partnumber:"L1250",precio_soles:null}
  ];
  const b=buildBuyerContext(["¿Precio del Ulefone Armor X13?","Ahora quiero la Brother HL-L2340, ¿cuánto cuesta?"],{catalog:priced});
  expect(b.customer_reference).toBe("HL-L2340");
  expect(b.matched_partnumber).toBeNull();
  expect(b.mentioned_product_family).toBeNull();
  expect(protectSalesResponse("La Brother cuesta S/ 659.",{buyer:b,catalog:priced}).reason).toBe("unverified_price");
  expect(protectSalesResponse("El Ulefone Armor X13 cuesta S/ 659.",{buyer:b,catalog:priced}).reason).toBe("unverified_price");
 });
 it("restores grounded pricing only after the buyer returns to the known SKU",()=>{
  const priced=[{titulo:"Ulefone Armor X13",marca:"ULEFONE",partnumber:"ARMOR-X13",precio_soles:659}];
  const b=buildBuyerContext(["Quiero el Ulefone Armor X13","Mejor la Brother HL-L2340","Al final prefiero el Ulefone Armor X13, ¿cuánto cuesta?"],{catalog:priced});
  expect(b.matched_partnumber).toBe("ARMOR-X13");
  expect(b.customer_reference).toBeNull();
  expect(protectSalesResponse("El Ulefone Armor X13 cuesta S/ 659.",{buyer:b,catalog:priced}).blocked).toBe(false);
 });
 it("does not use a sole priced item for an unrelated unknown customer reference",()=>{
  const priced=[{titulo:"Ulefone Armor X13",marca:"ULEFONE",partnumber:"ARMOR-X13",precio_soles:659}];
  const b=buildBuyerContext(["¿Me das precio de Brother HL-L2340?"],{catalog:priced});
  expect(protectSalesResponse("La Brother cuesta S/ 659.",{buyer:b,catalog:priced}).reason).toBe("unverified_price");
 });
 it("never asks again for a complete model code already supplied",()=>{
  const b=buildBuyerContext(["Me interesa la Brother HL-L2340","¿Y el precio exacto?"],{catalog});
  for(const reply of [
   "Si me compartes el código completo, lo reviso con más precisión.",
   "Pásame el modelo exacto y te digo.",
   "Si me envías la referencia completa, podré orientarte."
  ])expect(protectSalesResponse(reply,{buyer:b,catalog}).reason).toBe("redundant_model_question");
 });
 it("does not offer to prepare an uncreated quote or model reference",()=>{
  const b=buildBuyerContext(["Quiero 2 laptops, ¿puedes cotizar?"],{catalog});
  for(const reply of [
   "Si quieres, puedo preparar la referencia de ambas variantes para revisión.",
   "Puedo armar la solicitud de cotización con tus datos.",
   "Puedo generar un resumen para revisión del equipo comercial."
  ])expect(protectSalesResponse(reply,{buyer:b,catalog}).reason).toBe("unconfirmed_action");
 });
 it("drops prior priced SKU when a customer clearly switches to another brand",()=>{
  const products=[{titulo:"Ulefone Armor X13",marca:"ULEFONE",partnumber:"ARMOR-X13",precio_soles:659}];
  const b=buildBuyerContext(["¿Precio del Ulefone Armor X13?","Ahora prefiero Epson, ¿cuánto cuesta?"],{catalog:products});
  expect(b.brand).toBe("EPSON");
  expect(b.matched_partnumber).toBeNull();
  expect(protectSalesResponse("La Epson cuesta S/ 659.",{buyer:b,catalog:products}).reason).toBe("unverified_price");
 });
 it("blocks unexecutable promise to validate a model reference",()=>{
  const b=buildBuyerContext(["Me interesa Brother HL-L2340","¿Y su precio?"],{catalog});
  const response=protectSalesResponse("Puedo ayudarte a validar la referencia correcta.",{buyer:b,catalog});
  expect(response.reason).toBe("unconfirmed_action");
 });
 it("blocks claims to prepare a human contact while buyer is ready to pay",()=>{
  const b=buildBuyerContext(["Quiero el Armor 22","Lo compro, ¿dónde pago?"],{catalog});
  const result=protectSalesResponse("Si quieres, te ayudo a dejar listo el contacto para que te orienten.",{buyer:b,catalog});
  expect(result.reason).toBe("unconfirmed_action");
  expect(result.reply).toMatch(/no hay un pedido ni un pago registrado/i);
 });
 it("never promises to provide a payment channel or link before checkout exists",()=>{
  const b=buildBuyerContext(["Listo, lo compro, ¿dónde pago?"],{catalog});
  for(const answer of [
   "Para seguir con la compra, te indico el canal de pago.",
   "Te paso los datos de pago.",
   "Puedo enviarte un enlace de pago."
  ])expect(protectSalesResponse(answer,{buyer:b,catalog}).reason).toBe("unconfirmed_action");
 });
 it("recognizes a natural request for advisor without demanding contact details",()=>{
  const buyer=buildBuyerContext([
    "Ya elegí los 2 celulares",
    "Entonces quiero que me atienda un asesor humano. ¿Puedes comunicarme con alguien?"
  ],{catalog});
  expect(buyer.requires_human).toBe(true);
  const guarded=protectSalesResponse("Para pasar a asesor necesito tu nombre y teléfono.",{buyer,catalog});
  expect(guarded.reason).toBe("human_requested");
  expect(guarded.reply).not.toMatch(/necesito tu nombre|dame tu celular/i);
 });
 it("does not treat the client's courier job as a delivery inquiry",()=>{
  const b=buildBuyerContext(["Tengo un minuto, busco el Ulefone Armor X13 para reparto"],{catalog:[
    {titulo:"Ulefone Armor X13",partnumber:"ARMOR-X13",marca:"ULEFONE"}]});
  expect(b.current_intent).toBe("consulta");
 });
 it("respects explicit no-comparison despite containing the word comparar",()=>{
  const b=buildBuyerContext(["Quiero la Epson L1250 y no quiero comparar"],{catalog});
  expect(b.current_intent).not.toBe("comparar");
 });
 it("detects practical next-step purchase request and blocks premature data collection",()=>{
  const p=[{titulo:"Epson L1250",partnumber:"EPSON-L1250",marca:"EPSON"}];
  const b=buildBuyerContext(["Necesito 2 Epson L1250, ¿cuál es el siguiente paso para comprarlas?"],{catalog:p});
  expect(b.current_intent).toBe("comprar");
  const guarded=protectSalesResponse("Envíame tu nombre completo y tu teléfono para registrar el pedido.",{buyer:b,catalog:p});
  expect(guarded.reason).toBe("premature_personal_data");
  expect(guarded.reply).not.toMatch(/env[ií]ame|nombre completo|tel[eé]fono/i);
 });
 it("accepts buyer who wants to think without pushing further",()=>{
  const b=buildBuyerContext(["Gracias, por ahora lo voy a pensar"],{catalog});
  expect(b.current_intent).toBe("despedida");
  expect(salesMove(b,{catalog}).stage).toBe("cierre_conversacion");
 });
 it("blocks invented pending advisor handling and request for the buyer's name",()=>{
  const catalog=[{titulo:"Epson EcoTank L1250",marca:"EPSON",partnumber:"EPSON-L1250",precio_soles:null}];
  const buyer=buildBuyerContext(["Quiero 2 Epson L1250, ¿cuál es el siguiente paso para comprarlas?"],{catalog});
  const replies=[
    "El siguiente paso real es dejar la referencia lista para que un asesor la revise y te confirme. Si deseas avanzar, solo me falta tu nombre y apellido para registrarlo.",
    "Para la compra me falta tu nombre completo y teléfono de contacto.",
    "Vamos a dejar tu interés registrado para seguimiento del asesor."
  ];
  for(const reply of replies){
    const gated=protectSalesResponse(reply,{buyer,catalog});
    expect(gated.blocked).toBe(true);
    expect(["unconfirmed_action","premature_personal_data"]).toContain(gated.reason);
    expect(gated.reply).not.toMatch(/tu nombre completo|tu nombre y apellido|dejar la referencia lista|seguimiento del asesor/i);
  }
 });
 it("keeps normal helpful answers when no unsafe claim was made",()=>{
  const b=buildBuyerContext(["¿Cuál cargador me conviene?"],{catalog});
  const output=protectSalesResponse("Para saber si es compatible necesito la potencia y el modelo del equipo.",{catalog,buyer:b});
  expect(output.blocked).toBe(false);
 });
});
