// Safe, one-time sandbox backfill. No customer messages, deals, appointments,
// alerts or status changes are created. Only existing Meta-test recipients.
import {readFileSync} from "node:fs";
import {createClient} from "@supabase/supabase-js";
import {analyzeSalesConversation} from "./lead-intelligence.mjs";

function settings(path){
 const result={};
 try{
  for(const line of readFileSync(path,"utf8").split(/\r?\n/)){
   const m=line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)\s*$/);
   if(m)result[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,"");
  }
 }catch{}
 return result;
}
const env={...settings("C:\\DESAROLLO\\n8n\\backend\\.env"),
 ...settings("C:\\DESAROLLO\\ARM-CRM\\.env.local"),...process.env};
const allow=(env.ARM_WHATSAPP_TEST_NUMBERS||"").split(",").map(s=>s.replace(/\D/g,"")).filter(Boolean);
if(!allow.length||allow.length>5||!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY||!env.WHATSAPP_PHONE_NUMBER_ID)
 throw new Error("BACKFILL_REQUIRES_TEST_ALLOWLIST_AND_PRIVATE_CREDENTIALS");
const db=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:threads,error}=await db.from("arm_threads")
 .select("id,workspace_id,contact_id,status,assigned_to")
 .eq("channel","whatsapp").eq("external_account_ref",env.WHATSAPP_PHONE_NUMBER_ID)
 .in("external_sender_id",allow).limit(50);
if(error)throw Error("SANDBOX_BACKFILL_QUERY_FAILED");
let classified=0;
for(const thread of threads||[]){
 const {data:rows,error:readError}=await db.from("arm_messages")
  .select("content,direction,external_message_id,created_at")
  .eq("workspace_id",thread.workspace_id).eq("thread_id",thread.id)
  .eq("direction","inbound").order("created_at",{ascending:false}).limit(16);
 if(readError)throw Error("SANDBOX_BACKFILL_MESSAGE_READ_FAILED");
 if(!rows?.length)continue;
 const {should_reply,...record}=analyzeSalesConversation([...rows].reverse(),{
   threadStatus:thread.status,assignedTo:thread.assigned_to,sourceMode:"sandbox"
 });
 const {error:writeError}=await db.from("arm_lead_insights").upsert({
  workspace_id:thread.workspace_id,thread_id:thread.id,contact_id:thread.contact_id,
  ...record,evaluated_at:new Date().toISOString()
 },{onConflict:"thread_id"});
 if(writeError)throw Error("SANDBOX_BACKFILL_PERSIST_FAILED");
 classified++;
}
console.log("SANDBOX_THREAD_INSIGHTS_UPDATED="+classified);
console.log("OUTBOUND_MESSAGES_SENT=0");
console.log("DEALS_CREATED=0");
console.log("FOLLOWUPS_CREATED=0");
