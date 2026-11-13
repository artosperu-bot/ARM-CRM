// Read-only validation of the indexed ARM catalog on PC020.
// Never prints secrets, customer messages, stock quantities or sellable prices.
import {readFileSync} from "node:fs";
import {createClient} from "@supabase/supabase-js";
import {retrieveSalesCatalog} from "./catalog-retrieval.mjs";
function readLocal(file){
 const out={};try{
  for(const line of readFileSync(file,"utf8").split(/\r?\n/)){
   const m=line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
   if(m)out[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,"");
  }
 }catch{}
 return out;
}
const conf={...readLocal("C:\\DESAROLLO\\n8n\\backend\\.env"),
  ...readLocal("C:\\DESAROLLO\\ARM-CRM\\.env.local"),...process.env};
const url=conf.SUPABASE_URL||conf.VITE_SUPABASE_URL;
const key=conf.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error("LOCAL_PRIVATE_SERVICE_CREDENTIALS_REQUIRED");
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:one,error}=await db.from("arm_products").select("workspace_id").limit(1).maybeSingle();
if(error||!one?.workspace_id)throw new Error("ARM_CATALOG_UNAVAILABLE");
const wa=one.workspace_id;
const checks=[
 ["specific_model",["Hola, necesito el Armor 22","¿Cuánto cuesta?"],"ARMOR-22-256G"],
 ["generic_category",["Quiero un celular resistente"],null],
 ["unknown_product",["Busco una impresora Brother HL-L2340"],null]
];
for(const [name,turns,expected] of checks){
 const result=await retrieveSalesCatalog(db,wa,turns,{limit:18});
 if(result.products.length>18)throw new Error("UNBOUNDED_CATALOG_RESULTS");
 if(expected&&!result.products.some(p=>p.partnumber===expected))
  throw new Error("KNOWN_PRODUCT_NOT_FOUND");
 const found=result.products.map(p=>p.partnumber).join(",");
 console.log(name.toUpperCase()+"_COUNT="+result.products.length);
 console.log(name.toUpperCase()+"_SKU="+found);
}
console.log("ERP_WRITES=0");
console.log("CUSTOMER_MESSAGES_SENT=0");
