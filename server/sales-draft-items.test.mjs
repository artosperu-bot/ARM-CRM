import {describe,it,expect} from "vitest";
import {advanceDraftItems,normalizeDraftItems,draftSummary} from "./sales-draft-items.mjs";
const catalog=[
 {partnumber:"ARMOR-X13",title:"Ulefone Armor X13 64GB"},
 {partnumber:"ARMOR-22-256G",title:"Ulefone Armor 22 256GB"},
 {partnumber:"ARMOR-25TPro-256GB",title:"Ulefone Armor 25T Pro 256GB"},
 {partnumber:"ARMOR-X12Pro",title:"Ulefone Armor X12 Pro 64GB"},
 {partnumber:"E-L1250",title:"Impresora Epson L1250"}
];
function journey(turns,cat=catalog){
 let state={items:[],focus:null};
 for(const input of turns)state=advanceDraftItems(state.items,input,cat,{focus:state.focus});
 return state;
}
const sorted=s=>s.items.slice().sort((a,b)=>a.partnumber.localeCompare(b.partnumber));
describe("ALEX draft buyer items with independent quantities",()=>{
 it("extracts two SKUs and their quantities from one informal message",()=>{
  const result=journey(["oe quiero 3 Armor X13 y 2 Armor 22"]);
  expect(sorted(result)).toEqual([{partnumber:"ARMOR-22-256G",quantity:2},{partnumber:"ARMOR-X13",quantity:3}]);
  expect(result.focus).toBeNull();
 });
 it("adds a second model on another turn without clobbering previous quantity",()=>{
  const result=journey(["necesito 3 armor x13","agrega dos armor 22","pásame el total"]);
  expect(sorted(result)).toEqual([{partnumber:"ARMOR-22-256G",quantity:2},{partnumber:"ARMOR-X13",quantity:3}]);
  expect(result.focus).toBe("ARMOR-22-256G");
 });
 it("edits just the selected model, not the whole basket",()=>{
  const result=journey(["quiero 3 armor x13","agrega 2 armor 22","mejor 4 del armor x13"]);
  expect(sorted(result)).toEqual([{partnumber:"ARMOR-22-256G",quantity:2},{partnumber:"ARMOR-X13",quantity:4}]);
 });
 it("lets an unqualified correction modify the last single selected line",()=>{
  const result=journey(["quiero 3 armor x13","noo era 2, me equivoqué"]);
  expect(result.items).toEqual([{partnumber:"ARMOR-X13",quantity:2}]);
 });
 it("refuses to guess which model bare corrections refer to after a multi-item selection",()=>{
  const result=journey(["quiero 3 armor x13 y 2 armor 22","mejor 4"]);
  expect(result.ambiguous).toBe(true);
  expect(sorted(result)).toEqual([{partnumber:"ARMOR-22-256G",quantity:2},{partnumber:"ARMOR-X13",quantity:3}]);
 });
 it("removes one line while retaining other products",()=>{
  const result=journey(["quiero 3 armor x13 y 2 armor 22","quita el armor x13"]);
  expect(result.items).toEqual([{partnumber:"ARMOR-22-256G",quantity:2}]);
 });
 it("reduces only the indicated quantity when removal is explicit",()=>{
  const result=journey(["quiero 3 armor x13","quita 1 del armor x13"]);
  expect(result.items).toEqual([{partnumber:"ARMOR-X13",quantity:2}]);
 });
 it("does not equate a comparison or a price question with requested products",()=>{
  expect(journey(["qué diferencia hay entre el Armor 22 y el Armor X13?"]).items).toEqual([]);
  expect(journey(["cuánto cuesta el armor x13?"]).items).toEqual([]);
  expect(journey(["¿tienes 3 armor x13 en stock?"]).items).toEqual([]);
 });
 it.each([
  "quiero comparar el x13 y el armor 22",
  "quiero saber el precio del x13 y 2 armor 22",
  "quiero ver fotos del x13",
  "quiero consultar stock del armor 22",
  "quiero cambiar mi armor x13 porque se malogró",
  "mi armor x13 no prende y quiero devolución"
 ])("does not mistake browsing or after-sales for a basket: %s",message=>{
  expect(journey([message]).items).toEqual([]);
 });
 it("never mixes X13 and X12 Pro",()=>{
  const result=journey(["quiero un armor x13","agrega 2 x12 pro"]);
  expect(sorted(result)).toEqual([{partnumber:"ARMOR-X12Pro",quantity:2},{partnumber:"ARMOR-X13",quantity:1}]);
 });
 it("does not infer order quantities from GB, model digits or prices",()=>{
  expect(journey(["quiero armor x13 64GB"]).items).toEqual([{partnumber:"ARMOR-X13",quantity:1}]);
  expect(journey(["quiero armor 22 256GB"]).items).toEqual([{partnumber:"ARMOR-22-256G",quantity:1}]);
  expect(journey(["quiero el Armor 25T Pro S/ 1799"]).items).toEqual([{partnumber:"ARMOR-25TPro-256GB",quantity:1}]);
 });
 it("accepts an Epson product without brand-specific rules",()=>{
  const result=journey(["necesito 2 impresoras Epson L1250"]);
  expect(result.items).toEqual([{partnumber:"E-L1250",quantity:2}]);
 });
 it("does not guess which existing line to replace in a multi-SKU basket",()=>{
  const result=journey(["quiero 2 Armor X13 y 3 Armor 22","mejor quiero un Armor X12 Pro"]);
  expect(result.ambiguous).toBe(true);
  expect(sorted(result)).toEqual([
   {partnumber:"ARMOR-22-256G",quantity:3},
   {partnumber:"ARMOR-X13",quantity:2}
  ]);
 });
 it("single-line explicit switch replaces rather than blindly adds",()=>{
  const result=journey(["quiero un armor x13","mejor quiero 2 armor 22"]);
  expect(result.items).toEqual([{partnumber:"ARMOR-22-256G",quantity:2}]);
 });
 it("does not invent a product when two variants match the same model",()=>{
  const variants=[{title:"Armor X13 64GB",partnumber:"ARMOR-X13-64"},
   {title:"Armor X13 128GB",partnumber:"ARMOR-X13-128"}];
  expect(journey(["quiero 2 armor x13"],variants).items).toEqual([]);
 });
 it("clear desistimiento never generates an order",()=>{
  const result=journey(["quiero dos armor x13","ya no quiero comprar, gracias"]);
  expect(result.items).toEqual([]);
 });
 it("normalizes only SKU and quantity, excluding untrusted personal content",()=>{
  expect(normalizeDraftItems([
   {partnumber:"ARMOR-X13",quantity:2,phone:"987654321",price_pen:999},
   {partnumber:"ARMOR-X13",quantity:5},
   {partnumber:"12345678",quantity:1}
  ])).toEqual([{partnumber:"ARMOR-X13",quantity:2}]);
  expect(draftSummary([{partnumber:"ARMOR-X13",quantity:2}],catalog)).toMatchObject([
   {partnumber:"ARMOR-X13",quantity:2,verifiedInCurrentCatalog:true}
  ]);
 });
});
