/**
 * Product photos are intentionally an evidence-only feature.
 * Never let an LLM invent an image URL, select the only available picture,
 * or substitute a similar-looking product for the requested exact SKU.
 *
 * Sources: manufacturer/reviewed company facts in arm_product_facts.
 * Public HTTPS JPEG/PNG is required for WhatsApp Cloud API image-by-link.
 */
import {affirmativeProductText} from "./catalog-matching.mjs";
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
export function requestsProductPhoto(message){
 const s=norm(message);
 if(!s)return false;
 // A customer declining photos must never trigger a media send.
 if(/\b(?:no (?:quiero|necesito|me mandes|mandes|envies|muestres|me envies)\s+(?:una?\s+)?(?:fotos?|imagenes?)|sin (?:fotos?|imagenes?))\b/u.test(s))return false;
 // Example photos captured by a phone are not pictures OF the product.
 if(/\b(?:fotos? (?:tomadas? con|que (?:toma|saca|hace)|de (?:su|la) camara)|muestras? (?:de|fotos? de) (?:su|la) camara|fotos? de la camara)\b/u.test(s))return false;
 // Questions about camera quality or taking pictures are not photo requests.
 if(/\b(?:tomar|toma|sacar|saca|captura|hace|graba|calidad de)\s+(?:buenas?\s+)?(?:fotos?|imagenes?)\b/u.test(s)
    && !/\b(?:manda|pasa|envia|enviame|muestra|muestrame|ensena|quiero ver|tienes fotos|foto del equipo)\b/u.test(s))
  return false;
 if(/^(?:fotos?|fotitos?|imagen(?:es)?)(?:\s+(?:del?|de la|para|por favor))?\b/u.test(s))return true;
 return /\b(?:fotos?|fotitos?|fotografias?|imagenes?|imagen|fotito|fotos)\b/u.test(s)&&
    /\b(?:manda(?:me)?|pasame|pasa|envia(?:me)?|mandame|ense[nñ]a(?:me)?|muestra(?:me)?|quiero|puedo ver|tienes|tienen|necesito|ver|env[ií]a|mostra(?:me)?|compart[eí](?:me)?|mostrar)\b/u.test(s)
    || /\b(?:muestrame|mu[eé]strame|ensename|ens[eé]ñame|me muestras|me ensenas)\s+(?:como (?:es|se ve)|el equipo|la laptop|el celular|el producto|el telefono)\b/u.test(s)
    || /\b(?:como se ve|quiero verlo|quiero verla|muestra el equipo|(?:quiero|quisiera|puedo) ver (?:el|la|un|una) (?:celular|equipo|producto|modelo|telefono|laptop|tablet|impresora))\b/u.test(s);
}
/** A public, manually reviewed product fact can originate from ANY official
 * manufacturer. No hardcoded Ulefone, Epson, Lenovo or other host whitelist.
 * Only same-origin verified source pages may supply a WhatsApp image link.
 */
function publicPhotoHost(raw){
 const h=String(raw||"").toLowerCase();
 return h.length<=253&&h.includes(".")&&/^[a-z0-9.-]+$/u.test(h)&&
   !/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(h)&&
   !/(?:^|\.)(?:localhost|local|internal|invalid|test|example|onion|lan|home)$/u.test(h)&&
   !/(?:^|\.)(?:example\.(?:com|org|net)|nip\.io|sslip\.io)$/u.test(h)&&
   h.split(".").every(x=>x.length>0&&x.length<=63&&!x.startsWith("-")&&!x.endsWith("-"));
}
export function safePublicImageUrl(raw,sourceUrl){
 try{
  if(typeof raw!=="string"||typeof sourceUrl!=="string")return null;
  const url=new URL(raw),source=new URL(sourceUrl);
  if(url.protocol!=="https:"||source.protocol!=="https:"||
     !publicPhotoHost(url.hostname)||!publicPhotoHost(source.hostname)||
     url.hostname.toLowerCase()!==source.hostname.toLowerCase()||
     url.username||url.password||url.port||url.hash||source.username||source.password||
     !/\.(?:jpg|jpeg|png)$/iu.test(url.pathname)||url.href.length>1100)
   return null;
  return url.href;
 }catch{return null;}
}
function normalizeWords(value){
 return norm(value).replace(/[^a-z0-9]+/g," ").trim();
}
function modelSignals(value){
 const text=normalizeWords(value);
 const terms=new Set();
 const tokens=text.split(" ").filter(Boolean);
 for(const token of tokens){
  if(/^(?=.*[a-z])(?=.*\d)[a-z0-9]{2,30}$/u.test(token)&&
     !/^\d+(?:gb|tb|mb|mah|w|hz|mp|kg|cm|mm|m|k)$/u.test(token))
   terms.add(token);
 }
 for(let i=1;i<tokens.length;i++){
  if(/^\d{2,4}$/u.test(tokens[i])&&/^[a-z]{2,18}$/u.test(tokens[i-1])&&
     !["precio","s","soles","total","para","foto","fotos","equipo","unidad","unidades","modelo"].includes(tokens[i-1]))
   terms.add(tokens[i-1]+" "+tokens[i]);
 }
 return terms;
}
const containsTerm=(haystack,term)=>(" "+normalizeWords(haystack)+" ").includes(" "+term+" ");
export function verifiedProductPhoto({buyer,catalog=[],factsByPn={}}={}){
 if(!Array.isArray(catalog))return null;
 const sku=buyer?.matched_partnumber;
 if(!sku)return null;
 const p=catalog.find(x=>x?.partnumber===sku);
 if(!p)return null;
 const current=affirmativeProductText(buyer?.last_message||"");
 const signals=modelSignals(current);
 const selectedText=[p.titulo||p.title,p.partnumber].filter(Boolean).join(" ");
 // A new named model may not use the previous model's photo, even when the
 // catalogue query accidentally returns a single old result.
 if([...signals].some(signal=>!containsTerm(selectedText,signal)))return null;
 const brand=norm(p.marca||p.brand);
 const seenBrands=[...new Set(catalog.map(x=>norm(x.marca||x.brand)).filter(Boolean))];
 const commonOtherBrands=["ulefone","samsung","epson","lenovo","brother","apple","asus","acer","dell","hp","logitech","xiaomi","motorola","canon","msi","jbl","microsoft","dji"];
 const possibleBrands=[...new Set([...seenBrands,...commonOtherBrands])];
 const namedBrands=possibleBrands.filter(x=>containsTerm(current,x));
 if(namedBrands.length>1||(namedBrands.length===1&&namedBrands[0]!==brand))return null;
 const fact=factsByPn?.[sku]?.product_image;
 if(!fact||!["manufacturer","reviewed_internal"].includes(fact.source_type))return null;
 const value=fact.value;
 if(!value||typeof value!=="object"||Array.isArray(value)||value.verified_sku!==sku)return null;
 const url=safePublicImageUrl(value.url,fact.source_url);
 if(!url)return null;
 return {
  url,partnumber:sku,
  caption:("Foto referencial del modelo: "+String(p.titulo||p.title||sku)).slice(0,180),
  sourceUrl:fact.source_url
 };
}
export function serializePhotoTurn(photo){
 if(!photo?.url||!safePublicImageUrl(photo.url,photo.sourceUrl))return null;
 return photo.caption+"\n[FOTO_VERIFICADA]("+photo.url+")";
}
export function productPhotoUnavailableReply(buyer){
 if(!buyer?.matched_partnumber)
  return "Claro, ¿de qué modelo quieres la foto?";
 return "Por ahora no tengo una foto verificada de ese modelo para enviarte.";
}
