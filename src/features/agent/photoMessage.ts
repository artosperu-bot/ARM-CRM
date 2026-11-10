/** Render only the server-owned [FOTO_VERIFICADA] marker persisted by
 * ARM-CRM. This is not ordinary user Markdown or model-supplied arbitrary URLs.
 */
function publicPhotoHost(raw:string){
 const h=String(raw||"").toLowerCase();
 return h.length<=253&&h.includes(".")&&/^[a-z0-9.-]+$/u.test(h)&&
  !/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(h)&&
  !/(?:^|\.)(?:localhost|local|internal|invalid|test|example|onion|lan|home)$/u.test(h)&&
  !/(?:^|\.)(?:example\.(?:com|org|net)|nip\.io|sslip\.io)$/u.test(h)&&
  h.split(".").every(x=>x.length>0&&x.length<=63&&!x.startsWith("-")&&!x.endsWith("-"));
}
export function parseAgentPhotoMessage(content:string):{body:string;photoUrl:string|null}{
 const raw=String(content||"");
 const m=raw.match(/\n\[FOTO_VERIFICADA\]\((https:\/\/[^)\s]+)\)\s*$/u);
 if(!m)return {body:raw,photoUrl:null};
 try{
  const url=new URL(m[1]);
  if(url.protocol!=="https:"||!publicPhotoHost(url.hostname)||
   url.port||url.username||url.password||url.hash||
   !/\.(?:jpg|jpeg|png)$/iu.test(url.pathname))
   return {body:raw,photoUrl:null};
  return {body:raw.slice(0,m.index).trim(),photoUrl:url.href};
 }catch{return {body:raw,photoUrl:null};}
}
