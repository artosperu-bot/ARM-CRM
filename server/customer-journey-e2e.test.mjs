import {describe,it,expect} from "vitest";
import {buildBuyerContext} from "./buyer-reasoning.mjs";
import {snapshotSalesMemory} from "./sales-memory.mjs";
import {requestsProductPhoto,verifiedProductPhoto} from "./product-photo.mjs";
import {protectSalesResponse} from "./sales-response-guard.mjs";
import {analyzeSalesConversation} from "./lead-intelligence.mjs";
import {assessCommercialReadiness} from "./commercial-readiness.mjs";
import {HUMAN_QUEUE_CONFIRMED_REPLY} from "./human-handoff-phrasing.mjs";

const catalog=[
 {titulo:"Ulefone Armor X13 64GB",marca:"ULEFONE",partnumber:"ARMOR-X13",
  precio_soles:null,disponibilidad:"por confirmar",oferta_simulada:false,origen_datos:"precio_no_verificado"},
 {titulo:"Ulefone Armor 22 256GB",marca:"ULEFONE",partnumber:"ARMOR-22-256G",
  precio_soles:null,disponibilidad:"por confirmar",oferta_simulada:false,origen_datos:"precio_no_verificado"},
 {titulo:"Impresora Epson L1250",marca:"EPSON",partnumber:"E-L1250",
  precio_soles:null,disponibilidad:"por confirmar",oferta_simulada:false,origen_datos:"precio_no_verificado"}
];
const official={
 "ARMOR-X13":{product_image:{
  value:{verified_sku:"ARMOR-X13",url:"https://store.ulefone.com/cdn/shop/files/Ulefone_Rugged_Phone_Armor_X_13.jpg?v=1729493371&width=1024"},
  source_type:"manufacturer",source_url:"https://store.ulefone.com/es/products/armor-x13"
 }},
 "ARMOR-22-256G":{product_image:{
  value:{verified_sku:"ARMOR-22-256G",url:"https://store.ulefone.com/cdn/shop/files/Rugged_Phone_Armor_22_Night_Vision_Camera.jpg?v=1762843122&width=1024"},
  source_type:"manufacturer",source_url:"https://store.ulefone.com/es/products/armor-22"
 }}
};
function conversation(catalogRows=catalog){
 let memory=null;
 const history=[];
 const next=(message)=>{
  const buyer=buildBuyerContext([message],{catalog:catalogRows,memory});
  memory=snapshotSalesMemory(buyer,{previous:memory,lastMessageAt:new Date().toISOString()});
  history.push({direction:"inbound",content:message,external_message_id:"turn-"+history.length});
  return {buyer,memory,commercial:assessCommercialReadiness(buyer,{catalog:catalogRows}),message};
 };
 return {next,history,memory:()=>memory};
}
describe("end-to-end sales conversation states: browse → photo → switch → quantities → buy or cancel",()=>{
 it("keeps a coherent purchase journey without inventing price, stock, checkout or quote",()=>{
  const c=conversation();
  const first=c.next("oe busco Armor X13 para obra, qué tal es?");
  expect(first.memory.selected_partnumber).toBe("ARMOR-X13");
  expect(first.buyer.quantity).toBeNull();

  const askPhoto=c.next("oe pasame una foto del X13");
  expect(requestsProductPhoto(askPhoto.message)).toBe(true);
  const photo=verifiedProductPhoto({buyer:askPhoto.buyer,catalog,factsByPn:official});
  expect(photo?.partnumber).toBe("ARMOR-X13");

  const changed=c.next("mejor ahora pasame foto del Armor 22, no del X13");
  expect(changed.buyer.matched_partnumber).toBe("ARMOR-22-256G");
  expect(changed.memory.selected_partnumber).toBe("ARMOR-22-256G");
  const newPhoto=verifiedProductPhoto({buyer:changed.buyer,catalog,factsByPn:official});
  expect(newPhoto?.partnumber).toBe("ARMOR-22-256G");
  expect(newPhoto?.url).not.toBe(photo?.url);

  const count=c.next("quiero 3 celulares del que acabas de mostrar");
  expect(count.buyer.quantity).toBe(3);
  expect(count.memory.selected_partnumber).toBe("ARMOR-22-256G");

  const corrected=c.next("noo era 2, me equivoqué");
  expect(corrected.buyer.quantity).toBe(2);
  expect(corrected.memory.selected_partnumber).toBe("ARMOR-22-256G");

  const pricing=c.next("cuanto cuestan los 2");
  const bogusPrice=protectSalesResponse("S/ 1,299 cada equipo.",{catalog,buyer:pricing.buyer});
  expect(pricing.buyer.quantity).toBe(2);
  expect(bogusPrice.blocked).toBe(true);
  expect(bogusPrice.reply).not.toMatch(/1,299|1299/);
  expect(pricing.commercial.priceEvidence).toBe(false);

  const stock=c.next("tienen stock ahorita?");
  const bogusStock=protectSalesResponse("Nos quedan 15 unidades para entrega inmediata.",{catalog,buyer:stock.buyer});
  expect(bogusStock.blocked).toBe(true);
  expect(bogusStock.reply).not.toMatch(/15 unidades|entrega inmediata/i);
  expect(stock.commercial.saleableStock).toBe(false);

  const checkout=c.next("listo lo compro, como hago para pagar?");
  expect(checkout.buyer.current_intent).toBe("comprar");
  expect(checkout.commercial.quantity).toBe(2);
  expect(checkout.commercial.orderCreated).toBe(false);
  expect(checkout.commercial.paymentRegistered).toBe(false);
  expect(checkout.commercial.quoteCreated).toBe(false);
  expect(checkout.commercial.blockers).toContain("precio_vigente_por_confirmar");
  expect(checkout.commercial.blockers).toContain("disponibilidad_vendible_por_confirmar");

  const cancelled=c.next("ya no quiero comprar, gracias");
  expect(cancelled.buyer.cancelled_purchase).toBe(true);
  const lead=analyzeSalesConversation(c.history);
  expect(lead.intent).toBe("consulta_general");
  expect(lead.priority).toBe("baja");
  expect(lead.followup_suppressed).toBe(true);
  expect(lead.signals).not.toContain("compra_explicita");
 });
 it("keeps after-sale support out of selling and never invents human assignment",()=>{
  const c=conversation();
  const issue=c.next("compré la impresora y mi pedido no llega, qué pasó?");
  expect(issue.buyer.requires_human).toBe(true);
  const reply=protectSalesResponse("Ya te pasé con Juan, tu caso quedó asignado.",{catalog,buyer:issue.buyer});
  expect(reply.reason).toBe("human_requested");
  expect(reply.reply).not.toMatch(/ya te pas[eé]|Juan|qued[oó] asignado/iu);
  const triage=analyzeSalesConversation(c.history,{threadStatus:"pending"});
  expect(triage.should_reply).toBe(false);
  expect(triage.requires_human).toBe(true);

  const followup=c.next("YA LE AVISASTE A UN ASESOR?");
  const noPhantom=protectSalesResponse("Sí, ya le avisé y lo asigné.",{catalog,buyer:followup.buyer});
  expect(noPhantom.reply).toMatch(/no tengo confirmaci[oó]n|todav[ií]a no se ha confirmado|a[uú]n no|desde este chat no se ha registrado/i);
  expect(HUMAN_QUEUE_CONFIRMED_REPLY).toMatch(/cola.*atenci[oó]n humana/i);
  expect(HUMAN_QUEUE_CONFIRMED_REPLY).not.toMatch(/asign[eé] a Juan|ahora te paso/i);
 });
 it("honors durable opt-out even after a previous buying conversation",()=>{
  const before=analyzeSalesConversation([
   {direction:"inbound",content:"Quiero comprar dos equipos"},
   {direction:"inbound",content:"No me escriban más"}
  ]);
  expect(before.opt_out).toBe(true);
  expect(before.should_reply).toBe(false);
  const after=analyzeSalesConversation([
   {direction:"inbound",content:"hola"}
  ],{previousOptOut:before.opt_out});
  expect(after.opt_out).toBe(true);
  expect(after.should_reply).toBe(false);
 });
 it("doesn't send a product image when asked for a camera sample or personal DNI",()=>{
  expect(requestsProductPhoto("quiero ver fotos tomadas con la cámara del X13")).toBe(false);
  expect(requestsProductPhoto("no te voy a pasar foto del DNI")).toBe(false);
  expect(requestsProductPhoto("foto del Armor X13")).toBe(true);
 });
});
