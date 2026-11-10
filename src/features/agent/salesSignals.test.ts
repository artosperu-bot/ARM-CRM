import { describe,expect,it } from "vitest";
import {detectCommercialSignal} from "./salesSignals";
describe("etapas comerciales reutilizadas del CRM anterior",()=>{
 it("califica exploración sin inventar seguimiento",()=>{
  const s=detectCommercialSignal(["Trabajo en construcción, busco celular resistente"]);
  expect(s.key).toBe("exploring");expect(s.followupSuggested).toBe(false);
 });
 it("deriva intención de compra urgente",()=>{
  const s=detectCommercialSignal(["Quiero Armor 22", "Puedo pagar ahora, ¿me reservas uno?"]);
  expect(s.key).toBe("buying");expect(s.priority).toBe("high");expect(s.handoff).toBe(true);
 });
 it("deriva garantía para aprobación humana",()=>{
  expect(detectCommercialSignal(["¿Me garantizas que nunca entra agua y que tiene dos años de garantía?"]).handoff).toBe(true);
 });
 it("reconoce producto ausente en catálogo",()=>{
  expect(detectCommercialSignal(["Solo quiero iPhone 16 Pro Max, no Ulefone".replace("no Ulefone","de Apple")]).key).toBe("missing");
 });
 it("uses the last buyer turn, not old commercial keywords",()=>{
  expect(detectCommercialSignal(["¿Cuánto cuesta el Armor X13?","Gracias, por ahora lo voy a pensar"]).key).toBe("ended");
  expect(detectCommercialSignal(["Quiero comprar el Armor X13","Mejor no compro"]).key).toBe("ended");
 });
 it("does not propose followup just because buyer mentions a payday",()=>{
  expect(detectCommercialSignal(["Cobro el viernes, estoy averiguando precios más adelante"]).key).toBe("exploring");
 });
 it("recognizes practical purchase progression without payment keywords",()=>{
  const x=detectCommercialSignal(["Ya elegí la Epson L1250, necesito dos","¿Cuál es el siguiente paso para comprarlas?"]);
  expect(x.key).toBe("buying");
  expect(x.nextAction).toMatch(/no hay pedido/i);
 });
 it("does not treat a normal warranty inquiry as automatic human assignment",()=>{
  expect(detectCommercialSignal(["¿La garantía cubre daños por agua en este equipo?"]).handoff).toBe(false);
 });
 it("stops asking for human handoff after customer withdraws that request",()=>{
  const x=detectCommercialSignal(["Quiero hablar con asesor","No quiero hablar con asesor, podemos seguir aquí"]);
  expect(x.key).toBe("exploring");
  expect(x.handoff).toBe(false);
 });
 it("marks an explicit request for advisor without claiming assignment",()=>{
  const x=detectCommercialSignal(["Quiero que me atienda un asesor humano"]);
  expect(x.key).toBe("human");
  expect(x.nextAction).toMatch(/Todavía no hay asesor asignado/i);
 });
 it("does not register an unwanted appointment if buyer says no",()=>{
  expect(detectCommercialSignal(["No me agendes ni me llames"]).followupSuggested).toBe(false);
 });
 it("identifica cita sin afirmar que quedó registrada",()=>{
  const s=detectCommercialSignal(["Me interesa el Armor X13 pero cobro el viernes","El viernes a las 4 pm. ¿Ya me agendaste?"]);
  expect(s.key).toBe("followup");expect(s.nextAction).toContain("Aún no");
 });
});
