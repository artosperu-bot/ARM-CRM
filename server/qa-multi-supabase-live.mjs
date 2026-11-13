/**
 * Safe read-only smoke test of multi-SKU buyer state against Supabase pilot.
 * Does not send WhatsApp, store agent turns or update commercial records.
 */
import {readFileSync} from "node:fs";
import {createClient} from "@supabase/supabase-js";
import {retrieveSalesCatalog} from "./catalog-retrieval.mjs";
import {enrichCatalog} from "./product-knowledge.mjs";
import {buildBuyerContext} from "./buyer-reasoning.mjs";
import {snapshotSalesMemory} from "./sales-memory.mjs";
import {assessCommercialReadiness} from "./commercial-readiness.mjs";
import {protectSalesResponse} from "./sales-response-guard.mjs";
function envFile(path){
 const values={};
 try{for(const line of readFileSync(path,"utf8").split(/\r?\n/u)){
  const m=line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/u);
  if(m)values[m[1]]=m[2].trim().replace(/^['"]|['"]$/gu,"");
 }}catch{}
 return values;
}
const env={...envFile("C:\\DESAROLLO\\n8n\\backend\\.env"),
 ...envFile("C:\\DESAROLLO\\ARM-CRM\\.env.local"),...process.env};
const url=env.SUPABASE_URL||env.VITE_SUPABASE_URL;
if(!url||!env.SUPABASE_SERVICE_ROLE_KEY)throw Error("QA_SUPABASE_CONFIG_MISSING");
const db=createClient(url,env.SUPABASE_SERVICE_ROLE_KEY,{
 auth:{persistSession:false,autoRefreshToken:false}
});
const {data:workspaces,error:wsError}=await db.from("arm_workspaces").select("id").limit(1);
if(wsError||!workspaces?.length)throw Error("QA_WORKSPACE_UNAVAILABLE");
const workspace=workspaces[0].id;
const messages=[
 "oe quiero 3 armor x13 y 2 armor 22",
 "mejor 4 del armor x13",
 "y el total? aceptan yape?",
 "noo mejor 6 del x13",
 "cuanto me sale todo?"
];
let memory=null,last;
for(const message of messages){
 const required=(memory?.draft_items||[]).map(x=>x.partnumber);
 const catalogResult=await retrieveSalesCatalog(db,workspace,
  required.length?[...required,message]:[message],{
   limit:18,requiredPartnumbers:required
  });
 const skus=catalogResult.products.map(x=>x.partnumber);
 const {data:offers,error:offerError}=skus.length?
  await db.from("arm_offer_simulations")
   .select("partnumber,price_pen,stock_status,stock_units_demo,is_test_data")
   .eq("workspace_id",workspace).eq("is_test_data",true)
   .in("partnumber",skus).limit(24):
  {data:[],error:null};
 if(offerError)throw Error("QA_SIMULATED_OFFERS_UNAVAILABLE");
 const preview=enrichCatalog(catalogResult.products,true,offers||[]);
 const proposed=buildBuyerContext([message],{catalog:preview,memory});
 const catalog=enrichCatalog(catalogResult.products,true,offers||[],{
  requestedQuantity:proposed.quantity||1,
  requestedQuantitiesByPn:Object.fromEntries(proposed.draft_items.map(x=>[x.partnumber,x.quantity]))
 });
 const buyer=buildBuyerContext([message],{catalog,memory});
 memory=snapshotSalesMemory(buyer,{previous:memory});
 const readiness=assessCommercialReadiness(buyer,{catalog,simulated:true});
 last={buyer,catalog,readiness};
 console.log("TURN "+JSON.stringify({
  matched:skus.length,
  draft:memory.draft_items,
  basketAmount:readiness.demoBasket?.totalPen,
  available:readiness.demoBasket?.allAvailable??null,
  noOperation:!readiness.quoteCreated&&!readiness.orderCreated&&!readiness.paymentRegistered
 }));
}
if(last?.readiness?.demoBasket?.totalPen!==6792)
 throw Error("QA_BASKET_TOTAL_NOT_MATCHED");
const safe=protectSalesResponse("Todo está disponible y ya está confirmado.",{
 buyer:last.buyer,catalog:last.catalog,simulated:true
});
if(!safe.blocked||!safe.reply.includes("no disponible"))throw Error("QA_STOCK_UNSAFE");
console.log("QA_SUPABASE_MULTI_DRAFT_OK=true DATA_WRITES=0 CUSTOMER_MESSAGES=0");
