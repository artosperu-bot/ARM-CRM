import {describe,it,expect} from "vitest";
import {evaluateCommercialEvidence,loadCommercialEvidence} from "./commercial-evidence.mjs";
const now=Date.parse("2026-11-12T16:00:00.000Z");
const at=offset=>new Date(now+offset*60000).toISOString();
const p={workspace_id:"ws",partnumber:"SKU-EXACT",price_pen:999,verified_at:at(0)};
const review={
 workspace_id:"ws",partnumber:p.partnumber,review_state:"approved",reviewer_id:"reviewer",
 review_note:"Revisado contra lista comercial y reservas de todos los canales",
 price_pen:999,price_source_ref:"STECH-DIRECT-20261112",
 price_reviewed_at:at(-1),price_expires_at:at(120),
 saleable_units:2,stock_source_ref:"ERP+CANAL-ORDERS-20261112",
 stock_source_updated_at:at(-2),stock_reviewed_at:at(-1),stock_expires_at:at(8),
 channels_reconciled_at:at(-1),commitments_reconciled_at:at(-1),
 reservations_reconciled_at:at(-1)
};
const mapping={workspace_id:"ws",arm_partnumber:p.partnumber,erp_partnumber:"ERP-SKU",mapping_status:"verified_exact"};
const observation={
 workspace_id:"ws",arm_partnumber:p.partnumber,erp_partnumber:"ERP-SKU",source_server:"PC005",
 source_table:"DB_ST.dbo.ST_STOCK_HST_CONSULTA",source_updated_at:at(-2),
 freshness:"fresh",physical_units:3
};
const get=(r=review,m=mapping,o=observation,t=now)=>
 evaluateCommercialEvidence(p,r,m,o,{now:t,reservationLayerReady:true});
describe("commercial offer evidence: default deny independent price and ATP",()=>{
 it("unreviewed arm_products price and ERP physical stock cannot reach ALEX",()=>{
  expect(get(null)).toMatchObject({pricePen:null,priceVerified:false,saleableStock:false,availability:"por confirmar"});
 });
 it("live mode keeps stock unconfirmed without a transactional reservation layer",()=>{
  const current=evaluateCommercialEvidence(p,review,mapping,observation,{now});
  expect(current).toMatchObject({pricePen:999,priceVerified:true,saleableStock:false,availability:"por confirmar"});
  expect(current.blockers).toContain("reserva_transaccional_no_habilitada");
 });
 it("accepts a reviewed current price and only fully reconciled saleable inventory",()=>{
  expect(get()).toMatchObject({pricePen:999,priceVerified:true,saleableStock:true,availability:"disponible"});
 });
 it("permits verified price without any stock promise",()=>{
  expect(get(review,mapping,{...observation,physical_units:0})).toMatchObject({
   pricePen:999,priceVerified:true,saleableStock:false,availability:"por confirmar"
  });
 });
 it("never mixes review/workspace/SKU identity",()=>{
  for(const r of [{...review,workspace_id:"other"},{...review,partnumber:"OTHER"},{...review,review_state:"revoked"}])
   expect(get(r).priceVerified).toBe(false);
  expect(get(review,{...mapping,mapping_status:"candidate"}).saleableStock).toBe(false);
  expect(get(review,{...mapping,erp_partnumber:"another"}).saleableStock).toBe(false);
 });
 it("rejects stale and future claims, and price expiry independently",()=>{
  expect(get({...review,price_expires_at:at(-1)}).priceVerified).toBe(false);
  expect(get({...review,price_reviewed_at:at(-400),price_expires_at:at(1)}).priceVerified).toBe(false);
  expect(get({...review,price_reviewed_at:at(3),price_expires_at:at(50)}).priceVerified).toBe(false);
  expect(get({...review,stock_expires_at:at(-1)}).saleableStock).toBe(false);
  expect(get({...review,stock_expires_at:at(60)}).saleableStock).toBe(false);
 });
 it("requires reconciliation of channels, commitments and reservations AFTER source snapshot",()=>{
  for(const field of ["channels_reconciled_at","commitments_reconciled_at","reservations_reconciled_at"])
   expect(get({...review,[field]:at(-4)}).saleableStock).toBe(false);
 });
 it("rejects stale or changed ERP observations even when marked fresh",()=>{
  expect(get(review,mapping,{...observation,source_updated_at:at(-30)}).saleableStock).toBe(false);
  expect(get(review,mapping,{...observation,source_updated_at:at(-1)}).saleableStock).toBe(false);
  expect(get(review,mapping,{...observation,freshness:"pending_mapping"}).saleableStock).toBe(false);
  expect(get(review,mapping,{...observation,physical_units:-2}).saleableStock).toBe(false);
  expect(get(review,mapping,{...observation,physical_units:1}).saleableStock).toBe(false);
 });
 it("rejects unsafe sources and absent reviewer",()=>{
  expect(get({...review,reviewer_id:null}).priceVerified).toBe(false);
  expect(get({...review,price_source_ref:"?"}).priceVerified).toBe(false);
  expect(get({...review,stock_source_ref:"?"}).saleableStock).toBe(false);
 });
 it("loader never uses reviews from another workspace",async()=>{
  const data={
   arm_commercial_reviews:[{...review,workspace_id:"other"}],
   arm_erp_product_map:[mapping],arm_erp_stock_observations:[observation]
  };
  const client={from(table){
    return {select(){return this;},eq(){return this;},in(){return this;},
      limit:async()=>({data:data[table],error:null})};
  }};
  const result=await loadCommercialEvidence(client,"ws",[p],{now});
  expect(result[p.partnumber]).toMatchObject({priceVerified:false,saleableStock:false});
 });
 it("read errors fail closed and do not fabricate a price",async()=>{
  const client={from(){
    return {select(){return this;},eq(){return this;},in(){return this;},
     limit:async()=>({data:null,error:{code:"PERMISSION_DENIED"}})};
  }};
  await expect(loadCommercialEvidence(client,"ws",[p],{now})).rejects.toThrow("ARM_COMMERCIAL_EVIDENCE_READ_FAILED");
 });
});
