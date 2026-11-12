/**
 * Independent evidence gates for price and available-to-promise inventory.
 * Never infer stock from physical ERP units or from a stale price snapshot.
 * The actual reservations and commitments must be reconciled before "available".
 */
const within=(input,now,maxMs)=>{
 const n=Date.parse(String(input||""));
 return Number.isFinite(n)&&n<=now+120000&&now-n>=-120000&&now-n<=maxMs;
};
const ms=input=>Date.parse(String(input||""));
const text=input=>typeof input==="string"?input.trim():"";
const nonempty8=input=>text(input).length>=8;
export function evaluateCommercialEvidence(product,review,mapping,observation,{now=Date.now(),reservationLayerReady=false}={}){
 const blockers=[];
 const approved=review?.review_state==="approved"&&nonempty8(review.review_note)&&
   Boolean(review.reviewer_id)&&
   review.partnumber===product?.partnumber&&review.workspace_id===product?.workspace_id;
 const checked=ms(review?.price_reviewed_at),expiry=ms(review?.price_expires_at);
 const rawPrice=Number(review?.price_pen);
 const priceVerified=Boolean(approved&&review?.price_pen!==null&&review?.price_pen!==undefined&&
   Number.isFinite(rawPrice)&&rawPrice>0&&nonempty8(review?.price_source_ref)&&
   within(review?.price_reviewed_at,now,6*3600000)&&
   Number.isFinite(expiry)&&expiry>now&&expiry>checked&&expiry-checked<=6*3600000);
 if(!priceVerified)blockers.push("precio_vigente_sin_aprobacion");
 const reference=ms(review?.stock_source_updated_at);
 const stockChecked=ms(review?.stock_reviewed_at),stockExpiry=ms(review?.stock_expires_at);
 const mappingExact=mapping?.mapping_status==="verified_exact"&&
   mapping?.arm_partnumber===product?.partnumber&&
   mapping?.workspace_id===product?.workspace_id&&
   mapping.erp_partnumber===observation?.erp_partnumber;
 const observed=observation?.arm_partnumber===product?.partnumber&&
   observation?.workspace_id===product?.workspace_id&&
   observation?.source_server==="PC005"&&
   observation?.source_table==="DB_ST.dbo.ST_STOCK_HST_CONSULTA"&&
   observation?.freshness==="fresh"&&
   Number.isInteger(observation?.physical_units)&&observation.physical_units>=0&&
   within(observation?.source_updated_at,now,15*60000)&&
   ms(observation?.source_updated_at)===reference;
 const commitments=["channels_reconciled_at","commitments_reconciled_at","reservations_reconciled_at"]
   .every(field=>{
     const v=ms(review?.[field]);
     return Number.isFinite(v)&&v>=reference&&v<=now+120000&&within(review?.[field],now,15*60000);
   });
 const units=review?.saleable_units;
 // No backend transaction can reserve across STECH channels yet. This hard gate
 // remains false in the live loader until a verified atomic reservation service exists.
 const stockVerified=Boolean(reservationLayerReady&&approved&&mappingExact&&observed&&
   Number.isInteger(units)&&units>0&&units<=observation.physical_units&&
   nonempty8(review?.stock_source_ref)&&
   within(review?.stock_source_updated_at,now,15*60000)&&
   within(review?.stock_reviewed_at,now,15*60000)&&
   Number.isFinite(stockExpiry)&&stockExpiry>now&&stockExpiry>stockChecked&&
   stockExpiry-stockChecked<=15*60000&&stockChecked>=reference&&
   commitments);
 if(!stockVerified)blockers.push(!reservationLayerReady?"reserva_transaccional_no_habilitada":
   !mappingExact?"pn_no_homologado":
   !observed?"erp_stock_no_conciliado":"disponibilidad_vendible_sin_aprobacion");
 return {
  pricePen:priceVerified?rawPrice:null,
  priceVerified,
  saleableStock:stockVerified,
  availableToPromiseUnits:stockVerified?units:null,
  availability:stockVerified?"disponible":"por confirmar",
  // Internal only. Do not forward quantitative warehouse or ATP data to the LLM.
  blockers
 };
}

export async function loadCommercialEvidence(client,workspaceId,products,{now=Date.now()}={}){
 const skus=[...new Set((products||[]).filter(p=>p?.partnumber&&p.workspace_id===workspaceId)
   .map(p=>p.partnumber))].slice(0,30);
 if(!skus.length)return {};
 const [rv,mp,ob]=await Promise.all([
  client.from("arm_commercial_reviews")
   .select("workspace_id,partnumber,review_state,reviewer_id,review_note,price_pen,price_source_ref,price_reviewed_at,price_expires_at,saleable_units,stock_source_ref,stock_source_updated_at,stock_reviewed_at,stock_expires_at,channels_reconciled_at,commitments_reconciled_at,reservations_reconciled_at")
   .eq("workspace_id",workspaceId).in("partnumber",skus).limit(30),
  client.from("arm_erp_product_map")
   .select("workspace_id,arm_partnumber,erp_partnumber,mapping_status")
   .eq("workspace_id",workspaceId).in("arm_partnumber",skus).limit(30),
  client.from("arm_erp_stock_observations")
   .select("workspace_id,arm_partnumber,erp_partnumber,source_server,source_table,source_updated_at,physical_units,freshness")
   .eq("workspace_id",workspaceId).in("arm_partnumber",skus).limit(30)
 ]);
 if(rv.error||mp.error||ob.error)throw new Error("ARM_COMMERCIAL_EVIDENCE_READ_FAILED");
 const reviews=new Map((rv.data||[]).map(x=>[x.partnumber,x]));
 const mappings=new Map((mp.data||[]).map(x=>[x.arm_partnumber,x]));
 const observations=new Map((ob.data||[]).map(x=>[x.arm_partnumber,x]));
 return Object.fromEntries(products.filter(p=>skus.includes(p.partnumber)).map(p=>[
   p.partnumber,evaluateCommercialEvidence(p,reviews.get(p.partnumber),
    mappings.get(p.partnumber),observations.get(p.partnumber),{now})
 ]));
}
