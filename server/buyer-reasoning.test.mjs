import {describe,it,expect} from "vitest";
import {buildBuyerContext,buyerGuidance} from "./buyer-reasoning.mjs";
import {protectSalesResponse,hideExactStockUnits} from "./sales-response-guard.mjs";
const simulated=[{titulo:"Ulefone Armor 22",partnumber:"ARMOR-22-256G",precio_soles:999,disponibilidad:"por confirmar",oferta_simulada:true}];
const real=[{titulo:"Ulefone Armor 22",partnumber:"ARMOR-22-256G",precio_soles:null,disponibilidad:"por confirmar",oferta_simulada:false}];
describe("ALEX buyer journey: continuity across turns",()=>{
 it("remembers company, devices, overall budget and latest correction without repeated questions",()=>{
  const b=buildBuyerContext([
   "Necesito 3 laptops Lenovo para mi empresa, tengo presupuesto de S/ 12000 en total",
   "Se usarán en la oficina",
   "Mejor 2 laptops, ¿puedes cotizar?"
  ]);
  expect(b.quantity).toBe(2);
  expect(b.budget).toEqual({pen:12000,scope:"total"});
  expect(b.brand).toBe("LENOVO");
  expect(b.use_case).toBe("oficina");
  expect(b.buyer_type).toBe("empresa_indicada");
  expect(b.current_intent).toBe("cotizar");
  expect(b.next_step).toMatch(/cotizacion/);
  expect(buyerGuidance(b)).toContain("cantidad solicitada: 2 equipos");
 });
 it("remembers most recent budget and doesn't invent one from a price question",()=>{
  const b=buildBuyerContext(["Tengo presupuesto de S/ 5000","Lo puedo subir hasta S/ 6200","¿Cuánto cuesta una Lenovo?"]);
  expect(b.budget.pen).toBe(6200);
  expect(b.current_intent).toBe("consultar_precio");
  expect(buildBuyerContext(["¿La laptop cuesta S/ 3600?"]).budget).toBe(null);
 });
 it("distinguishes a single buyer and RAM/storage from quantities",()=>{
  const b=buildBuyerContext(["Quiero un Armor 22 256GB 8GB de RAM"],{catalog:simulated});
  expect(b.quantity).toBe(null);
  expect(b.mentioned_product_family).toBe("Ulefone Armor 22");
  expect(b.is_b2b_signal).toBe(false);
 });
 it("qualifies two devices as possible B2B, but not confirmed legal identity",()=>{
  const b=buildBuyerContext(["Busco 2 laptops para estudiar"]);
  expect(b.quantity).toBe(2);
  expect(b.buyer_type).toBe("posible_b2b");
  expect(b.known_facts.join(" ")).toMatch(/señal/);
 });
 it("doesn't stick to an earlier buying intent after customer cancels",()=>{
  const b=buildBuyerContext(["Quiero comprar dos laptops","Ya no quiero comprar"]);
  expect(b.explicit_purchase).toBe(false);
  expect(b.cancelled_purchase).toBe(true);
  expect(b.next_step).toBe("respetar_decision_sin_insistir");
 });
 it("says goodbye without forcing another closing question",()=>{
  const b=buildBuyerContext(["Dame el precio de Armor X13","Gracias por todo"]);
  expect(b.current_intent).toBe("despedida");
  expect(b.next_step).toBe("cerrar_cordialmente_sin_venta_agresiva");
 });
 it("handles 'no quiero hablar con asesor' correctly",()=>{
  const b=buildBuyerContext(["No quiero hablar con un asesor; quiero saber el precio del Armor 22"]);
  expect(b.requires_human).toBe(false);
 });
 it("uses urgency only from latest message; no false 'urgent' forever",()=>{
  const b=buildBuyerContext(["Lo necesito urgente","No es urgente, podemos verlo más adelante"]);
  expect(b.urgency).toBe(false);
 });
 it("does not extract private phone numbers or identifiers into the sales profile",()=>{
  const b=buildBuyerContext(["Soy Ana, mi número es 987654321. Busco una laptop"]);
  expect(JSON.stringify(b.known_facts)).not.toContain("987654321");
  expect(b.quantity).toBe(1); // una laptop es una cantidad válida; el teléfono no se almacena.
 });
});
describe("ALEX deterministic outgoing checks",()=>{
 it("allows an explicitly requested and authorized sandbox price",()=>{
  const buyer=buildBuyerContext(["¿Cuánto cuesta el Armor 22?"]);
  const res=protectSalesResponse("*Armor 22*: S/ 999",{catalog:simulated,buyer,simulated:true});
  expect(res.blocked).toBe(false);
 });
 it("blocks an invented price in a real catalog with no verified price",()=>{
  const buyer=buildBuyerContext(["¿Cuánto cuesta el Armor 22?"]);
  const res=protectSalesResponse("Te cuesta S/ 999",{catalog:real,buyer});
  expect(res).toMatchObject({blocked:true,reason:"unverified_price"});
  expect(res.reply).not.toContain("999");
 });
 it("blocks fabricated price even in simulation if it differs from authorized offer",()=>{
  const buyer=buildBuyerContext(["Precio del Armor 22"]);
  const res=protectSalesResponse("S/ 2599",{catalog:simulated,buyer,simulated:true});
  expect(res.reason).toBe("unverified_price");
 });
 it("does not disclose unsolicited prices even if they appear in the catalog",()=>{
  const buyer=buildBuyerContext(["Quiero un celular resistente, ¿qué recomiendas?"]);
  const res=protectSalesResponse("Armor 22 es bueno, S/ 999",{catalog:simulated,buyer,simulated:true});
  expect(res.blocked).toBe(true);
 });
 it("allows client budget restatement but never turns it into an offer",()=>{
  const buyer=buildBuyerContext(["Mi presupuesto es S/ 5000 para dos laptops"]);
  const res=protectSalesResponse("Con tu presupuesto de S/ 5000 podemos revisar opciones sin cotizar todavía.",{catalog:real,buyer});
  expect(res.blocked).toBe(false);
 });
 it("blocks claims of completed booking and sale without server confirmation",()=>{
  const buyer=buildBuyerContext(["Quiero comprar el Armor 22"]);
  expect(protectSalesResponse("Tu pedido está confirmado.",{buyer,catalog:simulated}).reason).toBe("unconfirmed_action");
  expect(protectSalesResponse("Ya te agendé la visita.",{buyer,catalog:simulated}).reason).toBe("unconfirmed_action");
 });
 it("blocks unauthorized discounts and unverified delivery deadlines",()=>{
  const buyer=buildBuyerContext(["¿Hay descuento?"]);
  expect(protectSalesResponse("Tienes descuento del 25%",{buyer,catalog:simulated}).reason).toBe("unapproved_discount");
  expect(protectSalesResponse("Te llega mañana.",{buyer,catalog:simulated}).reason).toBe("delivery_promise");
 });
 it("keeps the client's intended quantity but hides actual warehouse stock numbers",()=>{
  expect(hideExactStockUnits("Quieres 3 equipos Lenovo.")).toBe("Quieres 3 equipos Lenovo.");
  expect(hideExactStockUnits("Tenemos 12 unidades en stock.")).not.toMatch(/12|unidades en stock/);
  expect(protectSalesResponse("Tenemos 12 unidades en stock.",{catalog:real}).reason).toBe("exact_stock");
 });
});
