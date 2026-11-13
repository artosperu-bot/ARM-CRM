import {describe,it,expect} from "vitest";
import {colloquial20} from "./qa-colloquial-scenarios.mjs";
import {buildBuyerContext,buyerGuidance} from "./buyer-reasoning.mjs";
import {snapshotSalesMemory} from "./sales-memory.mjs";
import {needsPostSaleSpecialist,classifyCustomerTopic} from "./customer-topic.mjs";
import {analyzeSalesConversation,immediateStop} from "./lead-intelligence.mjs";
import {protectSalesResponse} from "./sales-response-guard.mjs";
import {asksFormalComplaintReplyDeadline,lawfulComplaintDeadlineReply} from "./peru-consumer-knowledge.mjs";
const catalog=[
 {titulo:"Ulefone Armor 22 256GB",marca:"ULEFONE",partnumber:"ARMOR-22-256G",precio_soles:null},
 {titulo:"Epson L1250",marca:"EPSON",partnumber:"E-L1250",precio_soles:null},
 {titulo:"Lenovo ThinkPad T14 16 GB",marca:"LENOVO",partnumber:"T14-16",precio_soles:null},
 {titulo:"Lenovo ThinkPad T14 32 GB",marca:"LENOVO",partnumber:"T14-32",precio_soles:null}
];
const buyer=(msgs,options={})=>buildBuyerContext(msgs,{catalog,...options});
const msg=(content)=>({direction:"inbound",content,external_message_id:"wamid.qa"});
describe("20 realistic WhatsApp-style STECH customer scenarios",()=>{
 it("has exactly 20 distinct synthetic conversations and no real customer identifiers",()=>{
  expect(colloquial20).toHaveLength(20);
  expect(new Set(colloquial20.map(x=>x.name)).size).toBe(20);
  for(const c of colloquial20){
   expect(c.turns.length).toBeGreaterThanOrEqual(2);
   expect(c.turns.every(x=>typeof x==="string"&&x.length<200)).toBe(true);
   expect(c.name).toMatch(/^REAL20_/);
  }
 });
 it("does not mistake informal 'mano' for request for used laptops",()=>{
  const first=buyer(["quiero 3 laptops t14 para la ofi"]);
  expect(first.quantity).toBe(3);
  const next=buyer(["noo era 2 mano me equivoque"],{memory:snapshotSalesMemory(first)});
  expect(next.quantity).toBe(2);
  expect(buyerGuidance(next,{catalog})).toMatch(/mano.*segunda mano/i);
 });
 it("preserves correction into another turn and never revives quantity three",()=>{
  const first=buyer(["quiero 3 laptops t14 para la ofi"]);
  const second=buyer(["noo era 2 mano me equivoque"],{memory:snapshotSalesMemory(first)});
  const third=buyer(["y en 16 o 32 q conviene?"],{memory:snapshotSalesMemory(second)});
  expect(third.quantity).toBe(2);
 });
 it("recognizes product shorthand 5 units without confusing Armor 22 or 65W",()=>{
  expect(buyer(["armor 22 precio x 5"]).quantity).toBe(5);
  expect(buyer(["armor 22 precio x 5"]).current_intent).toBe("consultar_precio");
  expect(buyer(["tienes cargador lenovo 65w usb c"]).quantity).toBeNull();
 });
 it("classifies casual price and discount slang correctly",()=>{
  expect(buyer(["y cuanto esta ps?"]).current_intent).toBe("consultar_precio");
  expect(buyer(["asu sta caro pe, no hay rebaja si llevo los 5?"]).current_intent).toBe("objecion");
 });
 it.each([
  "mi epson l1250 se malogro",
  "lo compre con ustedes y ya no sirve, me dan otra o q?",
  "mi armor 22 se mojo y ahora no prende, recien lo compre",
  "mi producto llego roto en caja",
  "mi pedido no llega",
  "compre la impresora y a los 2 dias falló"
 ])("routes serious existing purchase problems to a human without marketing (%s)",(message)=>{
  expect(needsPostSaleSpecialist(message)).toBe(true);
  expect(immediateStop(message)).toBe(true);
  const r=analyzeSalesConversation([msg(message)]);
  expect(r.requires_human).toBe(true);
  expect(r.should_reply).toBe(false);
  const b=buyer([message]);
  expect(b.requires_human).toBe(true);
  const reply=protectSalesResponse("Pásame tu nombre y celular para enviarte el caso al asesor.",{buyer:b,catalog});
  expect(reply.blocked).toBe(true);
  expect(reply.reason).toBe("human_requested");
  expect(reply.reply).toMatch(/(?:requiere revisi[oó]n humana|no tengo confirmaci[oó]n|desde este chat no se ha registrado)/i);
  expect(reply.reply).not.toMatch(/nombre|celular|ya lo derivamos/i);
 });
 it.each([
  "si se malogra más adelante que hago?",
  "qué pasa si se moja un celular?",
  "qué garantía tiene el Armor 22?"
 ])("does not unnecessarily mark hypothetical questions as a human handoff (%s)",(message)=>{
  expect(needsPostSaleSpecialist(message)).toBe(false);
  expect(immediateStop(message)).toBe(false);
 });
 it.each([
  "quiero q un asesor vea esto ya ps",
  "pasame con alguien que solucione esto ya",
  "ya ps quiero hablar con persona no con robot"
 ])("recognizes a natural colloquial human request (%s)",(message)=>{
  expect(buyer([message]).requires_human).toBe(true);
  expect(immediateStop(message)).toBe(true);
 });
 it("keeps handoff pending rather than saying an advisor was notified",()=>{
  const old=buyer(["mi producto llego roto en caja"]);
  const following=buyer(["ya le avisaron a alguien o sigo esperando?"],{memory:snapshotSalesMemory(old)});
  expect(following.current_topic).toBe("estado_derivacion");
  expect(following.requires_human).toBe(true);
  const reply=protectSalesResponse("Sí, ya le avisé y lo derivé.",{buyer:following,catalog});
  expect(reply.blocked).toBe(true);
  expect(reply.reply).toMatch(/(?:requiere revisi[oó]n humana|no tengo confirmaci[oó]n|desde este chat no se ha registrado)/i);
  expect(reply.reply).not.toMatch(/ya le avisé|ya lo derivé/i);
 });
 it("uses the verified 15-business-day formal reply period",()=>{
  const q="cuantos dias tienen para responder mi reclamo?";
  expect(asksFormalComplaintReplyDeadline(q)).toBe(true);
  const b=buyer([q]);
  expect(b.current_topic).toBe("plazo_reclamo");
  const r=protectSalesResponse("Tienes 30 días calendario para que respondan y prórroga adicional.",{buyer:b,catalog});
  expect(r.reason).toBe("official_complaint_reply_deadline");
  expect(r.reply).toBe(lawfulComplaintDeadlineReply);
  expect(r.reply).toMatch(/15 días hábiles/);
  expect(r.reply).not.toMatch(/30 días|devoluci[oó]n aprobada/i);
 });
 it("gives accessible Libro de Reclamaciones steps without inventing a STECH link",()=>{
  const b=buyer(["oe y el libro d reclamaciones donde esta"]);
  expect(b.current_topic).toBe("libro_reclamaciones");
  const r=protectSalesResponse("Sí tenemos libro virtual, te mando el enlace.",{buyer:b,catalog});
  expect(r.reason).toBe("official_complaint_book_access");
  expect(r.reply).toMatch(/Puedes solicitar el Libro de Reclamaciones/i);
  expect(r.reply).not.toMatch(/sí tenemos libro virtual|te mando el enlace/i);
 });
 it("rejects unperformed consultation followup after colloquial price inquiry",()=>{
  const b=buyer(["armor 22 precio x 5"]);
  for(const reply of [
   "Ahorita no tengo el precio confirmado. Si quieres te lo dejo listo para revisión.",
   "Puedo ayudarte a dejar la consulta para cotización.",
   "Sí te puedo ayudar a dejarlo listo apenas se valide el importe."
  ]){
   const r=protectSalesResponse(reply,{buyer:b,catalog});
   expect(r.blocked).toBe(true);
   expect(r.reply).not.toMatch(/te lo dejo listo|dejar la consulta/i);
  }
 });
 it("does not emit robotic message when unverified stock query triggers a guard",()=>{
  const b=buyer(["buenas la epson l1250 cuanto sale","tienes ahorita? necesito una nomas"]);
  const r=protectSalesResponse("Te puedo ayudar a dejarlo listo para revisión de stock.",{buyer:b,catalog});
  expect(r.blocked).toBe(true);
  expect(r.reply).toMatch(/disponibilidad de ese modelo está por confirmar/i);
  expect(r.reply).not.toMatch(/Lo solicitado requiere información/i);
 });
 it("never promises to message the buyer later without a scheduled operation",()=>{
  const p=buyer(["buenas la epson l1250 cuanto sale"]);
  const samples=[
   "No tengo precio confirmado. Si quieres, te ayudo a revisar y te aviso apenas se confirme.",
   "El precio está por confirmar. En cuanto se confirme, te digo si se puede atender.",
   "No tengo precio vigente. Si me autorizas a seguir, lo dejo para verificación y te respondo apenas esté validado.",
   "Primero confirmamos el precio de las 5 unidades y ahí recién vemos el total."
  ];
  for(const txt of samples){
    const b=txt.includes("5 unidades")?buyer(["armor 22 precio x 5"]):p;
    const r=protectSalesResponse(txt,{buyer:b,catalog});
    expect(r.blocked).toBe(true);
    expect(r.reply).not.toMatch(/te aviso apenas|te respondo apenas|en cuanto se confirme, te digo|primero confirmamos/i);
  }
 });
 it("uses a factual answer when the database has no verified price or saleable stock",()=>{
  const price=buyer(["buenas la epson l1250 cuanto sale"]);
  const rp=protectSalesResponse("Te aviso luego apenas consiga el precio.",{buyer:price,catalog});
  expect(["unconfirmed_action","unverified_price"]).toContain(rp.reason);
  expect(rp.reply).toMatch(/precio.*confirmad/i);
  expect(rp.reply).not.toMatch(/te aviso|luego/i);
  const next=buyer(["tienes ahorita? necesito una nomas"],{memory:snapshotSalesMemory(price)});
  expect(next.current_intent).toBe("disponibilidad");
  const rs=protectSalesResponse("Si me das un momento lo verifico.",{buyer:next,catalog});
  expect(rs.reason).toBe("unverified_availability");
  expect(rs.reply).toMatch(/disponibilidad.*por confirmar/i);
  expect(rs.reply).not.toMatch(/un momento|verifico/i);
 });
 it("gives a commercial answer to a colloquial volume-discount objection",()=>{
  const b=buyer(["armor 22 precio x 5","asu sta caro pe, no hay rebaja si llevo los 5?"]);
  expect(b.quantity).toBe(5);
  expect(b.current_intent).toBe("objecion");
  const r=protectSalesResponse("Puedo dejarte un seguimiento para revisar tu rebaja.",{buyer:b,catalog});
  expect(r.blocked).toBe(true);
  expect(r.reply).toMatch(/mejor precio por 5 unidades/i);
  expect(r.reply).not.toMatch(/Lo solicitado requiere información/i);
 });
 it("does not mistake refund's seven days for formal complaint reply term",()=>{
  const q="segun yo en 7 dias te devuelven si o si, es asi?";
  expect(asksFormalComplaintReplyDeadline(q)).toBe(false);
  expect(protectSalesResponse("No existe un plazo universal de devolución por solo cambio de opinión; depende de la política y el caso.",{
   buyer:buyer([q]),catalog
  }).reason).toBe(null);
 });
 it("routes book of complaints and existing order status separately",()=>{
  expect(classifyCustomerTopic("oe y el libro d reclamaciones donde esta")).toBe("libro_reclamaciones");
  expect(classifyCustomerTopic("lo pedi hace 5 dias ya lo mandaron o no")).toBe("pedido_existente");
  expect(classifyCustomerTopic("compre la impresora y a los 2 dias falló")).toBe("soporte_tecnico");
 });
 it("does not promise the exact status of a non-integrated order",()=>{
  const b=buyer(["lo pedi hace 5 dias, ya lo mandaron o no"]);
  const r=protectSalesResponse("Si me das tu número de pedido te digo el estado exacto y si ya lo despacharon.",{buyer:b,catalog});
  expect(r.blocked).toBe(true);
  expect(r.reply).not.toMatch(/te digo el estado exacto/i);
 });
});
