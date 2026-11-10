import {describe,it,expect} from "vitest";
import {requestsProductPhoto,safePublicImageUrl,verifiedProductPhoto,productPhotoUnavailableReply} from "./product-photo.mjs";
import {enrichCatalog} from "./product-knowledge.mjs";
import {buildBuyerContext} from "./buyer-reasoning.mjs";
import {packSalesCatalog} from "./sales-policy.mjs";
const row=(sku,title)=>({titulo:title,marca:"ULEFONE",partnumber:sku});
const products=[
 row("ARMOR-X13","Ulefone Armor X13 64GB"),
 row("ARMOR-22-256G","Ulefone Armor 22 256GB"),
 row("ARMOR-X12Pro","Ulefone Armor X12 Pro 64GB")
];
const source="https://store.ulefone.com/es/products/armor-x13";
const url="https://store.ulefone.com/cdn/shop/files/Ulefone_Rugged_Phone_Armor_X_13.jpg?v=1729493371&width=1024";
const fact={value:{url,verified_sku:"ARMOR-X13"},source_type:"manufacturer",source_url:source,reviewed_at:"2026-11-10T00:00:00Z"};
const factsByPn={"ARMOR-X13":{product_image:fact}};
const buyer=(text,sku="ARMOR-X13")=>({matched_partnumber:sku,last_message:text});
describe("ALEX verified product photographs (any future category)",()=>{
 it.each([
  "oe mandame una foto del Armor X13",
  "pasame fotos ps",
  "¿Tienen imágenes del equipo?",
  "¿Me muestras cómo es?",
  "quiero ver el celular",
  "mándame fotito del armor x13",
  "muestra imagen de este",
  "foto del Armor X13"
 ])("recognizes colloquial buyer asking for photo: %s",text=>{
  expect(requestsProductPhoto(text)).toBe(true);
 });
 it.each([
  "¿La cámara del X13 saca buenas fotos?",
  "Busco una cámara para sacar fotos",
  "¿Tiene cámara de 50 MP?",
  "Quiero tomar fotos bajo el agua"
 ])("does not confuse taking photos with requesting a product picture: %s",text=>{
  expect(requestsProductPhoto(text)).toBe(false);
 });
 it("sends a verified, exact SKU image without model selecting a URL",()=>{
  const x=verifiedProductPhoto({buyer:buyer("manda foto del Armor X13"),catalog:products,factsByPn});
  expect(x.url).toBe(url);
  expect(x.partnumber).toBe("ARMOR-X13");
  expect(x.caption).toContain("Ulefone Armor X13");
  expect(x.caption).not.toMatch(/disponible|precio|stock/i);
 });
 it("refuses the only image when another model was requested",()=>{
  const x=verifiedProductPhoto({buyer:buyer("manda foto del Armor 22","ARMOR-22-256G"),catalog:products,factsByPn});
  expect(x).toBeNull();
 });
 it("does not send images for references unverified in the catalog",()=>{
  const x=verifiedProductPhoto({buyer:{customer_reference:"SAMSUNG-X1",matched_partnumber:null,last_message:"manda foto del Samsung X1"},catalog:products,factsByPn});
  expect(x).toBeNull();
 });
 it("never substitutes a picture for a two-model comparison",()=>{
  const x=verifiedProductPhoto({buyer:buyer("manda fotos del Armor X13 y Armor X12 Pro"),catalog:products,factsByPn});
  expect(x).toBeNull();
 });
 it("requires a verified-sku binding on the photo fact",()=>{
  const tampered={"ARMOR-X13":{product_image:{...fact,value:{url,verified_sku:"ARMOR-22-256G"}}}};
  expect(verifiedProductPhoto({buyer:buyer("manda foto"),catalog:products,factsByPn:tampered})).toBeNull();
 });
 it("disallows arbitrary domains, HTTP, credentials and other formats",()=>{
  for(const bad of [
   "http://store.ulefone.com/phone.jpg",
   "https://evil.test/phone.jpg",
   "https://store.ulefone.com.evil.test/phone.jpg",
   "https://user:password@store.ulefone.com/phone.jpg",
   "https://store.ulefone.com/file.svg",
   "https://127.0.0.1/file.jpg",
   "https://store.ulefone.com/file.webp"
  ])expect(safePublicImageUrl(bad,source)).toBeNull();
  expect(safePublicImageUrl(url,source)).toBe(url);
 });
 it("only a trusted manufacturer or internal reviewed fact may supply an image",()=>{
  const low={"ARMOR-X13":{product_image:{...fact,source_type:"supplier"}}};
  expect(verifiedProductPhoto({buyer:buyer("foto"),catalog:products,factsByPn:low})).toBeNull();
 });
 it("never exposes product image as a manufacturer spec in model prompt",()=>{
  const rows=[{title:"Ulefone Armor X13 64GB",brand:"ULEFONE",partnumber:"ARMOR-X13",attributes:{},price_pen:null}];
  const enriched=enrichCatalog(rows,false,[],{factsByPn});
  expect(JSON.stringify(enriched[0].especificaciones_fabricante)).not.toContain(url);
  expect(packSalesCatalog(enriched)).not.toContain(url);
 });
 it.each([
  "foto del Armor X13",
  "foto del Armor X12 Pro",
  "pasame foto del Armor 22",
  "foto del Armor 25T Pro"
 ])("does not mistake model digits for number of devices: %s",text=>{
  const rows=[...products,row("ARMOR-25TPro-256GB","Ulefone Armor 25T Pro 256GB")];
  expect(buildBuyerContext([text],{catalog:rows}).quantity).toBe(null);
 });
 it("still understands real quantity shorthand while distinguishing X13 model",()=>{
  const b=buildBuyerContext(["precio del armor x13 x 5"],{catalog:products});
  expect(b.quantity).toBe(5);
  const a=buildBuyerContext(["quiero 2 Armor X13"],{catalog:products});
  expect(a.quantity).toBe(2);
  const c=buildBuyerContext(["armor x13 precio x5"],{catalog:products});
  expect(c.quantity).toBe(5);
 });
 it("returns brief natural answers when photo cannot be verified",()=>{
  expect(productPhotoUnavailableReply(buyer("manda foto"))).toMatch(/no tengo una foto verificada/i);
  expect(productPhotoUnavailableReply({last_message:"foto",matched_partnumber:null})).toMatch(/de qué modelo/i);
 });
});
