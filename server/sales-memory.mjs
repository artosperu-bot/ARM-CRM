import {buildBuyerContext} from "./buyer-reasoning.mjs";

/**
 * Minimal, deterministic sales memory. Stores only buyer-supplied commercial
 * facts; no raw transcripts, names, documents, phone numbers, AI conclusions,
 * stock claims, prices or outbound permissions.
 * Versioned so old/malformed database snapshots fail closed.
 */
const reference=(v)=>typeof v==="string"&&/^[A-Z0-9][A-Z0-9._-]{3,79}$/iu.test(v)?v:null;
const timestamp=(v)=>typeof v==="string"&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
const budget=(v)=>v&&Number.isInteger(v.pen)&&v.pen>0&&v.pen<=1000000&&
  ["total","por_unidad","sin_aclarar"].includes(v.scope)?{pen:v.pen,scope:v.scope}:null;
const phrase=(v)=>typeof v==="string"&&v.length<=50&&/^[\p{L}\p{N} ._-]+$/u.test(v)?v:null;
export function normalizeSalesMemory(input){
 if(!input||input.version!==1||typeof input!=="object")return null;
 return {
  version:1,
  quantity:Number.isInteger(input.quantity)&&input.quantity>=1&&input.quantity<=999?input.quantity:null,
  budget:budget(input.budget),
  brand:phrase(input.brand),
  use_case:phrase(input.use_case),
  selected_partnumber:reference(input.selected_partnumber),
  customer_reference:reference(input.customer_reference),
  requires_human:input.requires_human===true,
  last_message_at:timestamp(input.last_message_at),
  last_message_id:typeof input.last_message_id==="string"&&input.last_message_id.length<=180?
    input.last_message_id:null
 };
}
export function snapshotSalesMemory(buyer,{previous=null,lastMessageAt=null,lastMessageId=null}={}){
 const old=normalizeSalesMemory(previous);
 const newestReference=reference(buyer?.customer_reference);
 const newlyDifferent=Boolean(newestReference&&
   newestReference!==old?.customer_reference&&
   newestReference!==old?.selected_partnumber);
 const selected=reference(buyer?.matched_partnumber)||
   (!newlyDifferent?old?.selected_partnumber:null)||null;
 return {
  version:1,
  quantity:Number.isInteger(buyer?.quantity)&&buyer.quantity>=1&&buyer.quantity<=999?buyer.quantity:null,
  budget:budget(buyer?.budget),
  brand:phrase(buyer?.brand),
  use_case:phrase(buyer?.use_case),
  selected_partnumber:selected,
  customer_reference:newestReference,
  requires_human:buyer?.requires_human===true,
  last_message_at:timestamp(lastMessageAt)||old?.last_message_at||null,
  last_message_id:typeof lastMessageId==="string"&&lastMessageId.length<=180?
    lastMessageId:old?.last_message_id||null
 };
}
/** Ordered inbound rows, processed once past last saved event. Safe to replay. */
export function foldSalesMemory(previous,rows,{catalog=[]}={}){
 const old=normalizeSalesMemory(previous);
 const events=(Array.isArray(rows)?rows:[])
   .filter(x=>x?.direction==="inbound"&&typeof x.content==="string"&&x.content.trim()&&
     timestamp(x.created_at))
   .sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at))||
     String(a.external_message_id||a.id||"").localeCompare(String(b.external_message_id||b.id||"")));
 if(!events.length)return old;
 let fresh=events;
 if(old?.last_message_id){
  const idx=events.findIndex(x=>(x.external_message_id||x.id)===old.last_message_id);
  if(idx>=0)fresh=events.slice(idx+1);
  else if(old.last_message_at)fresh=events.filter(x=>Date.parse(x.created_at)>Date.parse(old.last_message_at));
 }else if(old?.last_message_at){
  fresh=events.filter(x=>Date.parse(x.created_at)>Date.parse(old.last_message_at));
 }
 if(!fresh.length)return old;
 const buyer=buildBuyerContext(fresh.map(x=>x.content),{catalog,memory:old});
 const last=fresh.at(-1);
 return snapshotSalesMemory(buyer,{
  previous:old,lastMessageAt:last.created_at,lastMessageId:last.external_message_id||last.id||null
 });
}
