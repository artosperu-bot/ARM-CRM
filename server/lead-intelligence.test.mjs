import {describe,it,expect} from "vitest";
import {analyzeSalesConversation,immediateStop} from "./lead-intelligence.mjs";
const msg=(content)=>({direction:"inbound",content,external_message_id:"wamid.qa"});
describe("Lead intelligence: sales signals and safe automatic actions",()=>{
 it("prioritizes explicit B2B purchase of two devices, without inventing a sale",()=>{
   const result=analyzeSalesConversation([msg("Para mi empresa necesito 3 laptops Lenovo esta semana. Envíame una cotización, quiero comprar")]);
   expect(result.is_b2b).toBe(true);
   expect(result.quantity_min).toBe(3);
   expect(result.intent).toBe("compra");
   expect(result.priority).toBe("alta");
   expect(result.next_action).toContain("verificadas");
   expect(result.followup_suppressed).toBe(true);
   expect(result.source_mode).toBe("sandbox");
 });
 it("detects price questions without claiming purchase",()=>{
   const r=analyzeSalesConversation([msg("Hola, ¿cuánto cuesta el Armor 22?")]);
   expect(r.intent).toBe("cotizacion");
   expect(r.priority).toBe("media");
   expect(r.signals).not.toContain("compra_explicita");
   expect(r.should_reply).toBe(true);
 });
 it("distinguishes a company inquiry without an exact count",()=>{
   const r=analyzeSalesConversation([msg("Quiero cotizar computadoras para mi empresa")]);
   expect(r.is_b2b).toBe(true);
   expect(r.quantity_min).toBe(null);
 });
 it("does not treat third-party bot messages as buyer intent",()=>{
   const r=analyzeSalesConversation([msg("Hola"),{direction:"outbound",content:"Puedes comprar con S/ 999 o cotizar 10 laptops"}]);
   expect(r.priority).toBe("baja");
   expect(r.is_b2b).toBe(false);
 });
 it("stops all proactive followup on unsubscribe and persists across a later hello",()=>{
   const first=analyzeSalesConversation([msg("No me escriban más")]);
   expect(first.opt_out).toBe(true);
   expect(first.should_reply).toBe(false);
   expect(first.suppression_reason).toBe("opt_out");
   const later=analyzeSalesConversation([msg("hola")],{previousOptOut:first.opt_out});
   expect(later.should_reply).toBe(false);
   expect(later.opt_out).toBe(true);
 });
 it("explicit new consent can clear opt-out but never enables followup automatically",()=>{
   const r=analyzeSalesConversation([msg("Sí, pueden volver a escribirme")],{previousOptOut:true});
   expect(r.opt_out).toBe(false);
   expect(r.followup_suppressed).toBe(true);
   expect(r.should_reply).toBe(true);
 });
 it("customer request for a real person suppresses AI immediately",()=>{
   const r=analyzeSalesConversation([msg("Quiero hablar con un asesor")]);
   expect(immediateStop("Quiero hablar con un asesor")).toBe(true);
   expect(r.requires_human).toBe(true);
   expect(r.should_reply).toBe(false);
   expect(r.priority).toBe("alta");
 });
 it("human ownership and closed conversations always suppress AI",()=>{
   expect(analyzeSalesConversation([msg("Precio por favor")],{threadStatus:"human"}).should_reply).toBe(false);
   expect(analyzeSalesConversation([msg("Precio por favor")],{threadStatus:"closed"}).score).toBe(0);
   expect(analyzeSalesConversation([msg("Precio")],{assignedTo:"staff"}).should_reply).toBe(false);
 });
 it("does not mistake 256 GB capacity for number of products",()=>{
   const r=analyzeSalesConversation([msg("¿Cuánto cuesta el Armor 22 de 256 GB?")]);
   expect(r.quantity_min).toBe(null);
   expect(r.is_b2b).toBe(false);
 });
 it("does not classify unrelated quantities as hardware B2B",()=>{
   const r=analyzeSalesConversation([msg("Quiero comprar 2 boletos para un evento")]);
   expect(r.is_b2b).toBe(false);
 });
 it("does not ask a human after an explicit refusal",()=>{
   const r=analyzeSalesConversation([msg("No quiero hablar con un asesor, dime el precio del Armor 22")]);
   expect(r.requires_human).toBe(false);
   expect(immediateStop("No quiero hablar con un asesor")).toBe(false);
 });
 it("does not stick a historical human request after advisor releases the thread",()=>{
   const r=analyzeSalesConversation([
      msg("Necesito un asesor"),msg("Ya hablé con él; ahora cotiza Armor 22")
   ],{threadStatus:"pending"});
   expect(r.requires_human).toBe(false);
   expect(r.should_reply).toBe(true);
 });
 it("lowers high-purchase priority after the customer explicitly cancels",()=>{
   const r=analyzeSalesConversation([
    msg("Quiero comprar 3 laptops Lenovo para mi empresa, por favor cotiza"),
    msg("Ya no quiero comprar")
   ]);
   expect(r.priority).toBe("baja");
   expect(r.intent).toBe("consulta_general");
   expect(r.signals).toContain("compra_cancelada");
   expect(r.signals).not.toContain("compra_explicita");
   expect(r.next_action).toContain("no insistir");
   expect(r.followup_suppressed).toBe(true);
   expect(r.should_reply).toBe(true);
 });
 it("does not keep a lead at high purchase priority after goodbye",()=>{
   const r=analyzeSalesConversation([
     msg("Quiero comprar Armor X13 y saber precio"),msg("Gracias por todo")
   ]);
   expect(r.priority).toBe("baja");
   expect(r.next_action).toContain("Cerrar cordialmente");
 });
 it("conservative priority is a rule-based score, not probability",()=>{
   const r=analyzeSalesConversation([msg("Hola")]);
   expect(r.score).toBeGreaterThanOrEqual(0);
   expect(r.score).toBeLessThanOrEqual(100);
   expect(r.priority).toBe("baja");
   expect(r.followup_suppressed).toBe(true);
 });
});
