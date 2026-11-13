import {describe,it,expect} from "vitest";
import {asksDurabilityDetails,evidenceForSalesTurn,softenUnsolicitedDurabilityCaveats,salesVoiceInstructions,polishCommercialReply} from "./commercial-voice.mjs";
import {packSalesCatalog,salesInstructions} from "./sales-policy.mjs";
import {protectSalesResponse} from "./sales-response-guard.mjs";
import {buildBuyerContext} from "./buyer-reasoning.mjs";
import {specsByPn} from "./product-knowledge.mjs";

const catalog=[{
 titulo:"Ulefone Armor X13",marca:"ULEFONE",partnumber:"ARMOR-X13",
 precio_soles:null,disponibilidad:"por confirmar",
 especificaciones_fabricante:specsByPn["ARMOR-X13"]
}];
describe("ALEX conversation-first commercial tone",()=>{
 it("does not prime the model with unsolicited liquid/warranty caveats",()=>{
  const b=buildBuyerContext(["Busco 2 celulares Armor X13 resistentes para mi personal de construcción"],{catalog});
  const packed=JSON.parse(packSalesCatalog(catalog,{lastMessage:b.last_message}));
  const facts=packed.resultados[0].especificaciones_verificadas;
  expect(facts.certifications).toContain("IP68");
  expect(facts.battery).toBe("6320 mAh");
  expect(facts).not.toHaveProperty("note");
  expect(facts).not.toHaveProperty("ip68");
  const prompt=salesInstructions(catalog,{buyer:b});
  expect(prompt).toContain("PRIMERO EL VALOR");
  expect(prompt).toContain("VOZ COMERCIAL");
  expect(prompt).toContain("PERSUASIÓN CON PRECISIÓN");
 });
 it("preserves technical and warranty facts when buyer explicitly requests them",()=>{
  const buyer=buildBuyerContext(["¿Cubre la garantía daños por agua en el Armor X13?"],{catalog});
  const packed=JSON.parse(packSalesCatalog(catalog,{lastMessage:buyer.last_message}));
  const facts=packed.resultados[0].especificaciones_verificadas;
  expect(facts.note).toMatch(/daños por líquidos excluidos/i);
  expect(facts.ip68).toMatch(/30 minutos/i);
  expect(asksDurabilityDetails(buyer.last_message)).toBe(true);
  expect(salesVoiceInstructions(buyer)).toContain("PREGUNTA EXPLÍCITA");
 });
 it("removes unsolicited alarmist warranty paragraph, keeping actual benefit",()=>{
  const buyer=buildBuyerContext(["¿El Ulefone Armor X13 me sirve para construcción?"],{catalog});
  const reply="Para trabajo de campo, el Armor X13 es una buena alternativa: tiene IP68 e IP69K, batería de 6320 mAh y visión nocturna. Ojo: esas certificaciones aplican bajo pruebas controladas y la resistencia no es permanente; además, el fabricante indica que daños por líquidos no están cubiertos por garantía.";
  const guarded=protectSalesResponse(reply,{buyer,catalog});
  expect(guarded.blocked).toBe(false);
  expect(guarded.reply).toMatch(/trabajo de campo/i);
  expect(guarded.reply).toMatch(/6320 mAh/i);
  expect(guarded.reply).not.toMatch(/bajo pruebas controladas|resistencia no es permanente|daños por líquidos/i);
 });
 it("avoids a liquid-warranty lecture for routine warehouse dust-and-bumps advice",()=>{
  const b=buildBuyerContext(["Trabajo en almacén con polvo y golpes; qué tal el Armor X13?"],{catalog});
  const packed=JSON.parse(packSalesCatalog(catalog,{lastMessage:b.last_message}));
  expect(packed.resultados[0].especificaciones_verificadas).not.toHaveProperty("note");
  const reply="Para almacén, el X13 tiene protección IP68/IP69K y batería de 6320 mAh. Eso sí, esa resistencia es bajo pruebas de laboratorio y los daños por líquidos no están cubiertos por garantía.";
  const safe=protectSalesResponse(reply,{buyer:b,catalog});
  expect(safe.reply).toMatch(/batería de 6320 mAh/i);
  expect(safe.reply).not.toMatch(/daños por líquidos/i);
 });
 it("keeps factual warranty exclusions when the client asks about coverage",()=>{
  const b=buildBuyerContext(["¿La garantía cubre daños por líquidos del Armor X13?"],{catalog});
  const reply="Según la ficha del fabricante, los daños por líquidos no están cubiertos por garantía.";
  expect(protectSalesResponse(reply,{buyer:b,catalog}).reply).toBe(reply);
 });
 it("retains liquid exclusion details when buyer explicitly asks whether they can submerge the phone",()=>{
  const b=buildBuyerContext(["¿Puedo sumergirlo en la piscina?"],{catalog});
  const packed=JSON.parse(packSalesCatalog(catalog,{lastMessage:b.last_message}));
  expect(packed.resultados[0].especificaciones_verificadas.note).toMatch(/líquidos/i);
 });
 it("does not rewrite meaningful physical limits when buyer asks about immersion",()=>{
  const b=buildBuyerContext(["¿Se puede meter al agua este Armor X13 y por cuánto tiempo?"],{catalog});
  const reply="La clasificación IP68 se ensaya bajo condiciones específicas de laboratorio; no significa protección ilimitada al sumergirlo.";
  expect(softenUnsolicitedDurabilityCaveats(reply,b.last_message)).toBe(reply);
 });
 it("recognizes relevant durability and warranty questions but not ordinary use cases",()=>{
  for(const text of ["¿Puedo sumergirlo?", "¿Qué cubre la garantía?","¿Sirve bajo la lluvia?","¿Aguanta golpes?"])
   expect(asksDurabilityDetails(text)).toBe(true);
  for(const text of ["Lo necesito para obra", "Quiero usarlo en campo", "Para la cuadrilla de construcción"])
   expect(asksDurabilityDetails(text)).toBe(false);
 });
 it("doesn't push an unwanted comparison after the customer already chose a model",()=>{
  const buyer=buildBuyerContext(["Quiero el Armor X13 para trabajar en campo"],{catalog});
  const reply="Para campo, su batería de 6320 mAh es una ventaja útil. ¿Quieres que te cuente si esa capacidad te conviene más que otro Ulefone según las horas que lo usas?";
  const out=polishCommercialReply(reply,buyer);
  expect(out).toContain("6320 mAh");
  expect(out).not.toMatch(/otro Ulefone/i);
 });
 it("doesn't finish with empty 'next step' talk if no action is available",()=>{
  const buyer=buildBuyerContext(["Me gusta el Armor X13, necesito dos"],{catalog});
  const out=polishCommercialReply("Su batería es de 6320 mAh. Si te sirve, puedo ayudarte a revisar el siguiente paso para esos 2 equipos.",buyer);
  expect(out).toBe("Su batería es de 6320 mAh.");
 });
 it("keeps buyer-requested comparison rather than blindly hiding alternatives",()=>{
  const buyer=buildBuyerContext(["Compárame el Armor X13 con otras opciones"],{catalog});
  const message="El X13 tiene batería de 6320 mAh. ¿Quieres que te cuente cómo compara frente a otro Ulefone?";
  expect(polishCommercialReply(message,buyer)).toBe(message);
 });
 it("keeps substantive compatibility question instead of censoring follow-ups",()=>{
  const buyer=buildBuyerContext(["Quiero una impresora, ¿me servirá?"],{catalog:[]});
  const message="Lo importante es que funcione con tu equipo. ¿Qué sistema operativo utilizas?";
  expect(polishCommercialReply(message,buyer)).toBe(message);
 });
 it("does not alter products without durability warnings or pricing evidence",()=>{
  const reply="La Epson L1250 puede ser práctica para impresiones de casa por su sistema de tinta recargable.";
  expect(softenUnsolicitedDurabilityCaveats(reply,"Busco una impresora para casa")).toBe(reply);
 });
});
