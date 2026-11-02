import {describe,it,expect} from "vitest";
import {enrichCatalog} from "./product-knowledge.mjs";
import {normalizedPhone,consentInLastMessage,validateBookingProposal} from "./followup-automation.mjs";
const catalog=[{partnumber:"ARMOR-22-256G",title:"Armor 22",brand:"ULEFONE",verified_at:null,price_pen:null,stock_erp:null,attributes:{}}];
describe("ventas y escenarios aislados",()=>{
 it("no expone ofertas falsas en modo real",()=>{
  const v=enrichCatalog(catalog,false)[0];expect(v.precio_soles).toBe(null);expect(v.disponibilidad).toBe("por confirmar");
  expect(v.especificaciones_fabricante.certifications).toContain("IP68");
 });
 it("oferta simulada solo activada explícitamente en pruebas",()=>{
  const v=enrichCatalog(catalog,true)[0];expect(v.precio_soles).toBe(999);expect(v.oferta_simulada).toBe(true);
 });
 it("valida teléfono peruano",()=>{expect(normalizedPhone("+51 987654321")).toBe("987654321");expect(normalizedPhone("12345")).toBe(null);});
 it("no infiere consentimiento desde pedir un horario",()=>{
  expect(consentInLastMessage("Mejor el viernes a las 4, ya me agendaste?")).toBe(false);
  expect(consentInLastMessage("Sí, agéndame el viernes a las 4")).toBe(true);
 });
 it("agenda solo con nombre completo, celular, fecha y consentimiento explícito",()=>{
  const p={requested:true,full_name:"Ana Torres",phone:"987654321",date_local:"2026-11-06",time_local:"16:00",explicit_consent:true};
  const turns=["Soy Ana Torres, mi número es 987654321. Viernes a las 4pm.","Sí, agéndame por favor el viernes a las 4pm"];
  const action=validateBookingProposal(p,turns,turns.at(-1),new Date("2026-11-02T17:00:00Z"));
  expect(action?.phone).toBe("987654321");
  expect(action?.dueAt).toBe("2026-11-06T21:00:00.000Z");
 });
 it("rechaza agendar si falta teléfono o consentimiento",()=>{
  const p={requested:true,full_name:"Ana Torres",phone:null,date_local:"2026-11-06",time_local:"16:00",explicit_consent:true};
  expect(validateBookingProposal(p,["Soy Ana Torres, viernes 4pm"],"sí agéndame",new Date("2026-11-02T17:00:00Z"))).toBe(null);
 });
});
