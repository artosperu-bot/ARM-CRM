import {describe,it,expect} from "vitest";
import {advanceDraftItems} from "./sales-draft-items.mjs";
import {buildBuyerContext} from "./buyer-reasoning.mjs";
import {enrichCatalog} from "./product-knowledge.mjs";
import {protectSalesResponse} from "./sales-response-guard.mjs";
const catalogue=[
 ["QA-LEN-T14-16","Lenovo ThinkPad T14 16 GB RAM / 512 GB SSD (prueba)"],
 ["QA-LEN-T14-32","Lenovo ThinkPad T14 32 GB RAM / 1 TB SSD (prueba)"],
 ["QA-EPS-L1250","Epson EcoTank L1250 impresora tanque de tinta (prueba)"],
 ["QA-EPS-L15150","Epson EcoTank L15150 impresora tanque de tinta (prueba)"],
 ["QA-SAM-LS24D300","Samsung LS24D300GALXPE monitor 24 pulgadas (prueba)"],
 ["QA-LG-27MR400","LG 27MR400 monitor 27 pulgadas (prueba)"],
 ["QA-LOG-H570E","Logitech H570e Stereo USB audífonos Teams (prueba)"],
 ["QA-LOG-H390","Logitech H390 USB audífonos con micrófono (prueba)"],
 ["QA-KIN-DDR5-7200","Kingston FURY DDR5 16 GB 7200 MT/s (prueba)"],
 ["QA-KIN-DDR5-5600","Kingston DDR5 16 GB 5600 MT/s (prueba)"],
 ["QA-PD-65W","Cargador USB-C Power Delivery 65 W genérico (prueba)"],
 ["QA-PD-100W","Cargador USB-C Power Delivery 100 W genérico (prueba)"],
 ["QA-SAM-TAB-A9","Samsung Galaxy Tab A9 64 GB tablet (prueba)"],
 ["QA-SAM-TAB-A9PLUS","Samsung Galaxy Tab A9 Plus 128 GB tablet (prueba)"],
 ["QA-TPL-AX23","TP-Link Archer AX23 router Wi-Fi 6 (prueba)"],
 ["QA-TPL-AX55","TP-Link Archer AX55 router Wi-Fi 6 (prueba)"]
].map(([partnumber,titulo])=>({partnumber,titulo}));
const want=(items,...expected)=>expect(items).toEqual(expected.map(([partnumber,quantity])=>({partnumber,quantity})));
describe("ALEX QA multi-category references and quantities",()=>{
 it("does not guess ambiguous ThinkPad T14 RAM",()=>{
  expect(advanceDraftItems([],"quiero 2 Lenovo T14",catalogue).items).toEqual([]);
 });
 it("uses explicit 32 GB to select variant, not 16 GB",()=>{
  const x=advanceDraftItems([],"quiero 2 de la Lenovo ThinkPad T14 con 32 GB",catalogue);
  want(x.items,["QA-LEN-T14-32",2]);
 });
 it("recognizes Epson L1250 and its correct requested quantity",()=>{
  const x=advanceDraftItems([],"quiero 2 epson l1250 pa mi tienda",catalogue);
  want(x.items,["QA-EPS-L1250",2]);
 });
 it("uses LG 27MR400 model starting with digits",()=>{
  const x=advanceDraftItems([],"me quedo con 1 lg 27mr400",catalogue);
  want(x.items,["QA-LG-27MR400",1]);
 });
 it("updates 2 H390 to 3, preserves one H570e",()=>{
  const x=advanceDraftItems([],"quiero 2 logitech h390 y un h570e",catalogue);
  want(x.items,["QA-LOG-H390",2],["QA-LOG-H570E",1]);
  const y=advanceDraftItems(x.items,"mejor 3 h390, el h570e queda en uno",catalogue);
  want(y.items,["QA-LOG-H390",3],["QA-LOG-H570E",1]);
 });
 it("distinguishes USB-C 65W and 100W but doesn't confirm stock",()=>{
  const x=advanceDraftItems([],"quiero 3 cargadores usb c de 65w y 2 de 100w",catalogue);
  want(x.items,["QA-PD-65W",3],["QA-PD-100W",2]);
 });
 it("selects Samsung Tab A9 Plus explicitly without guessing base A9",()=>{
  const x=advanceDraftItems([],"dame 2 samsung tab a9 plus de 128gb",catalogue);
  want(x.items,["QA-SAM-TAB-A9PLUS",2]);
 });
 it("removes only Archer AX23 and preserves AX55",()=>{
  const x=advanceDraftItems([],"quiero 2 router archer ax23 y 1 archer ax55",catalogue);
  want(x.items,["QA-TPL-AX23",2],["QA-TPL-AX55",1]);
  const y=advanceDraftItems(x.items,"quita el ax23, deja solo el ax55",catalogue);
  want(y.items,["QA-TPL-AX55",1]);
 });
 it("handles a laptop and LG monitors independently",()=>{
  const x=advanceDraftItems([],"quiero una lenovo thinkpad t14 16 gb y dos monitores lg 27mr400",catalogue);
  want(x.items,["QA-LEN-T14-16",1],["QA-LG-27MR400",2]);
  const y=advanceDraftItems(x.items,"mejor 3 monitores lg 27mr400, la laptop igual",catalogue);
  want(y.items,["QA-LEN-T14-16",1],["QA-LG-27MR400",3]);
 });
 it("uses exact DDR5 speed 5600 vs 7200",()=>{
  const x=advanceDraftItems([],"necesito 2 ram kingston ddr5 5600",catalogue);
  want(x.items,["QA-KIN-DDR5-5600",2]);
 });
 it("does not add products when only comparing options",()=>{
  const x=advanceDraftItems([],"quiero comparar samsung tab a9 y tab a9 plus",catalogue);
  expect(x.items).toEqual([]);
 });
 it("handles three categories in the same request",()=>{
  const x=advanceDraftItems([],"necesito una laptop t14 de 32gb, 2 logitech h570e y un router ax55",catalogue);
  want(x.items,["QA-LEN-T14-32",1],["QA-LOG-H570E",2],["QA-TPL-AX55",1]);
 });
 it("updates one LG monitor by unique category while retaining a Lenovo laptop",()=>{
  const old=advanceDraftItems([],"quiero una lenovo t14 16 gb y 2 lg 27mr400",catalogue);
  const fixed=advanceDraftItems(old.items,"mejor 3 monitores LG, la laptop igual",catalogue);
  want(fixed.items,["QA-LEN-T14-16",1],["QA-LG-27MR400",3]);
 });
 it("never picks an arbitrary monitor when two models share the category",()=>{
  const old=advanceDraftItems([],"quiero 1 samsung ls24d300 y 2 lg 27mr400",catalogue);
  const result=advanceDraftItems(old.items,"mejor 3 monitores",catalogue);
  expect(result.ambiguous).toBe(true);
  expect(result.items).toEqual(old.items);
 });
 it("calculates the entire draft for natural 'y cuánto es todo' language",()=>{
  const rows=catalogue.filter(x=>["QA-LOG-H390","QA-LOG-H570E"].includes(x.partnumber))
   .map(x=>({partnumber:x.partnumber,title:x.titulo,brand:"LOGITECH"}));
  const offers=[
   {partnumber:"QA-LOG-H390",price_pen:159,stock_status:"disponible",stock_units_demo:8,is_test_data:true},
   {partnumber:"QA-LOG-H570E",price_pen:319,stock_status:"disponible",stock_units_demo:4,is_test_data:true}
  ];
  const catalog=enrichCatalog(rows,true,offers);
  const buyer=buildBuyerContext(["quiero 3 logitech h390 y 1 logitech h570e",
   "y cuanto es todo?"],{catalog});
  const result=protectSalesResponse("El total es S/ 0",{catalog,buyer,simulated:true});
  expect(result.reason).toBe("demo_basket_calculated");
  expect(result.reply).toContain("S/ 796.00");
 });
 it("blocks an invented compatibility claim for a QA USB-C charger",()=>{
  const rows=[
   {partnumber:"ARMOR-22-256G",title:"Ulefone Armor 22 256GB",brand:"ULEFONE"},
   {partnumber:"QA-PD-65W",title:"Cargador USB-C Power Delivery 65 W genérico (prueba)",brand:"GENERICO-QA"}
  ];
  const offers=rows.map(x=>({partnumber:x.partnumber,price_pen:100,stock_status:"disponible",stock_units_demo:4,is_test_data:true}));
  const catalog=enrichCatalog(rows,true,offers);
  const buyer=buildBuyerContext(["quiero un armor 22 y cargador usb c 65w"],{catalog});
  const result=protectSalesResponse("Sí, el Armor 22 combina bien con ese cargador, sirve sin problema",{catalog,buyer,simulated:true});
  expect(result.reason).toBe("qa_compatibility_unverified");
  expect(result.reply).toContain("no puedo confirmar compatibilidad");
 });
 it("never asks for a name and mobile phone just to record a QA interest",()=>{
  const rows=[{partnumber:"QA-SAM-TAB-A9PLUS",title:"Samsung Galaxy Tab A9 Plus 128 GB tablet (prueba)",brand:"SAMSUNG"}];
  const catalog=enrichCatalog(rows,true,[
   {partnumber:"QA-SAM-TAB-A9PLUS",price_pen:999,stock_status:"disponible",stock_units_demo:2,is_test_data:true}
  ]);
  const buyer=buildBuyerContext(["dame 2 samsung tab a9 plus de 128gb","noo mejor una sola"],{catalog});
  const result=protectSalesResponse("Perfecto, envíame tu nombre completo y celular para registrarlo",{catalog,buyer,simulated:true});
  expect(result.reason).toBe("premature_personal_data");
  expect(result.reply).not.toMatch(/env[ií]ame\s+tu\s+nombre/i);
 });
});