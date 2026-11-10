/**
 * Product photos are intentionally an evidence-only feature.
 * Never let an LLM invent an image URL, select the only available picture,
 * or substitute a similar-looking product for the requested exact SKU.
 *
 * Sources: manufacturer/reviewed company facts in arm_product_facts.
 * Public HTTPS JPEG/PNG is required for WhatsApp Cloud API image-by-link.
 */
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
export function requestsProductPhoto(message){
 const s=norm(message);
 if(!s)return false;
 // Questions about camera quality or taking pictures are not photo requests.
 if(/\b(?:toma|saca|captura|hace|graba|calidad de)\s+(?:buenas?\s+)?(?:fotos?|imagenes?)\b/u.test(s)
    && !/\b(?:manda|pasa|envia|enviame|muestra|muestrame|ensena|quiero ver|tienes fotos|foto del equipo)\b/u.test(s))
  return false;
 if(/^(?:fotos?|fotitos?|imagen(?:es)?)(?:\s+(?:del?|de la|para|por favor))?\b/u.test(s))return true;
 return /\b(?:fotos?|fotitos?|fotografias?|imagenes?|imagen|fotito|fotos)\b/u.test(s)&&
    /\b(?:manda(?:me)?|pasame|pasa|envia(?:me)?|mandame|ense[nñ]a(?:me)?|muestra(?:me)?|quiero|puedo ver|tienes|tienen|necesito|ver|env[ií]a|mostra(?:me)?|compart[eí](?:me)?|mostrar)\b/u.test(s)
    || /\b(?:muestrame|mu[eé]strame|ensename|ens[eé]ñame)\s+(?:como (?:es|se ve)|el equipo|la laptop|el celular|el producto|el telefono)\b/u.test(s)
    || /\b(?:como se ve|quiero verlo|quiero verla|muestra el equipo)\b/u.test(s);
}
const hosts=new Set(["store.ulefone.com","www.s-tech.com.pe","s-tech.com.pe"]);
export function safePublicImageUrl(raw,sourceUrl){
 try{
  if(typeof raw!=="string"||typeof sourceUrl!=="string")return null;
  const url=new URL(raw),source=new URL(sourceUrl);
  if(url.protocol!=="https:"||source.protocol!=="https:"||
     !hosts.has(url.hostname.toLowerCase())||url.hostname.toLowerCase()!==source.hostname.toLowerCase()||
     url.username||url.password||url.port||url.hash||source.username||source.password||
     !/\.(?:jpg|jpeg|png)$/iu.test(url.pathname)||url.href.length>1100)
   return null;
  return url.href;
 }catch{return null;}
}
function explicitlyNamedProducts(message,catalog){
 const s=norm(message).replace(/[^a-z0-9]+/g," ").trim();
 const named=new Set();
 for(const p of catalog){
  const title=norm(p?.titulo||"");
  const ref=norm(p?.partnumber||"");
  // Require at least the model identifier in the latest turn. A generic
  // manufacturer mention must not count as an exact product selection.
  const candidates=[ref,...(title.match(/\b(?:armor\s+(?:x\d{1,2}\s*pro|x\d{1,2}|25t\s*pro|22|x13))\b/g)||[])];
  if(candidates.some(token=>{
   const needle=token.replace(/[^a-z0-9]+/g," ").trim();
   return needle.length>=5&&s.includes(needle);
  }))named.add(p.partnumber);
 }
 return named;
}
export function verifiedProductPhoto({buyer,catalog=[],factsByPn={}}={}){
 if(!Array.isArray(catalog))return null;
 const sku=buyer?.matched_partnumber;
 if(!sku||buyer?.customer_reference&&!buyer?.matched_partnumber)return null;
 const named=explicitlyNamedProducts(buyer?.last_message||"",catalog);
 if(named.size>1)return null; // multi-model request needs a gallery, not arbitrary last SKU
 const p=catalog.find(x=>x?.partnumber===sku);
 if(!p||named.size===1&&!named.has(sku))return null;
 const fact=factsByPn?.[sku]?.product_image;
 if(!fact||!["manufacturer","reviewed_internal"].includes(fact.source_type))return null;
 const value=fact.value;
 if(!value||typeof value!=="object"||Array.isArray(value)||value.verified_sku!==sku)return null;
 const url=safePublicImageUrl(value.url,fact.source_url);
 if(!url)return null;
 return {
  url,partnumber:sku,
  caption:("Foto referencial del modelo: "+String(p.titulo||sku)).slice(0,180),
  sourceUrl:fact.source_url
 };
}
export function productPhotoUnavailableReply(buyer){
 if(!buyer?.matched_partnumber)
  return "Claro, ¿de qué modelo quieres la foto?";
 return "Por ahora no tengo una foto verificada de ese modelo para enviarte.";
}
