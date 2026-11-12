import {describe,it,expect} from "vitest";
import {evaluateCommercialEvidence,loadCommercialEvidence} from "./commercial-evidence.mjs";
import {enrichCatalog} from "./product-knowledge.mjs";
const now=Date.parse("2026-11-12T16:00:00.000Z");
const at=mins=>new Date(now+mins*60000).toISOString();
const product={workspace_id:"ws",partnumber:"SKU-DEMO",title:"Laptop prueba",brand:"LENOVO",price_pen:999};
const price={workspace_id:"ws",partnumber:product.partnumber,review_state:"approved",reviewer_id:"manager",
 review_note:"Verificado por gerente para el piloto",price_pen:1999.00,
 price_source_ref:"PRECIO-STECH-INTERNO",price_reviewed_at:at(-10),price_expires_at:at(60)};
const stock={workspace_id:"ws",partnumber:product.partnumber,approved:true,on_hand:4,
 available_units:2,held_units:2,source_ref:"CONTEO-SUPABASE-TEST",reviewed_at:at(-4),expires_at:at(50)};
const run=(p=price,s=stock,n=now)=>evaluateCommercialEvidence(product,p,s,{now:n});
describe("Supabase-only price, stock and reservation evidence",()=>{
 it("no approved records means no real offers",()=>{
  expect(run(null,null)).toMatchObject({pricePen:null,priceVerified:false,saleableStock:false,availability:"por confirmar"});
 });
 it("uses independent current commercial price and stock",()=>{
  expect(run()).toMatchObject({pricePen:1999,priceVerified:true,saleableStock:true,availableToPromiseUnits:2});
  const two=enrichCatalog([product],false,[],{commercialByPn:{"SKU-DEMO":run()},requestedQuantity:2})[0];
  const three=enrichCatalog([product],false,[],{commercialByPn:{"SKU-DEMO":run()},requestedQuantity:3})[0];
  expect(two.disponibilidad).toBe("disponible");
  expect(three.disponibilidad).toBe("por confirmar");
  expect(three.precio_soles).toBe(1999);
 });
 it("does not promote old product.price_pen when review is missing",()=>{
  expect(enrichCatalog([product],false,[])[0].precio_soles).toBeNull();
 });
 it("price may be approved even when inventory has no free units",()=>{
  expect(run(price,{...stock,available_units:0})).toMatchObject({pricePen:1999,saleableStock:false});
 });
 it("stock is independent of price",()=>{
  expect(run(null,stock)).toMatchObject({pricePen:null,saleableStock:true});
 });
 it("rejects revoked, expired, future or mismatched price",()=>{
  for(const changed of [
   {...price,review_state:"revoked"},{...price,workspace_id:"other"},
   {...price,partnumber:"OTHER"},{...price,price_source_ref:"?"},
   {...price,price_expires_at:at(-1)},{...price,price_reviewed_at:at(4)}
  ])expect(run(changed).priceVerified).toBe(false);
 });
 it("rejects stale stock, overcounted free units and unapproved pilot quantities",()=>{
  for(const changed of [
   {...stock,approved:false},{...stock,workspace_id:"other"},
   {...stock,partnumber:"OTHER"},{...stock,available_units:5},
   {...stock,available_units:-1},{...stock,reviewed_at:at(-63)},
   {...stock,expires_at:at(-1)},{...stock,source_ref:"?"}
  ])expect(run(price,changed).saleableStock).toBe(false);
 });
 it("loads only same-workspace Supabase rows",async()=>{
  const db={
   from(name){expect(name).toBe("arm_commercial_reviews");
    return {select(){return this;},eq(){return this;},in(){return this;},
     limit:async()=>({data:[price,{...price,workspace_id:"other",partnumber:"OTHER"}],error:null})};},
   rpc(name,args){expect(name).toBe("arm_stock_snapshot");
    expect(args).toMatchObject({p_workspace_id:"ws",p_partnumbers:["SKU-DEMO"]});
    return Promise.resolve({data:[stock,{...stock,workspace_id:"other",partnumber:"OTHER"}],error:null});}
  };
  expect((await loadCommercialEvidence(db,"ws",[product],{now}))["SKU-DEMO"].pricePen).toBe(1999);
 });
 it("fails closed on Supabase snapshot error",async()=>{
  const db={
   from(){return {select(){return this;},eq(){return this;},in(){return this;},limit:async()=>({data:[],error:null})};},
   rpc:async()=>({data:null,error:{code:"READ_DENIED"}})
  };
  await expect(loadCommercialEvidence(db,"ws",[product],{now})).rejects.toThrow("ARM_COMMERCIAL_EVIDENCE_READ_FAILED");
 });
});
