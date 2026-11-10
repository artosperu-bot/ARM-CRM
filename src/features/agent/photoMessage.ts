/** Parse the server-owned, persisted photo marker in an assistant turn.
 * Do not display untrusted URLs just because the model wrote Markdown.
 */
const trustedHosts=new Set(["store.ulefone.com","www.s-tech.com.pe","s-tech.com.pe"]);
export function parseAgentPhotoMessage(content:string):{body:string;photoUrl:string|null}{
 const raw=String(content||"");
 const m=raw.match(/\n\[FOTO_VERIFICADA\]\((https:\/\/[^)\s]+)\)\s*$/u);
 if(!m)return {body:raw,photoUrl:null};
 try{
  const url=new URL(m[1]);
  if(url.protocol!=="https:"||!trustedHosts.has(url.hostname.toLowerCase())||
   url.port||url.username||url.password||url.hash||
   !/\.(?:jpg|jpeg|png)$/iu.test(url.pathname))
   return {body:raw,photoUrl:null};
  return {body:raw.slice(0,m.index).trim(),photoUrl:url.href};
 }catch{return {body:raw,photoUrl:null};}
}
