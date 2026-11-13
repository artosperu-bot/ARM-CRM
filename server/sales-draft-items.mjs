/**
 * Product-by-product buyer intent. Internal draft only; never a quotation,
 * cart checkout, inventory hold, confirmed order or payment.
 * Persist SKUs and customer-requested quantities, never price/stock/PII.
 */
const clean=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/gu,"")
 .toLowerCase().replace(/[^a-z0-9]+/gu," ").replace(/\s+/gu," ").trim();
const words={un:1,una:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10};
const numToken="(?:\\d{1,3}|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)";
const quantityAtEnd=new RegExp("\\b("+numToken+")(?:\\s+(?:unidades?|equipos?|celulares?|telefonos?|laptops?|impresoras?|tablets?|productos?|modelos?|del?|los?|las?|de)){0,4}\\s*$","u");
const quantityAtStart=new RegExp("^\\s*(?:(?:para|de|los|las|por)\\s+)?("+numToken+")(?:\\s+(?:unidades?|equipos?|celulares?|telefonos?|laptops?|impresoras?|tablets?|productos?|del?|los?|las?|de)){0,4}\\b","u");
const quantityAfter=new RegExp("^\\s*(?:x\\s*|por\\s+|son\\s+|serian\\s+|a\\s+|en\\s+)("+numToken+")\\b","u");
const parseQty=s=>Object.hasOwn(words,s)?words[s]:/^\d{1,3}$/u.test(s)?Number(s):null;
const itemPattern=/\b(?:quiero|necesito|dame|agrega(?:me)?|anade(?:me)?|ponme|sumame|sumale|incluye|cotizame|cotiza|llev[oa]|comprar|comprame|pedido de|me llevo|me quedo con|voy a comprar|pido|para llevar)\b/u;
const removePattern=/\b(?:quita(?:me)?|saca(?:me)?|elimina|borra|retira|ya no quiero|sacale)\b/u;
const correctionPattern=/\b(?:noo?\s+era(?:n)?|mejor|quise decir|me equivoque|ahora son|dejalo en|dejalos en|corrige(?:lo)? a|en vez de|serian|sube|aumenta)\b/u;
const changePattern=/\b(?:mejor quiero|en vez de|cambia(?:me)?|reemplaza(?:me)?)\b/u;
const cancelPattern=/\b(?:ya no quiero comprar|no quiero comprar|no comprare|cancela (?:la compra|todo)|olvida (?:la compra|el pedido)|mejor ya no compro|no quiero ninguno)\b/u;
const allowedSku=s=>typeof s==="string"&&/^[A-Z0-9][A-Z0-9._-]{3,79}$/iu.test(s)&&!/^\d+$/u.test(s);
export function normalizeDraftItems(items){
 if(!Array.isArray(items))return [];
 const seen=new Set(),out=[];
 for(const it of items.slice(0,12)){
  const pn=it?.partnumber;
  if(!allowedSku(pn)||!Number.isInteger(it?.quantity)||it.quantity<1||it.quantity>999||
    seen.has(pn.toUpperCase()))continue;
  seen.add(pn.toUpperCase());out.push({partnumber:pn,quantity:it.quantity});
 }
 return out;
}
function aliases(row){
 const sku=clean(row?.partnumber),title=clean(row?.titulo||row?.title);
 if(!sku||!title)return [];
 const result=[];
 if(sku.length>=5)result.push({name:sku,weight:100});
 if(title.length>=7)result.push({name:title,weight:90});
 for(const input of [title,sku]){
  for(const match of input.matchAll(/\b([a-z]{3,20})\s+([a-z]?\d{2,5}[a-z]?)\b/gu))
   result.push({name:match[0],weight:60});
  for(const match of input.matchAll(/\b[a-z]{1,12}\d{2,5}[a-z0-9]*\b/gu))
   result.push({name:match[0],weight:30});
 }
 return [...new Map(result.map(x=>[x.name,x])).values()];
}
function findLineProduct(segment,catalog){
 const padded=" "+clean(segment)+" ";
 const hits=[];
 for(const row of Array.isArray(catalog)?catalog:[]){
  if(!allowedSku(row?.partnumber))continue;
  const all=aliases(row).filter(a=>padded.includes(" "+a.name+" "));
  if(all.length)hits.push({row,hit:all.sort((a,b)=>(b.weight+b.name.length)-(a.weight+a.name.length))[0]});
 }
 const ranked=hits.sort((a,b)=>b.hit.weight+b.hit.name.length-(a.hit.weight+a.hit.name.length));
 if(!ranked.length)return null;
 if(ranked[1]&&ranked[0].hit.weight+ranked[0].hit.name.length<=ranked[1].hit.weight+ranked[1].hit.name.length)
  return null;
 return {partnumber:ranked[0].row.partnumber,alias:ranked[0].hit.name,
  index:padded.indexOf(" "+ranked[0].hit.name+" ")-1};
}
/** Resolve explicitly named models, without implying purchase or stock. */
export function explicitlyMentionedCatalogProducts(message,catalog=[]){
 const chunks=clean(message).split(/\s+(?:y|o|vs|versus|mientras(?: que)?|frente a(?:l)?|comparado con)\s+|[,;]+|\.\s+/u);
 const result=[],seen=new Set();
 for(const part of chunks.slice(0,16)){
  const found=findLineProduct(part,catalog);
  if(found&&!seen.has(found.partnumber)){
   seen.add(found.partnumber);result.push(found.partnumber);
  }
 }
 return result;
}
function quantityFor(segment,hit){
 const s=clean(segment),before=s.slice(0,hit?.index??s.length);
 const atEnd=before.match(quantityAtEnd);
 const after=s.slice((hit?.index??0)+(hit?.alias?.length||0)).match(quantityAfter);
 const front=s.match(quantityAtStart);
 const num=parseQty(atEnd?.[1]||after?.[1]||front?.[1]);
 return Number.isInteger(num)&&num>=1&&num<=999?num:null;
}
function parseBareCorrection(text){
 const c=clean(text);
 if(!correctionPattern.test(c))return null;
 const match=c.match(new RegExp("(?:\\b(?:mejor|era|eran|ahora son|quise decir|en vez de|dejalo en|dejalos en|serian|corrige(?:lo)? a)\\s+)(?:"+numToken+")\\b","u"));
 if(!match)return null;
 const value=c.slice(match.index).match(new RegExp(numToken+"\\b","u"));
 const n=parseQty(value?.[0]);
 return Number.isInteger(n)&&n>=1&&n<=999?n:null;
}
export function advanceDraftItems(previous,text,catalog=[],{focus=null}={}){
 const starting=normalizeDraftItems(previous),items=new Map(starting.map(x=>[x.partnumber,x.quantity]));
 const raw=clean(text);
 if(!raw)return {items:starting,focus:items.has(focus)?focus:null,ambiguous:false,changed:false};
 if(cancelPattern.test(raw))return {items:[],focus:null,ambiguous:false,changed:items.size>0};
 let last=items.has(focus)?focus:null,ambiguous=false,changed=false;
 const chunks=raw.split(/\s+(?:y|ademas)\s+|\s*[,;+]\s*/u).filter(Boolean).slice(0,12);
 const matches=chunks.map(part=>({part,found:findLineProduct(part,catalog)}));
 const explicit=matches.filter(x=>x.found);
 const multiple=explicit.length>1;
 const exploratoryOnly=/\b(?:quiero|necesito)\s+(?:saber|ver|comparar|consultar|conocer|revisar|entender|preguntar|que me digas|fotos?|imagenes?|informacion|el precio|precio|precios|garantia|stock)\b/u.test(raw)&&
  !/\b(?:cotizame|cotiza|agrega|anade|ponme|llevo|comprar|compro|comprame|dame|pido)\b/u.test(raw);
 const supportIssue=/\b(?:devolucion|reembolso|reclamo|reclamacion|se malogro|no prende|no funciona|me llego mal|me llego roto|quiero cambiar (?:mi|el|la))\b/u.test(raw);
 const hasGlobalAdd=itemPattern.test(raw)&&!exploratoryOnly&&!supportIssue;
 for(const {part,found} of matches){
  if(!found)continue;
  const sku=found.partnumber,qty=quantityFor(part,found);
  const localRemove=removePattern.test(part)||/\bsin\s+(?:el|la|los|las)\s+/u.test(part);
  const localAdd=!exploratoryOnly&&!supportIssue&&
   (itemPattern.test(part)||(hasGlobalAdd&&multiple&&qty!==null));
  const localCorrection=(correctionPattern.test(part)&&qty!==null)||
   /\b(?:mejor quiero|mejor dame|en vez de|reemplaza|cambia(?:me)?)\b/u.test(part);
  // "¿Cuál es mejor?" compares products: it is never a correction to the draft.
  if(localRemove){
   if(items.has(sku)){
    const count=items.get(sku);
    if(qty!==null&&/\b(?:quita|saca|resta)\s+\d/u.test(part)&&qty<count)
      items.set(sku,count-qty);
    else items.delete(sku);
    changed=true;
   }
   if(last===sku)last=null;
   continue;
  }
  if(!localAdd&&!localCorrection)continue; // comparing or asking stock is not adding to cart
  if(changePattern.test(part)&&!multiple&&items.size>1&&!items.has(sku)){
   ambiguous=true;continue; // which of several existing products should be replaced?
  }
  if(!items.has(sku)&&items.size>=12){ambiguous=true;continue;}
  if(changePattern.test(part)&&!multiple&&items.size===1&&!items.has(sku)){
   items.clear();changed=true; // explicit single-item switch, never implicit cross-SKU
  }
  const newQty=qty??(items.get(sku)||1);
  if(items.get(sku)!==newQty){items.set(sku,newQty);changed=true;}
  if(!multiple)last=sku;
 }
 if(multiple)last=null; // "mejor 4" after a two-item message needs clarification
 if(!explicit.length){
  // Explicit positional reference is safe only with a stable ordered draft.
  // "el primero" means the first listed SKU; never guess on "ese otro".
  const positional=raw.match(/\b(?:el|la)\s+(primero|primera|segundo|segunda|tercero|tercera)\b/u);
  const index=positional?(/primer/u.test(positional[1])?0:/segund/u.test(positional[1])?1:2):-1;
  const positioned= index>=0 ? starting[index]?.partnumber : null;
  const positionQty=raw.match(new RegExp("(?:dejalo|dejala|dejalos|dejala?\s+en|ponlo|ponla|sube|aumenta|cambia|corrige)\\s*(?:en|a)?\\s*("+numToken+")\\b","u"));
  const newQuantity=parseQty(positionQty?.[1]);
  if(positioned&&newQuantity!==null){
   if(items.get(positioned)!==newQuantity){items.set(positioned,newQuantity);changed=true;}
   last=positioned;
   ambiguous=false;
  }else{
  const n=parseBareCorrection(raw);
  if(n!==null){
   const target=last&&items.has(last)?last:items.size===1?[...items.keys()][0]:null;
   if(target){if(items.get(target)!==n){items.set(target,n);changed=true;} last=target;}
   else if(items.size>1)ambiguous=true;
  }
  }
 }
 return {items:normalizeDraftItems([...items].map(([partnumber,quantity])=>({partnumber,quantity}))),
  focus:last&&items.has(last)?last:null,ambiguous,changed};
}
export function draftSummary(items,catalog=[]){
 return normalizeDraftItems(items).map(it=>{
  const p=(Array.isArray(catalog)?catalog:[]).find(x=>x.partnumber===it.partnumber);
  return {partnumber:it.partnumber,quantity:it.quantity,
   title:p?String(p.titulo||p.title||it.partnumber).slice(0,110):null,
   verifiedInCurrentCatalog:Boolean(p)};
 });
}
