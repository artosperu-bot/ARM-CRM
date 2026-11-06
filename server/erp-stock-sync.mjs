// Opt-in internal ERP physical stock synchronization; never sends WhatsApp,
// changes selling prices, or marks products available to promise.
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {resolve} from "node:path";
import {createClient} from "@supabase/supabase-js";
import {buildErpObservations} from "./erp-stock-adapter.mjs";
function envFile(file){
 const e={};try{
  for(const line of readFileSync(file,"utf8").split(/\r?\n/)){
   const m=line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)\s*$/);
   if(m)e[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,"");
  }
 }catch{}
 return e;
}
const root=resolve(import.meta.dirname,"..");
const env={...envFile("C:\\DESAROLLO\\n8n\\backend\\.env"),...envFile("C:\\DESAROLLO\\ARM-CRM\\.env.local"),...process.env};
if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)throw new Error("PRIVATE_SUPABASE_CREDENTIALS_REQUIRED");
const cli=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:maps,error:mapError}=await cli.from("arm_erp_product_map")
 .select("workspace_id,arm_partnumber,erp_partnumber,mapping_status")
 .eq("origin_server","PC005").limit(50);
if(mapError)throw new Error("ERP_MAPPING_READ_FAILED");
const script=resolve(root,"scripts","ARM-ERP-READONLY-PC020.ps1");
let erp;
try{
  const raw=execFileSync("powershell.exe",["-NoProfile","-ExecutionPolicy","Bypass","-File",script],
    {encoding:"utf8",timeout:32000,maxBuffer:65536,windowsHide:true});
  erp=JSON.parse(raw.replace(/^\uFEFF/,"").trim());
}catch{throw new Error("PC005_READONLY_ERP_QUERY_FAILED");}
const {observations,errors}=buildErpObservations(maps,erp,{maxAgeMinutes:180});
if(errors.length)throw new Error("ERP_MAPPING_AMBIGUOUS_OR_MISSING_COUNT_"+errors.length);
if(!observations.length)throw new Error("ERP_OBSERVATIONS_EMPTY");
const {error:saveError}=await cli.from("arm_erp_stock_observations").upsert(observations,
  {onConflict:"workspace_id,arm_partnumber"});
if(saveError)throw new Error("ERP_OBSERVATIONS_UPSERT_FAILED");
const tally=observations.reduce((o,x)=>(o[x.freshness]=(o[x.freshness]||0)+1,o),{});
console.log("ERP_STOCK_OBSERVATIONS_STORED="+observations.length);
console.log("ERP_FRESH="+(tally.fresh||0));
console.log("ERP_PENDING_PN_REVIEW="+(tally.pending_mapping||0));
console.log("ERP_STALE="+(tally.stale||0));
console.log("ERP_ANOMALY="+(tally.anomaly||0));
console.log("SALES_PRICES_CHANGED=0");
console.log("PRODUCT_AVAILABILITY_CHANGED=0");
console.log("OUTBOUND_MESSAGES_SENT=0");
