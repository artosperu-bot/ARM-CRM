/**
 * Supabase-only commercial evidence. Price review, inventory, and reservations
 * live in ARM-CRM; no ERP or distributor feed is consulted.
 * Stock is advisory until a transaction successfully reserves it.
 */
const date=value=>Date.parse(String(value||""));
const goodText=value=>typeof value==="string"&&value.trim().length>=8;
const current=(reviewed,expires,now,maxAgeMs)=>{
 const start=date(reviewed),end=date(expires);
 return Number.isFinite(start)&&Number.isFinite(end)&&
   start<=now+120000&&now-start<=maxAgeMs&&
   end>now&&end>start&&end-start<=maxAgeMs;
};

export function evaluateCommercialEvidence(product,review,position,{now=Date.now()}={}){
 const blockers=[];
 const priceApproved=review?.review_state==="approved"&&Boolean(review?.reviewer_id)&&
   goodText(review?.review_note)&&
   review?.workspace_id===product?.workspace_id&&review?.partnumber===product?.partnumber;
 const amount=Number(review?.price_pen);
 const priceVerified=Boolean(priceApproved&&review?.price_pen!=null&&
   Number.isFinite(amount)&&amount>0&&goodText(review?.price_source_ref)&&
   current(review?.price_reviewed_at,review?.price_expires_at,now,6*3600000));
 if(!priceVerified)blockers.push("precio_no_aprobado_en_supabase");

 const count=Number(position?.available_units);
 const stockApproved=position?.workspace_id===product?.workspace_id&&
   position?.partnumber===product?.partnumber&&position?.approved===true&&
   goodText(position?.source_ref)&&
   current(position?.reviewed_at,position?.expires_at,now,60*60000)&&
   Number.isSafeInteger(count)&&count>0&&
   Number.isSafeInteger(Number(position?.on_hand))&&
   count<=Number(position.on_hand)&&Number(position.on_hand)>=0;
 const stockVerified=Boolean(stockApproved);
 if(!stockVerified)blockers.push("stock_supabase_no_aprobado_o_reservado");
 return {
  pricePen:priceVerified?amount:null,
  priceVerified,
  saleableStock:stockVerified,
  availableToPromiseUnits:stockVerified?count:null,
  availability:stockVerified?"disponible":"por confirmar",
  blockers
 };
}

export async function loadCommercialEvidence(client,workspaceId,products,{now=Date.now()}={}){
 const skus=[...new Set((products||[])
   .filter(p=>p?.partnumber&&p.workspace_id===workspaceId)
   .map(p=>p.partnumber))].slice(0,30);
 if(!skus.length)return {};
 const [reviews,stocks]=await Promise.all([
  client.from("arm_commercial_reviews")
   .select("workspace_id,partnumber,review_state,reviewer_id,review_note,price_pen,price_source_ref,price_reviewed_at,price_expires_at")
   .eq("workspace_id",workspaceId).in("partnumber",skus).limit(30),
  client.rpc("arm_stock_snapshot",{p_workspace_id:workspaceId,p_partnumbers:skus})
 ]);
 if(reviews.error||stocks.error)throw new Error("ARM_COMMERCIAL_EVIDENCE_READ_FAILED");
 const priceByPn=new Map((reviews.data||[])
  .filter(x=>x.workspace_id===workspaceId).map(x=>[x.partnumber,x]));
 const stockByPn=new Map((stocks.data||[])
  .filter(x=>x.workspace_id===workspaceId).map(x=>[x.partnumber,x]));
 return Object.fromEntries(products.filter(p=>skus.includes(p.partnumber)).map(p=>[
  p.partnumber,evaluateCommercialEvidence(p,priceByPn.get(p.partnumber),stockByPn.get(p.partnumber),{now})
 ]));
}
