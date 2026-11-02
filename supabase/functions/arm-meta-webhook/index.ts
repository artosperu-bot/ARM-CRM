import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { parseMetaMessages } from "./parse.ts";

// Public Meta endpoint: fail-closed until verified app credentials are configured.
// Never send messages from this function.
const text=(body:string,status=200)=>new Response(body,{status,headers:{"Content-Type":"text/plain; charset=utf-8"}});
const json=(status:number,value:Record<string,unknown>)=>new Response(JSON.stringify(value),{
 status,headers:{"Content-Type":"application/json; charset=utf-8"},
});
function safeEqualHex(a:string,b:string){
 if(a.length!==b.length||!/^[0-9a-f]+$/i.test(a)||!/^[0-9a-f]+$/i.test(b))return false;
 let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);
 return difference===0;
}
async function signatureValid(raw:Uint8Array,header:string,secret:string){
 if(!header.startsWith("sha256="))return false;
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),
   {name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const signed=new Uint8Array(await crypto.subtle.sign("HMAC",key,raw));
 const expected=[...signed].map(byte=>byte.toString(16).padStart(2,"0")).join("");
 return safeEqualHex(header.slice(7).toLowerCase(),expected);
}
type Db=ReturnType<typeof createClient>;
async function storeMessage(db:Db,m:ReturnType<typeof parseMetaMessages>[number]){
 const {data:connection,error:connectionError}=await db.from("arm_channel_connections")
  .select("workspace_id").eq("provider","meta_graph").eq("channel",m.channel)
  .eq("external_account_ref",m.accountRef)
  .in("status",["read_only","active"]).limit(1).maybeSingle();
 if(connectionError)throw connectionError;
 if(!connection)return "ignored" as const;
 const ws=connection.workspace_id as string;
 const {data:existingMessage,error:lookupError}=await db.from("arm_messages").select("id")
  .eq("workspace_id",ws).eq("provider",m.channel).eq("external_message_id",m.messageId).maybeSingle();
 if(lookupError)throw lookupError;
 if(existingMessage)return "duplicate" as const;
 let {data:thread,error:threadLookup}=await db.from("arm_threads")
   .select("id,contact_id,last_activity_at").eq("workspace_id",ws).eq("channel",m.channel)
   .eq("external_account_ref",m.accountRef).eq("external_sender_id",m.senderId).maybeSingle();
 if(threadLookup)throw threadLookup;
 if(!thread){
  const display=(m.senderName?.trim()||"Cliente "+m.channel+" "+m.senderId.slice(-4)).slice(0,200);
  const {data:contact,error:contactError}=await db.from("arm_contacts").insert({
    workspace_id:ws,display_name:display,source:m.channel,
    phone:m.channel==="whatsapp"?m.senderId:null
  }).select("id").single();
  if(contactError)throw contactError;
  const created=await db.from("arm_threads").insert({
    workspace_id:ws,contact_id:contact.id,channel:m.channel,external_account_ref:m.accountRef,
    external_sender_id:m.senderId,status:"pending",last_activity_at:m.occurredAt
  }).select("id,contact_id,last_activity_at").single();
  if(created.error){
   if(created.error.code!=="23505")throw created.error;
   const retry=await db.from("arm_threads").select("id,contact_id,last_activity_at")
    .eq("workspace_id",ws).eq("channel",m.channel).eq("external_account_ref",m.accountRef)
    .eq("external_sender_id",m.senderId).single();
   if(retry.error)throw retry.error;
   thread=retry.data;
  }else thread=created.data;
 }
 const inserted=await db.from("arm_messages").insert({
  workspace_id:ws,contact_id:thread!.contact_id,thread_id:thread!.id,
  provider:m.channel,external_message_id:m.messageId,direction:"inbound",
  content:m.content,message_type:m.messageType,created_at:m.occurredAt
 }).select("id").single();
 if(inserted.error){
  if(inserted.error.code==="23505")return "duplicate" as const;
  throw inserted.error;
 }
 if(m.occurredAt>thread!.last_activity_at){
  const updated=await db.from("arm_threads").update({last_activity_at:m.occurredAt}).eq("workspace_id",ws).eq("id",thread!.id);
  if(updated.error)throw updated.error;
 }
 const event=await db.from("arm_inbound_events").upsert({
  workspace_id:ws,provider:m.channel,external_event_id:m.accountRef+":"+m.messageId,
  processed_at:new Date().toISOString()
 },{onConflict:"workspace_id,provider,external_event_id",ignoreDuplicates:true});
 if(event.error)throw event.error;
 return "stored" as const;
}
Deno.serve(async(req:Request)=>{
 const verifyToken=Deno.env.get("ARM_META_VERIFY_TOKEN");
 const appSecret=Deno.env.get("ARM_META_APP_SECRET");
 if(req.method==="GET"){
  if(!verifyToken)return text("Not configured",503);
  const u=new URL(req.url);
  const token=u.searchParams.get("hub.verify_token");
  if(u.searchParams.get("hub.mode")==="subscribe"&&token&&token===verifyToken){
   const challenge=u.searchParams.get("hub.challenge");
   return challenge&&/^\d{1,30}$/.test(challenge)?text(challenge):text("Invalid challenge",400);
  }
  return text("Forbidden",403);
 }
 if(req.method!=="POST")return text("Method not allowed",405);
 if(!appSecret)return text("Webhook verification is not configured",503);
 const length=Number(req.headers.get("content-length")||0);
 if(length>512000)return text("Payload too large",413);
 const raw=new Uint8Array(await req.arrayBuffer());
 if(raw.byteLength>512000)return text("Payload too large",413);
 if(!(await signatureValid(raw,req.headers.get("x-hub-signature-256")||"",appSecret)))
  return text("Invalid signature",401);
 let payload:unknown;
 try{payload=JSON.parse(new TextDecoder().decode(raw));}catch{return text("Invalid JSON",400);}
 const parsed=parseMetaMessages(payload);
 if(!parsed.length)return json(200,{ok:true,received:0,stored:0});
 const url=Deno.env.get("SUPABASE_URL");
 const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!serviceKey)return json(503,{error:"Database credentials unavailable"});
 const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 let stored=0,ignored=0,duplicates=0;
 try{
  for(const m of parsed){
    const result=await storeMessage(db,m);
    if(result==="stored")stored++;
    else if(result==="duplicate")duplicates++;
    else ignored++;
  }
 }catch(e){
  console.error("arm-meta-webhook: validated event storage error",e instanceof Error?e.name:"unknown");
  return json(503,{error:"Temporary delivery processing failure"});
 }
 return json(200,{ok:true,received:parsed.length,stored,ignored,duplicates});
});
