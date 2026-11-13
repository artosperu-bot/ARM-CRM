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
const quantityAtStart=new RegExp("^\\s*(?:(?:quiero|necesito|dame|agrega(?:me)?|anade(?:me)?|incluye|cotiza(?:me)?|llevo|me llevo|me quedo con|mejor|para|de|los|las|por)\\s+)?("+numToken+")(?:\\s+(?:unidades?|equipos?|celulares?|telefonos?|laptops?|impresoras?|tablets?|productos?|del?|los?|las?|de)){0,4}\\b","u");
const quantityAfter=new RegExp("^\\s*(?:x\\s*|por\\s+|son\\s+|serian\\s+|a\\s+|en\\s+)("+numToken+")\\b","u");
const parseQty=s=>Object.hasOwn(words,s)?words[s]:/^\d{1,3}$/u.test(s)?Number(s):null;
const itemPattern=/\b(?:quiero|necesito|dame|agrega(?:me)?|anade(?:me)?|ponme|sumame|sumale|incluye|cotizame|cotiza|llev[oa]|comprar|comprame|pedido de|me llevo|me quedo con|voy a comprar|pido|para llevar|ademas)\b/u;
const removePattern=/\b(?:quita(?:me)?|saca(?:me)?|elimina|borra|retira|ya no quiero|sacale)\b/u;
const correctionPattern=/\b(?:noo?\s+era(?:n)?|mejor|quise decir|me equivoque|ahora son|dejalo en|dejalos en|corrige(?:lo)? a|en vez de|serian|sube|aumenta)\b/u;
const changePattern=/\b(?:mejor quiero|en vez de|cambia(?:me)?|reemplaza(?:me)?)\b/u;
const cancelPattern=/\b(?:ya no quiero comprar|no quiero comprar|no comprare|ya no compro|cancela(?:lo)? (?:la compra|todo)|cancelalo todo|olvida (?:la compra|el pedido)|mejor ya no compro|no quiero ninguno)\b/u;
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
// Only in product matching: standardize spaced units without changing quantity parsing.
const modelTokens=s=>clean(s).replace(/\b(\d{1,5})\s+(gb|tb|w|mt)\b/gu,"$1$2")
 .split(" ").filter(Boolean);
const isModelCode=t=>t.length>=2&&/^(?:[a-z]{1,15}\d[a-z0-9]*|\d+[a-z]{1,12}[a-z0-9]*)$/u.test(t);
function findLineProduct(segment,catalog){
 const padded=" "+clean(segment)+" ";
 const hits=[];
 for(const row of Array.isArray(catalog)?catalog:[]){
  if(!allowedSku(row?.partnumber))continue;
  const all=aliases(row).filter(a=>padded.includes(" "+a.name+" "));
  if(all.length)hits.push({row,hit:all.sort((a,b)=>(b.weight+b.name.length)-(a.weight+a.name.length))[0]});
 }
 const ranked=hits.sort((a,b)=>b.hit.weight+b.hit.name.length-(a.hit.weight+a.hit.name.length));
 if(ranked.length&&(!ranked[1]||
    ranked[0].hit.weight+ranked[0].hit.name.length>ranked[1].hit.weight+ranked[1].hit.name.length))
  return {partnumber:ranked[0].row.partnumber,alias:ranked[0].hit.name,
   index:padded.indexOf(" "+ranked[0].hit.name+" ")};
 // A common model name (T14, Tab A9, DDR5) can describe multiple variants.
 // Rank all *explicit* customer model/variant tokens, never infer by category alone.
 const queryTokens=modelTokens(segment);
 const codes=queryTokens.filter(isModelCode);
 if(!codes.length)return null;
 const numeric=queryTokens.filter(t=>/^\d{3,5}$/u.test(t));
 const alternatives=[];
 for(const row of Array.isArray(catalog)?catalog:[]){
  if(!allowedSku(row?.partnumber))continue;
  const known=new Set([...modelTokens(row.titulo||row.title),...modelTokens(row.partnumber)]);
  const matched=codes.filter(t=>known.has(t)||
   (t.length>=5&&[...known].some(k=>k.startsWith(t))));
  if(!matched.length)continue;
  const nMatches=numeric.filter(t=>known.has(t)).length;
  const extra=queryTokens.filter(t=>t.length>=4&&!codes.includes(t)&&!numeric.includes(t)&&known.has(t)).length;
  const score=matched.length*80+nMatches*30+Math.min(extra,4)*5;
  alternatives.push({row,score,matched});
 }
 alternatives.sort((a,b)=>b.score-a.score);
 if(!alternatives.length||alternatives[1]?.score>=alternatives[0].score)return null;
 const best=alternatives[0],token=best.matched.find(t=>padded.includes(" "+t+" "))||best.matched[0];
 return {partnumber:best.row.partnumber,alias:token,index:padded.indexOf(" "+token+" ")};
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
 // Replace a *named* existing SKU with another named SKU only on explicit
 // "cambio [old] por [new]" intent. Merely asking the alternative price
 // must never replace or append an item to a purchase-interest draft.
 const switching=raw.match(/\b(?:cambio|cambia|reemplazo|reemplaza|sustituyo|sustituye)\s+(.+?)\s+(?:por|a)\s+(.+)$/u);
 if(switching){
  const previousProduct=findLineProduct(switching[1],catalog);
  const nextProduct=findLineProduct(switching[2],catalog);
  if(previousProduct&&nextProduct&&previousProduct.partnumber!==nextProduct.partnumber&&
     items.has(previousProduct.partnumber)){
   if(items.has(nextProduct.partnumber))
    return {items:starting,focus:items.has(focus)?focus:null,ambiguous:true,changed:false};
   const quantity=quantityFor(switching[2],nextProduct)??items.get(previousProduct.partnumber);
   const revised=starting.map(x=>x.partnumber===previousProduct.partnumber?
     {partnumber:nextProduct.partnumber,quantity}:x);
   return {items:normalizeDraftItems(revised),focus:nextProduct.partnumber,
    ambiguous:false,changed:true};
  }
 }
 let last=items.has(focus)?focus:null,ambiguous=false,changed=false;
 // Preserve punctuation until after splitting. clean() removes commas, which
 // previously merged "mejor 3 H390, el H570e igual" into a single wrong SKU.
 const chunks=String(text).normalize("NFD").replace(/[\u0300-\u036f]/gu,"")
  .toLowerCase().split(/\s+(?:y|ademas)\s+|\s*[,;+]\s*/u)
  .map(clean).filter(Boolean).slice(0,12);
 const matches=chunks.map(part=>({part,found:findLineProduct(part,catalog)}));
 const explicit=matches.filter(x=>x.found);
 const multiple=explicit.length>1;
 const exploratoryOnly=/\b(?:quiero|necesito)\s+(?:saber|ver|comparar|consultar|conocer|revisar|entender|preguntar|que me digas|fotos?|imagenes?|informacion|el precio|precio|precios|garantia|stock)\b/u.test(raw)&&
  !/\b(?:cotizame|cotiza|agrega|anade|ponme|llevo|comprar|compro|comprame|dame|pido)\b/u.test(raw);
 const supportIssue=/\b(?:devolucion|reembolso|reclamo|reclamacion|se malogro|no prende|no funciona|me llego mal|me llego roto|quiero cambiar (?:mi|el|la))\b/u.test(raw);
 const hasGlobalAdd=itemPattern.test(raw)&&!exploratoryOnly&&!supportIssue;
 // The buyer may name a product in one clause and give the quantity in the
 // next: "busco Epson L1250, quiero 1". This never applies to comparisons.
 const separatedQuantity=explicit.length===1&&hasGlobalAdd?
   raw.match(new RegExp("\\b(?:quiero|necesito|dame|llevo|compro)\\s+("+numToken+")\\b","u")):null;
 const addedSeparately=parseQty(separatedQuantity?.[1]);
 for(const {part,found} of matches){
  if(!found)continue;
  const sku=found.partnumber,qty=quantityFor(part,found)??addedSeparately;
  const localRemove=removePattern.test(part)||
   /\bsin\s+(?:el|la|los|las)\s+/u.test(part)||
   /^(?:no\s+con\s+(?:el|la|los|las)?|no\s+(?:el|la)|sin\s+(?:el|la))\b/u.test(part);
  const localAdd=!exploratoryOnly&&!supportIssue&&
   (itemPattern.test(part)||(hasGlobalAdd&&(multiple||addedSeparately!==null)));
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
  const positional=raw.match(/\b(?:el|la)\s+(?:(?:que\s+(?:dije|mencione|nombre)\s+))?(primero|primera|segundo|segunda|tercero|tercera)\b/u);
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
   // Resolve "mejor 3 monitores LG" only when the existing draft has
   // exactly one matching category/brand. Never guess between two monitors.
   const type=[
    [/\bmonitor(?:es)?\b/u,"monitor"],[/\blaptops?\b/u,"laptop"],
    [/\bimpresoras?\b/u,"impresora"],[/\baudifonos?\b/u,"audifon"],
    [/\brouters?\b/u,"router"],[/\bcargadores?\b/u,"cargador"],
    [/\btablets?\b/u,"tablet"],[/\bcelulares?\b/u,"celular"]
   ].find(([pattern])=>pattern.test(raw));
   let typed=[];
   if(type){
    typed=starting.filter(x=>{
     const row=(Array.isArray(catalog)?catalog:[]).find(p=>p.partnumber===x.partnumber);
     const words=clean((row?.titulo||row?.title||"")+" "+(row?.categoria||row?.category_path||[]).join(" "));
     return words.includes(type[1]);
    });
    if(typed.length>1){
     const named=typed.filter(x=>{
      const row=catalog.find(p=>p.partnumber===x.partnumber);
      const brand=clean(row?.marca||row?.brand||"");
      return brand&&(" "+raw+" ").includes(" "+brand+" ");
     });
     if(named.length)typed=named;
    }
   }
   const target=type?(typed.length===1?typed[0].partnumber:null):
    last&&items.has(last)?last:items.size===1?[...items.keys()][0]:null;
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
