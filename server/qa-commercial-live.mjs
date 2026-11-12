/**
 * Read-only PC020 smoke audit. Prints counts, never source credentials,
 * warehouse units, individual customer details or product prices.
 * No OpenAI, WhatsApp or ERP writes.
 */
import {readFileSync} from "node:fs";
import {createClient} from "@supabase/supabase-js";
import {loadCommercialEvidence} from "./commercial-evidence.mjs";
import {enrichCatalog} from "./product-knowledge.mjs";
function readEnv(path){
 const out={};try{for(const line of readFileSync(path,"utf8").split(/\r?\n/)){
  const m=line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
  if(m)out[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,"");
 }}catch{}
 return out;
}
const env={...readEnv("C:\\DESAROLLO\\n8n\\backend\\.env"),
 ...readEnv("C:\\DESAROLLO\\ARM-CRM\\.env.local"),...process.env};
if(!env.SUPABASE_SERVICE_ROLE_KEY||!(env.SUPABASE_URL||env.VITE_SUPABASE_URL))
 throw Error("PRIVATE_SUPABASE_CREDENTIALS_MISSING");
const db=createClient(env.SUPABASE_URL||env.VITE_SUPABASE_URL,
 env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:workspaces,error:wError}=await db.from("arm_workspaces")
 .select("id").limit(5);
if(wError||!workspaces?.length)throw Error("WORKSPACE_READ_FAILED");
let productTotal=0,pricesVerified=0,saleableVerified=0,unverified=0,leaks=0;
for(const ws of workspaces){
 const {data:rows,error}=await db.from("arm_products")
  .select("workspace_id,partnumber,title,brand,price_pen,verified_at,stock_erp")
  .eq("workspace_id",ws.id).limit(100);
 if(error)throw Error("PRODUCT_READ_FAILED");
 const products=rows||[];
 const evidence=await loadCommercialEvidence(db,ws.id,products);
 const catalog=enrichCatalog(products,false,[],{commercialByPn:evidence});
 productTotal+=products.length;
 for(const item of catalog){
  const ev=evidence[item.partnumber];
  if(!ev?.priceVerified)unverified++;
  if(item.precio_soles!==null)pricesVerified++;
  if(item.disponibilidad==="disponible")saleableVerified++;
  if(!ev?.priceVerified&&item.precio_soles!==null)leaks++;
 }
}
if(leaks)throw Error("UNVERIFIED_PRICE_LEAK_"+leaks);
console.log("ARM_COMMERCIAL_SMOKE_OK=true");
console.log("PRODUCTS_SCANNED="+productTotal);
console.log("VERIFIED_PRICES="+pricesVerified);
console.log("VERIFIED_SALEABLE_STOCK="+saleableVerified);
console.log("UNVERIFIED_PRICES="+unverified);
console.log("DATA_WRITES=0 OUTBOUND_MESSAGES=0");
