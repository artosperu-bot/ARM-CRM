import {describe,it,expect} from "vitest";
import {formatWhatsAppReply,whatsappPresentationInstructions} from "./whatsapp-format.mjs";

describe("Native WhatsApp message presentation",()=>{
 it("uses single-asterisk bold, compact paragraphs and bullets",()=>{
  const input="## **Ulefone Armor 22**\n**Precio de prueba:** S/ 999\n\n- IP68\n- 256 GB\n\n\n¿Te interesa?";
  expect(formatWhatsAppReply(input)).toBe("*Ulefone Armor 22*\n*Precio de prueba:* S/ 999\n\n• IP68\n• 256 GB\n\n¿Te interesa?");
 });
 it("adds private sandbox header exactly once",()=>{
  const reply=formatWhatsAppReply("🧪 *PRUEBA STECH* (precios simulados)\n\n**Armor 22**\n**Precio de prueba:** S/ 999",{simulated:true});
  expect(reply).toMatch(/^🧪 \*PRUEBA STECH\* \(precios y disponibilidad simulados\)/);
  expect(reply.match(/PRUEBA STECH/g)).toHaveLength(1);
  expect(reply).toContain("*Precio de prueba:* S/ 999");
 });
 it("does not create fake benefits or invent options",()=>{
  const body=formatWhatsAppReply("*Armor 22*\n*Precio:* S/ 999");
  expect(body).toBe("*Armor 22*\n*Precio:* S/ 999");
  expect(body).not.toContain("X13");
  expect(body).not.toContain("25T");
  expect(body).not.toContain("opciones");
 });
 it("does not inject simulation data in real mode",()=>{
  expect(formatWhatsAppReply("Bienvenido.",{simulated:false})).toBe("Bienvenido.");
 });
 it("does not expose exact stock unit numbers in final message",()=>{
  const output=formatWhatsAppReply("Tenemos 12 unidades y 5 equipos",{});
  expect(output).not.toContain("12 unidades");
  expect(output).toContain("5 equipos"); // la cantidad solicitada no es stock del almacén
 });
 it("keeps output bounded while preserving a bold pair",()=>{
  const text=formatWhatsAppReply("*Armor 22*\n\n"+"Beneficio confirmado. ".repeat(150),{simulated:true,maxChars:175});
  expect(text.length).toBeLessThanOrEqual(175);
  expect((text.match(/\*/g)||[]).length%2).toBe(0);
  expect(text).toMatch(/^🧪 \*PRUEBA STECH\*/);
 });
 it("keeps options optional instead of imposing a rigid menu",()=>{
  const guide=whatsappPresentationInstructions();
  expect(guide).toMatch(/SOLO si el cliente/);
  expect(guide).toMatch(/una sola estrella/);
  expect(guide).toMatch(/NO uses \*\*/);
 });
 it("handles malformed model response safely",()=>{
  expect(formatWhatsAppReply(null,{simulated:false})).toBe("");
 });
});
