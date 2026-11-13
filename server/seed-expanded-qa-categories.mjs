/**
 * Private and reproducible fixture seed. Does not touch public arm_products.
 * Export is read-only. Seed is opt-in, service-role-only and idempotent.
 * Usage:
 *   node server/seed-expanded-qa-categories.mjs export
 *   set ALEX_QA_SEED_CONFIRM=YES && node server/seed-expanded-qa-categories.mjs seed
 */
import {readFileSync,writeFileSync} from "node:fs";
import {createClient} from "@supabase/supabase-js";
const file="server/qa-expanded-category-fixtures.json";
function dotenv(path){const v={};try{for(const line of readFileSync(path,"utf8").split(/\r?\n/u)){
 const m=line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/u);
 if(m)v[m[1]]=m[2].trim().replace(/^['"]|['"]$/gu,"");
}}catch{}return v;}
const env={...dotenv("C:\\DESAROLLO\\n8n\\backend\\.env"),
 ...dotenv("C:\\DESAROLLO\\ARM-CRM\\.env.local"),...process.env};
const mode=process.argv[2];
if(!["export","seed"].includes(mode))throw Error("MODE_MUST_BE_EXPORT_OR_SEED");
if(mode==="seed"&&env.ALEX_QA_SEED_CONFIRM!=="YES")
 throw Error("SEED_CONFIRMATION_REQUIRED");
if(!env.SUPABASE_SERVICE_ROLE_KEY||!(env.SUPABASE_URL||env.VITE_SUPABASE_URL))
 throw Error("QA_SUPABASE_CONNECTION_MISSING");
const db=createClient(env.SUPABASE_URL||env.VITE_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,
 {auth:{persistSession:false,autoRefreshToken:false}});
const {data:ws,error:wsErr}=await db.from("arm_workspaces").select("id")
 .eq("name","STECH PERU").limit(1);
if(wsErr||ws?.length!==1)throw Error("QA_WORKSPACE_NOT_FOUND");
const fields="partnumber,title,brand,category_path,family_key,variant_options,attributes,demo_price_pen,demo_stock_units,demo_stock_status,is_test_data";
if(mode==="export"){
 const {data,error}=await db.from("arm_qa_catalog_products").select(fields)
  .eq("workspace_id",ws[0].id).order("partnumber");
 if(error||data?.length!==16)throw Error("QA_EXPORT_INCOMPLETE");
 writeFileSync(file,JSON.stringify(data,null,2)+"\n");
 console.log("QA_EXPORT_OK=16 SOURCE=SUPABASE");
}else{
 const data=JSON.parse(readFileSync(file,"utf8"));
 if(!Array.isArray(data)||data.length!==16)throw Error("QA_SEED_EXPECTED_16");
 const cat=new Map(),seen=new Set();
 for(const x of data){
  if(typeof x.partnumber!=="string"||!/^QA-[A-Z0-9._-]{3,79}$/u.test(x.partnumber)||
    x.is_test_data!==true||x.attributes?.qa_only!==true||seen.has(x.partnumber)||
    !Array.isArray(x.category_path)||x.category_path.length!==3||
    !Number.isInteger(x.demo_stock_units)||x.demo_stock_units<0||
    !Number.isFinite(Number(x.demo_price_pen))||Number(x.demo_price_pen)<0)
   throw Error("QA_SEED_VALIDATION_FAILED");
  seen.add(x.partnumber);
  const k=x.category_path.join("/");
  cat.set(k,(cat.get(k)||0)+1);
 }
 if(cat.size!==8||[...cat.values()].some(n=>n!==2))
  throw Error("QA_SEED_CATEGORY_COUNTS_WRONG");
 const rows=data.map(x=>({...x,workspace_id:ws[0].id}));
 const {error}=await db.from("arm_qa_catalog_products").upsert(rows,{
  onConflict:"workspace_id,partnumber"
 });
 if(error)throw Error("QA_SEED_WRITE_FAILED_"+error.code);
 const {count,error:verifyErr}=await db.from("arm_qa_catalog_products")
  .select("partnumber",{head:true,count:"exact"}).eq("workspace_id",ws[0].id);
 if(verifyErr||count!==16)throw Error("QA_SEED_READBACK_FAILED");
 console.log("QA_SEED_OK=16 SUBCATEGORIES=8 LIVE_CATALOG_UNTOUCHED=true");
}
