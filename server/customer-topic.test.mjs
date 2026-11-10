import {describe,it,expect} from "vitest";
import {classifyCustomerTopic,customerTopicInstructions} from "./customer-topic.mjs";
import {buildBuyerContext,buyerGuidance} from "./buyer-reasoning.mjs";
import {snapshotSalesMemory} from "./sales-memory.mjs";
import {salesMove} from "./sales-playbook.mjs";
import {protectSalesResponse} from "./sales-response-guard.mjs";
const catalog=[
 {titulo:"Ulefone Armor 22",marca:"ULEFONE",partnumber:"ARMOR-22-256G",precio_soles:999},
 {titulo:"Cargador USB-C",marca:"ANONIMO",partnumber:"CARGADOR-A",precio_soles:50},
 {titulo:"Impresora Epson L1250",marca:"EPSON",partnumber:"E-L1250",precio_soles:null},
 {titulo:"Laptop Lenovo T14",marca:"LENOVO",partnumber:"T14-16",precio_soles:null}
];
const buyer=(turns,opts={})=>buildBuyerContext(turns,{catalog,...opts});
describe("ALEX attends unrelated and service topics as a general-purpose seller",()=>{
 it.each([
  ["¿Me dan factura electrónica y aceptan pago con tarjeta?","facturacion_pago"],
  ["¿Debo mandar foto de mi DNI para que me respondan?","privacidad"],
  ["Mi impresora Epson no imprime negro","soporte_tecnico"],
  ["La compré aquí, ¿me la cambian o me devuelven mi plata?","devolucion_reclamo"],
  ["¿Ya me abriste un reclamo?","estado_reclamo"],
  ["¿La garantía cubre daño por agua?","garantia"],
  ["No me llegó mi pedido","pedido_existente"],
  ["¿Quién ganó el partido de fútbol de ayer?","fuera_del_negocio"],
  ["¿Qué significa SSD y RAM?","explicacion_tecnica"],
  ["¿Cuánto cuesta la Epson L1250?","comercial"]
 ])("routes %s without inventing policy (%s)",(text,topic)=>{
  expect(classifyCustomerTopic(text)).toBe(topic);
  expect(customerTopicInstructions(topic)).toContain("TIPO DE CONSULTA ACTUAL");
 });
 it("does not treat an unsent complaint as explicit request for human adviser",()=>{
  const b=buyer(["Compré una Epson L1250 y no imprime negro","¿Ya me abriste un reclamo?"]);
  expect(b.current_intent).toBe("postventa");
  expect(b.requires_human).toBe(false);
  expect(salesMove(b,{catalog}).stage).toBe("atencion_postventa");
  expect(buyerGuidance(b,{catalog})).toMatch(/ESTADO DE RECLAMO/);
 });
 it("answers invoicing as the current topic while retaining the previous SKU",()=>{
  const earlier=buyer(["Quiero 2 Ulefone Armor 22 para mi negocio"]);
  const memory=snapshotSalesMemory(earlier);
  const after=buyer(["¿Emiten factura electrónica y aceptan tarjeta?"],{memory});
  expect(after.current_topic).toBe("facturacion_pago");
  expect(after.current_intent).toBe("consulta_facturacion");
  expect(after.matched_partnumber).toBe("ARMOR-22-256G");
  expect(after.quantity).toBe(2);
  expect(salesMove(after,{catalog}).stage).toBe("facturacion_y_medios_de_pago");
 });
 it("does not recycle the Lenovo charger SKU for a different Samsung tablet",()=>{
  const old=buyer(["Busco cargador USB-C para mi laptop Lenovo"]);
  expect(old.matched_partnumber).toBe("CARGADOR-A");
  const next=buyer(["Pero ahora estoy viendo una tablet Samsung, ¿cuál recomiendas?"],{
    memory:snapshotSalesMemory(old)
  });
  expect(next.brand).toBe("SAMSUNG");
  expect(next.matched_partnumber).toBeNull();
  expect(next.customer_reference).toBeNull();
  const guard=protectSalesResponse("La tablet Samsung cuesta S/ 50.",{buyer:next,catalog});
  expect(guard.reason).toBe("unverified_price");
 });
 it("does not confuse a requested billing policy with permission to take a payment",()=>{
  const b=buyer(["¿Aceptan tarjeta y emiten factura electrónica?"]);
  const g=protectSalesResponse("Sí, aceptamos tarjeta y emitimos factura electrónica.",{buyer:b,catalog});
  expect(g.blocked).toBe(true);
  expect(g.reply).toMatch(/factura electrónica y el pago con tarjeta/i);
  expect(g.reply).not.toMatch(/sí, aceptamos/i);
 });
 it("does not pretend to have approved a refund or created a support ticket",()=>{
  const refund=buyer(["Compré la Epson L1250 y no funciona","¿Me devuelven el dinero?"]);
  const r=protectSalesResponse("Claro, te devolvemos tu dinero, el reembolso está aprobado.",{buyer:refund,catalog});
  expect(r.blocked).toBe(true);
  expect(r.reply).toMatch(/requiere revisión del caso/i);
  const complaint=buyer(["¿Ya me abriste un reclamo?"]);
  const c=protectSalesResponse("Sí, ya te abrí un reclamo y quedó registrado.",{buyer:complaint,catalog});
  expect(c.blocked).toBe(true);
  expect(c.reply).toMatch(/No tengo confirmación/i);
  expect(c.reason).toBe("unconfirmed_action");
 });
 it("cannot promise opening a support case, but can clearly state it has not",()=>{
  const b=buyer(["Compré una Epson L1250. No imprime negro, ¿qué hago?"],{catalog});
  const unsafe=protectSalesResponse("Si quieres, puedo ayudar a dejar el caso para revisión del servicio técnico.",{buyer:b,catalog});
  expect(unsafe.blocked).toBe(true);
  expect(unsafe.reply).not.toMatch(/dejar el caso/i);
  const safe=protectSalesResponse("No puedo registrar un reclamo desde este chat; necesitas una comprobación del equipo de atención.",{buyer:b,catalog});
  expect(safe.blocked).toBe(false);
 });
 it("rejects an unsupported numeric warranty period but retains a truthful unknown",()=>{
  const b=buyer(["¿Cuánto dura la garantía de la Epson L1250?"]);
  const r=protectSalesResponse("Tiene garantía de 24 meses, confirmada.",{buyer:b,catalog});
  expect(r.blocked).toBe(true);
  expect(r.reply).toMatch(/falta comprobar la cobertura y el plazo/i);
  const safe=protectSalesResponse("No tengo confirmado el plazo de garantía de la Epson L1250.",{buyer:b,catalog});
  expect(safe.blocked).toBe(false);
 });
 it("does not force selling when buyer asks unrelated live sports result",()=>{
  const b=buyer(["Quiero una Lenovo T14","¿Quién ganó el partido de fútbol de ayer?"]);
  expect(b.current_intent).toBe("consulta_ajena");
  expect(salesMove(b,{catalog}).stage).toBe("respuesta_puntual");
  expect(buyerGuidance(b,{catalog})).toMatch(/PREGUNTA AJENA AL NEGOCIO/);
 });
});
