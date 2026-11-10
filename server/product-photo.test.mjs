import {describe,it,expect} from "vitest";
import {requestsProductPhoto,safePublicImageUrl,verifiedProductPhoto,productPhotoUnavailableReply} from "./product-photo.mjs";
import {enrichCatalog} from "./product-knowledge.mjs";
import {buildBuyerContext} from "./buyer-reasoning.mjs";
import {snapshotSalesMemory} from "./sales-memory.mjs";
import {matchCustomerProduct,affirmativeProductText} from "./catalog-matching.mjs";
import {isExplicitProductSwitch} from "./customer-topic.mjs";
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
  "Quiero tomar fotos bajo el agua",
  "no quiero fotos, dime precio nomas",
  "me muestras fotos tomadas con la cámara del X13?",
  "no me mandes foto de ese equipo",
  "quiero ver fotos de la cámara"
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
 it("never sends old Armor X13 photo when buyer explicitly asks Armor 22",()=>{
  const b=buyer("oye pasame foto del Armor 22","ARMOR-X13");
  expect(verifiedProductPhoto({buyer:b,catalog:[products[0]],factsByPn})).toBeNull();
 });
 it("never sends old Ulefone photo when buyer asks for a Samsung",()=>{
  const b=buyer("manda foto de la Samsung Tab S10","ARMOR-X13");
  expect(verifiedProductPhoto({buyer:b,catalog:[products[0]],factsByPn})).toBeNull();
 });
 it("never sends a single image when multiple manufacturers are requested",()=>{
  const b=buyer("fotos de Ulefone y Samsung","ARMOR-X13");
  expect(verifiedProductPhoto({buyer:b,catalog:[products[0]],factsByPn})).toBeNull();
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
 it("follows 'Armor 22, no del X13' instead of reusing the previous image",()=>{
  const previous=buildBuyerContext(["manda foto del Armor X13"],{catalog:products});
  const message="mejor ahora pasame foto del Armor 22, no del X13";
  expect(affirmativeProductText(message).toLowerCase()).not.toMatch(/\bx13\b/);
  expect(isExplicitProductSwitch(message)).toBe(true);
  const match=matchCustomerProduct(message,products);
  expect(match?.partnumber).toBe("ARMOR-22-256G");
  const next=buildBuyerContext([message],{catalog:products,memory:snapshotSalesMemory(previous)});
  expect(next.matched_partnumber).toBe("ARMOR-22-256G");
  const both={
   "ARMOR-22-256G":{product_image:{...fact,
     value:{verified_sku:"ARMOR-22-256G",url:"https://store.ulefone.com/cdn/shop/files/Rugged_Phone_Armor_22_Night_Vision_Camera.jpg?v=1762843122&width=1024"},
     source_url:"https://store.ulefone.com/es/products/armor-22"}},
   ...factsByPn
  };
  const img=verifiedProductPhoto({buyer:next,catalog:products,factsByPn:both});
  expect(img?.partnumber).toBe("ARMOR-22-256G");
  expect(img.url).toContain("Armor_22_Night");
  expect(img.url).not.toContain("Armor_X_13");
 });
 it("works if rejected model is mentioned before the requested model",()=>{
  const text="no del X13, mejor ahora mandame foto del Armor 22";
  const next=buildBuyerContext([text],{catalog:products});
  expect(next.matched_partnumber).toBe("ARMOR-22-256G");
 });
 it("supports a completely new manufacturer/category without code changes",()=>{
  const future=row("DJI-MAVIC-3E","Drone DJI Mavic 3E");
  future.marca="DJI";
  const media={
   value:{verified_sku:future.partnumber,url:"https://store.dji.com/media/catalog/mavic-3e.jpg"},
   source_type:"manufacturer",source_url:"https://store.dji.com/product/mavic-3e",
   reviewed_at:new Date().toISOString()
  };
  const b=buildBuyerContext(["pásame foto del DJI Mavic 3E"],{catalog:[future]});
  expect(b.matched_partnumber).toBe(future.partnumber);
  const result=verifiedProductPhoto({buyer:b,catalog:[future],factsByPn:{
   "DJI-MAVIC-3E":{product_image:media}
  }});
  expect(result?.partnumber).toBe("DJI-MAVIC-3E");
  expect(result?.url).toBe(media.value.url);
  expect(result?.caption).toMatch(/Drone DJI Mavic 3E/);
 });
 it("does not select an older official picture when future SKU changes",()=>{
  const old=row("DJI-MAVIC-3E","Drone DJI Mavic 3E");
  old.marca="DJI";
  const b={matched_partnumber:old.partnumber,last_message:"ahora mejor foto del DJI Mavic 4E"};
  const result=verifiedProductPhoto({buyer:b,catalog:[old],factsByPn:{
   "DJI-MAVIC-3E":{product_image:{value:{verified_sku:old.partnumber,
     url:"https://store.dji.com/media/mavic-3e.jpg"},source_url:"https://store.dji.com/product/mavic-3e",source_type:"manufacturer"}}
  }});
  expect(result).toBeNull();
 });
 it("rejects locally resolvable domains even with matching provenance",()=>{
  for(const domain of ["127.0.0.1","localhost","photos.internal","a.example.com","x.nip.io","a.sslip.io"]){
   const url="https://"+domain+"/picture.jpg";
   expect(safePublicImageUrl(url,url)).toBeNull();
  }
 });
 it("returns brief natural answers when photo cannot be verified",()=>{
  expect(productPhotoUnavailableReply(buyer("manda foto"))).toMatch(/no tengo una foto verificada/i);
  expect(productPhotoUnavailableReply({last_message:"foto",matched_partnumber:null})).toMatch(/de qué modelo/i);
 });
});
