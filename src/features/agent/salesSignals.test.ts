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
 it("identifica cita sin afirmar que quedó registrada",()=>{
  const s=detectCommercialSignal(["Me interesa el Armor X13 pero cobro el viernes","El viernes a las 4 pm. ¿Ya me agendaste?"]);
  expect(s.key).toBe("followup");expect(s.nextAction).toContain("Aún no");
 });
});
