import {readFileSync} from "node:fs";
import {createClient} from "@supabase/supabase-js";
function env(path){
 const vars={};
 try {for(const line of readFileSync(path,"utf8").split(/\r?\n/)){
   const m=line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)\s*$/);
   if(m)vars[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,"");
 }}catch{return vars;}
 return vars;
}
const legacy=env("C:\\DESAROLLO\\n8n\\backend\\.env");
const arm=env("C:\\DESAROLLO\\ARM-CRM\\.env.local");
const key=k=>process.env[k]||arm[k]||legacy[k]||"";
const list=key("ARM_WHATSAPP_TEST_NUMBERS").split(",").map(v=>v.replace(/\D/g,"")).filter(Boolean);
if(list.length!==1||!/^519\d{8}$/.test(list[0]))throw Error("EXACTLY_ONE_VERIFIED_TEST_NUMBER_REQUIRED");
if(key("ARM_WHATSAPP_AUTO_REPLY")!=="enabled"||!key("ARM_META_APP_SECRET"))
  throw Error("TEST_FLAG_AND_APP_SECRET_REQUIRED");
const res=await fetch("http://127.0.0.1:3000/health",{signal:AbortSignal.timeout(8000)});
if(!res.ok)throw Error("GATEWAY_UNAVAILABLE");
const h=await res.json();
if(!h.webhookVerifiedReady||!h.inboundConnected||!h.automaticReplies||h.testNumbersConfigured!==1)
 throw Error("GATEWAY_NOT_READY");
const url=key("SUPABASE_URL"),service=key("SUPABASE_SERVICE_ROLE_KEY"),account=key("WHATSAPP_PHONE_NUMBER_ID");
if(!url||!service||!account)throw Error("SUPABASE_OR_META_ACCOUNT_NOT_CONFIGURED");
const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:items,error:fetchError}=await db.from("arm_meta_accounts").select("id,workspace_id,status,inbound_enabled")
 .eq("channel","whatsapp").eq("account_ref",account);
if(fetchError||items?.length!==1||items[0].status!=="verified_read_only")
 throw Error("WHATSAPP_TEST_ACCOUNT_NOT_FOUND");
const {data:enabled,error:updateError}=await db.from("arm_meta_accounts")
 .update({inbound_enabled:true,inbound_since:new Date().toISOString(),verified_at:new Date().toISOString()})
 .eq("id",items[0].id).eq("status","verified_read_only").select("id");
if(updateError||enabled?.length!==1)throw Error("TEST_ACCOUNT_ENABLE_FAILED");
console.log("ARM_WHATSAPP_TEST_READY=true");
console.log("TEST_RECIPIENT_COUNT=1");
console.log("INBOUND_SIGNED=true");
console.log("OUTBOUND_ALLOWLISTED=true");
console.log("OUTBOUND_MESSAGE_HISTORY_LOGGED=true");
console.log("TEST_PRICES_ENABLED="+(key("ARM_WHATSAPP_TEST_OFFERS")==="enabled"));
console.log("SEND_FROM_YOUR_AUTHORIZED_CELL_TO_META_TEST_NUMBER=+1 555-672-9256");
