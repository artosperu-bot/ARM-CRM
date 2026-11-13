import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {advanceDraftItems} from "./sales-draft-items.mjs";
import {enrichCatalog} from "./product-knowledge.mjs";
import {buildBuyerContext} from "./buyer-reasoning.mjs";
import {snapshotSalesMemory} from "./sales-memory.mjs";
import {protectSalesResponse} from "./sales-response-guard.mjs";
import {salesInstructions} from "./sales-policy.mjs";
import {formatWhatsAppReply} from "./whatsapp-format.mjs";
const fixtures=JSON.parse(readFileSync("server/qa-expanded-category-fixtures.json","utf8"));
const rows=fixtures.map(x=>({partnumber:x.partnumber,title:x.title,brand:x.brand,
 category_path:x.category_path,family_key:x.family_key,variant_options:x.variant_options,
 attributes:x.attributes}));
const offers=fixtures.map(x=>({partnumber:x.partnumber,price_pen:x.demo_price_pen,
 stock_status:x.demo_stock_status,stock_units_demo:x.demo_stock_units,is_test_data:true}));
const catalog=enrichCatalog(rows,true,offers);
const check=(items,x)=>expect(items).toEqual(x.map(([partnumber,quantity])=>({partnumber,quantity})));
function dialogue(turns){
 let memory=null;
 const snapshots=[];
 for(let i=0;i<turns.length;i++){
  const buyer=buildBuyerContext([turns[i]],{catalog,memory});
  memory=snapshotSalesMemory(buyer,{previous:memory,lastMessageId:"stress"+i,
   lastMessageAt:new Date(Date.UTC(2026,10,13,21,i)).toISOString()});
  snapshots.push(memory.draft_items);
 }
 return snapshots;
}
describe("new end-to-end stress failures",()=>{
 it("preserves 2 Lenovo T14 and corrects only LG monitor from 2 to 1",()=>{
  const snapshots=dialogue(["hola mano, necesito 2 lenovo t14 de 16gb y 2 lg 27mr400",
   "mejor 1 monitor lg, las 2 laptops iguales",
   "y cuanto es todo? no me inventes stock",
   "ok quiero llevar esas 2 laptops y el monitor, como sigo?"]);
  check(snapshots[0],[["QA-LEN-T14-16",2],["QA-LG-27MR400",2]]);
  check(snapshots[1],[["QA-LEN-T14-16",2],["QA-LG-27MR400",1]]);
  check(snapshots[3],[["QA-LEN-T14-16",2],["QA-LG-27MR400",1]]);
 });
 it("explicitly switches Epson L15150 for L1250; price question alone does not switch",()=>{
  const snapshots=dialogue(["quiero una impresora epson l15150",
   "si no tienen, la l1250 cuanto sale?",
   "cambio la l15150 por 1 epson l1250",
   "ya compro esa l1250, que sigue?"]);
  check(snapshots[0],[["QA-EPS-L15150",1]]);
  check(snapshots[1],[["QA-EPS-L15150",1]]);
  check(snapshots[2],[["QA-EPS-L1250",1]]);
  check(snapshots[3],[["QA-EPS-L1250",1]]);
 });
 it("disambiguation: never invents switching when customer only compares",()=>{
  const items=advanceDraftItems([{partnumber:"QA-EPS-L15150",quantity:1}],
   "la l1250 que precio tiene? comparame",catalog);
  check(items.items,[["QA-EPS-L15150",1]]);
 });
 it("changing an old SKU to a new SKU already in draft must request clarity",()=>{
  const items=advanceDraftItems([{partnumber:"QA-EPS-L15150",quantity:1},
   {partnumber:"QA-EPS-L1250",quantity:2}],
   "cambio la l15150 por 1 epson l1250",catalog);
  expect(items.ambiguous).toBe(true);
  check(items.items,[["QA-EPS-L15150",1],["QA-EPS-L1250",2]]);
 });
 it("adds a fourth distinct item only when explicitly 'ademas una tablet'",()=>{
  const snapshots=dialogue(["quiero un router ax23 y 2 h570e",
   "agrega una epson l1250","ademas una tablet samsung tab a9 plus de 128gb",
   "cuanto es todo de prueba?"]);
  check(snapshots[3],[["QA-TPL-AX23",1],["QA-LOG-H570E",2],
   ["QA-EPS-L1250",1],["QA-SAM-TAB-A9PLUS",1]]);
 });
 it("clears all previously considered items on 'cancelalo todo, ya no compro'",()=>{
  const snapshots=dialogue(["quiero 2 cargadores 65w y un router ax23",
   "mejor cancelalo todo, ya no compro","no me reserves nada",
   "no me escribas por seguimiento"]);
  check(snapshots[0],[["QA-PD-65W",2],["QA-TPL-AX23",1]]);
  for(const step of snapshots.slice(1))check(step,[]);
 });
 it("interprets 'busco Epson L1250, quiero 1' across comma clauses",()=>{
  const snapshots=dialogue(["busco la epson l1250, quiero 1",
   "tambien venden audifonos logitech? solo preguntaba",
   "no agregues audifonos a mi lista","cuanto sale esa epson de prueba?"]);
  for(const step of snapshots)check(step,[["QA-EPS-L1250",1]]);
 });
 it("returns laboratory subtotal for a single SKU and no real price promise",()=>{
  const buyer=buildBuyerContext(["quiero 2 router ax23",
   "cuanto saldria todo?"],{catalog});
  const result=protectSalesResponse("No dispongo de un precio",{catalog,buyer,simulated:true});
  expect(result.reason).toBe("demo_single_line_price");
  expect(result.reply).toContain("S/ 458.00");
  expect(result.reply).toContain("laboratorio");
 });
 it("blocks buyer data request even when model says 'pases tu nombre y apellido'",()=>{
  const buyer=buildBuyerContext(["quiero 2 logitech h390 y 1 h570e",
   "ya los llevo, como sigo?"],{catalog});
  const result=protectSalesResponse("Necesito que me pases tu nombre y apellido y tu celular para coordinar",{catalog,buyer,simulated:true});
  expect(result.reason).toBe("premature_personal_data");
  expect(result.reply).not.toContain("pases tu nombre");
 });
 it.each([
  "Buenazo, para continuar solo falta que me compartas tu nombre completo y un celular peruano",
  "Para continuar, solo falta que me compartas tu nombre y apellido",
  "Para seguir, confirma que deseas comprar y me indiques tu nombre y apellido",
  "Para continuar solo necesito tu nombre completo y un celular peruano de contacto",
  "Para continuar solo me falta tu nombre y apellido para registrar el seguimiento",
  "Lo siguiente es dejar tus datos de contacto y horario: nombre completo, celular peruano y fecha de coordinación"
 ])("rejects real-model PII request variant: %s",(raw)=>{
  const buyer=buildBuyerContext(["quiero 2 logitech h390 y 1 h570e",
   "ya los llevo, como sigo?"],{catalog});
  const result=protectSalesResponse(raw,{catalog,buyer,simulated:true});
  expect(result.reason).toBe("premature_personal_data");
  expect(result.reply).toContain("2 ×");
  expect(result.reply).toContain("Todavía no hay pedido ni pago");
  expect(result.reply).not.toMatch(/\b(?:compartas|indiques) tu nombre/i);
 });
 it("commercial action guard gives a concrete QA list instead of generic refusal",()=>{
  const buyer=buildBuyerContext(["quiero 2 logitech h390 y 1 h570e",
   "ya los llevo, como sigo?"],{catalog});
  const result=protectSalesResponse("Ya te agendé la compra y reservé las unidades.",{
   buyer,catalog,simulated:true});
  expect(result.reason).toBe("unconfirmed_action");
  expect(result.reply).toContain("2 ×");
  expect(result.reply).toContain("No se ha creado un pedido");
 });
 it("simulated ALEX prompt forbids PII collection and preserves real follow-up policy",()=>{
  const mockPrompt=salesInstructions(catalog,{simulated:true});
  const realPrompt=salesInstructions(catalog,{simulated:false});
  expect(mockPrompt).toContain("NUNCA pidas nombre, apellido, celular");
  expect(mockPrompt).not.toContain("Recoge de forma gradual solo lo que falte");
  expect(realPrompt).toContain("Recoge de forma gradual solo lo que falte");
 });
 it.each([
  "PRUEBA STECH: Entendido, 2 Epson L1250 y 3 H390 sin cambios.",
  "🧪 *PRUEBA STECH* Listo, las cantidades siguen como pediste.",
  "🧪 *PRUEBA STECH* (precios y disponibilidad simulados)\n\nTe sigo ayudando.",
 ])("preserves answer text when model prepends its own header: %s",(raw)=>{
  const formatted=formatWhatsAppReply(raw,{simulated:true,maxChars:1300});
  expect(formatted.match(/PRUEBA STECH/gu)).toHaveLength(1);
  expect(formatted).toMatch(/(?:Entendido|Listo|Te sigo ayudando)/u);
  expect(formatted.trim()).not.toMatch(/\(precios y disponibilidad simulados\)$/u);
 });
});
