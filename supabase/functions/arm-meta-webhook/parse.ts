/** Pure parser for official Meta webhook messages. No network calls, no credentials. */
export type Channel = "whatsapp"|"facebook"|"instagram";
export type Incoming = {
 channel:Channel; accountRef:string; senderId:string; messageId:string;
 content:string|null; messageType:"text"|"image"|"audio"|"video"|"document"|"unknown";
 senderName:string|null; occurredAt:string;
};
const safeText=(v:unknown,length=6000)=>typeof v==="string"?v.slice(0,length):null;
const safeId=(v:unknown)=>typeof v==="string" && v.length>0 && v.length<=240 ?v:null;
const types=new Set(["text","image","audio","video","document"]);
const timestamp=(val:unknown)=>{
 const n=typeof val==="number"?val:typeof val==="string"?Number(val):NaN;
 if(!Number.isFinite(n)||n<=0)return new Date().toISOString();
 const date=new Date(n*1000);
 return Number.isFinite(date.getTime())&&date.getTime()<=Date.now()+300000?date.toISOString():new Date().toISOString();
};
type Obj=Record<string,any>;
const obj=(x:unknown):Obj|null=>x!==null&&typeof x==="object"&&!Array.isArray(x)?x as Obj:null;
const arr=(x:unknown):unknown[]=>Array.isArray(x)?x.slice(0,200):[];
export function parseMetaMessages(payload:unknown):Incoming[]{
 const root=obj(payload);if(!root)return[];
 const result:Incoming[]=[];
 const channel:Channel|null=root.object==="whatsapp_business_account"?"whatsapp":root.object==="page"?"facebook":root.object==="instagram"?"instagram":null;
 if(!channel)return[];
 for(const item of arr(root.entry)){
  const entry=obj(item);if(!entry)continue;
  if(channel==="whatsapp"){
   for(const ch of arr(entry.changes)){
    const change=obj(ch);const value=obj(change?.value);if(!value)continue;
    const account=safeId(value.metadata?.phone_number_id);if(!account)continue;
    const contacts=arr(value.contacts).map(obj).filter(Boolean) as Obj[];
    for(const raw of arr(value.messages)){
     const message=obj(raw);if(!message)continue;
     const sender=safeId(message.from),id=safeId(message.id);
     if(!sender||!id)continue;
     const type=typeof message.type==="string"&&types.has(message.type)?message.type as Incoming["messageType"]:"unknown";
     const known=contacts.find(c=>c.wa_id===sender);
     const content=type==="text"?safeText(message.text?.body):null;
     result.push({channel,accountRef:account,senderId:sender,messageId:id,content,messageType:type,
       senderName:safeText(known?.profile?.name,150),occurredAt:timestamp(message.timestamp)});
    }
   }
  }else{
   const account=safeId(entry.id);if(!account)continue;
   for(const item of arr(entry.messaging)){
    const event=obj(item),message=obj(event?.message);
    if(!event||!message||message.is_echo===true)continue;
    const sender=safeId(event.sender?.id),id=safeId(message.mid);
    if(!sender||!id||sender===account)continue;
    const type=message.attachments?.length?"unknown":"text";
    result.push({channel,accountRef:account,senderId:sender,messageId:id,
      content:type==="text"?safeText(message.text):null,messageType:type,
      senderName:null,occurredAt:timestamp(event.timestamp?Number(event.timestamp)/1000:null)});
   }
  }
 }
 return result.slice(0,200);
}
