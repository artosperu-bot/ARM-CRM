import {matchCustomerProduct} from "./catalog-matching.mjs";
import {polishCommercialReply} from "./commercial-voice.mjs";
import {humanHandoffUnconfirmedReply} from "./human-handoff-phrasing.mjs";
import {analyzeConversationTurn} from "./conversation-turn-plan.mjs";
import {assessCommercialReadiness} from "./commercial-readiness.mjs";
import {explicitlyMentionedCatalogProducts} from "./sales-draft-items.mjs";
import {asksFormalComplaintReplyDeadline,lawfulComplaintDeadlineReply,lawfulComplaintBookReply} from "./peru-consumer-knowledge.mjs";
/**
 * Final deterministic safety check for AI-generated commercial text.
 * No model is trusted to approve prices, discounts, promises or actions.
 * When ungrounded, replace the claim rather than "correcting" its amount.
 */
const normalizeComparison=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
 .toLowerCase().replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
function comparedCameraFacts(question,catalog){
 const q=" "+normalizeComparison(question)+" ";
 const matches=(Array.isArray(catalog)?catalog:[]).filter(p=>{
  const id=normalizeComparison((p.titulo||p.title||"")+" "+(p.partnumber||""));
  const signals=[...id.matchAll(/\b(?:[a-z]{2,20} \d{2,5}|[a-z]{1,12}\d{1,5})\b/gu)]
   .map(x=>x[0]).filter(x=>!/^\d+(?:gb|tb|mah|mp|w)$/u.test(x));
  return signals.some(token=>token.length>=3&&q.includes(" "+token+" "));
 }).slice(0,3);
 return matches.map(p=>{
  const specs=p.especificaciones_fabricante;
  const highlights=Array.isArray(specs?.highlights)?specs.highlights:[];
  const camera=highlights.filter(x=>/\b(?:c[aá]mara|visi[oó]n nocturna|megap[ií]xeles|\d+\s*mp)\b/iu.test(String(x))).slice(0,2);
  return camera.length?String(p.titulo||p.title||p.partnumber).slice(0,65)+": "+
    camera.map(x=>String(x).slice(0,65)).join(", "):null;
 }).filter(Boolean);
}
const number=(v)=>{
 const s=String(v||"").trim().replace(/\s/g,"");
 // S/ 1,799, S/ 1.799, S/ 1799, S/ 999.90
 if(/^\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?$/.test(s)){
  const sep=s.lastIndexOf(".")>s.lastIndexOf(",")?".":",";
  const bits=s.split(sep);
  if(bits.at(-1).length===2)return Number(bits.slice(0,-1).join("")+"."+bits.at(-1));
  return Number(s.replace(/[.,]/g,""));
 }
 const normalized=/^\d+(?:[.,]\d{2})?$/.test(s)?s.replace(",","."):null;
 return normalized===null?NaN:Number(normalized);
};
const moneyRe=/(?:\bS\/\.?\s*(\d[\d.,]*)|\b(?:PEN|SOLES?)\s*(\d[\d.,]*)|\b(\d[\d.,]*)\s*(?:SOLES?|PEN)\b|\b(?:US\$|USD|D[ÓO]LARES?)\s*(\d[\d.,]*)|\$(\d[\d.,]*))/giu;
const forbiddenActions=[
 /\b(?:ya\s+(?:te\s+|lo\s+|la\s+)?(?:he\s+)?|te\s+(?:he\s+)?)(?:agend[eé]|reserv[eé]|registr[eé]|envi[eé])(?=\s|[.,!?]|$)/iu,
 /\b(?:tu|su|el)\s+(?:pedido|cotizaci[oó]n|reserva|compra|cita)\s+(?:ya\s+)?(?:est[aá]|qued[oó])\s+(?:confirmad[ao]|registrad[ao]|reservad[ao]|agendad[ao]|enviad[ao])/iu,
 /\b(?:ya\s+qued[oó]|qued[oó]\s+list[oa])\s+(?:tu|su|el|la)\s+(?:pedido|reserva|cita|cotizaci[oó]n)\b/iu
];
const stockUnits=/\b(?:quedan|tenemos|hay|disponibles?|en stock|stock de)\s+\d{1,5}\s+(?:unidades|equipos|laptops?|celulares?|impresoras?|licencias?|monitores?|routers?|productos?|servicios?|accesorios?|sillas?)\b/iu;
const discount=/\b(?:descuento|rebaja|promoci[oó]n|off)\s+(?:de|del|hasta)?\s*\d{1,3}\s*%|\b\d{1,3}\s*%\s+de\s+(?:descuento|rebaja)/iu;
const deliveryPromise=/\b(?:te|le)\s+(?:llega|entregamos|enviamos)\s+(?:ma[ñn]ana|hoy)\b/iu;
const unconfirmedFutureReply=/\b(?:te\s+(?:aviso|respondo|confirmo|informo|escribo|digo)|te\s+(?:avisamos|respondemos|confirmamos)|(?:voy|vamos)\s+a\s+(?:avisarte|responderte|confirmarte|informarte))\b.{0,100}\b(?:apenas|en cuanto|cuando|validado|verificado|se confirme|se valide)|\b(?:en cuanto|apenas|cuando)\b.{0,100}\b(?:te\s+(?:aviso|respondo|confirmo|digo|informo)|me\s+comunico|te\s+escribo)\b/iu;
const unexecutedCheckPromise=/\b(?:lo|la)\s+dejo\s+(?:para\s+)?(?:verificaci[oó]n|revisi[oó]n|cotizaci[oó]n)|\b(?:primero|ahora)\s+(?:confirmamos|verificamos|revisamos)\s+(?:el|la|las|los)\s+(?:precio|stock|descuento|cotizaci[oó]n)\b/iu;
const fictitiousPendingWork=/\b(?:te\s+(?:lo|la)\s+dejo\s+list[ao]|(?:s[ií]\s+)?te\s+puedo\s+ayudar\s+a\s+dejarlo\s+list[ao]|(?:puedo\s+)?ayudarte\s+a\s+dejar\s+(?:la|una|tu)\s+consulta|(?:te\s+)?dejo\s+(?:el|la)\s+seguimiento)\b/iu;
const unconfirmedFutureAction=/\b(?:puedo|podr[ií]a|voy a|te puedo)\s+(?:(?:ayudar(?:te)?\s+a)\s+)?(?:dejar(?:te)?|registrar|derivar|enviar|coordinar|agendar)\b.{0,90}\b(?:inter[eé]s|pedido|cotizaci[oó]n|asesor|reserva|cita|solicitud|seguimiento|caso|list[oa]|registrad[oa])\b/iu;
const unconfirmedPaymentDirections=/\b(?:te\s+(?:indico|paso|env[ií]o|comparto|doy)|voy\s+a\s+(?:indicarte|enviarte|pasarte)|puedo\s+(?:enviarte|pasarte|compartirte))\s+(?:(?:el|la|los|las|un|una)\s+)?(?:enlace|link|canal|medio|datos|forma)\s+(?:de\s+)?pago\b/iu;
const phantomContactHandoff=/\b(?:te\s+(?:ayudo|puedo\s+ayudar)|puedo\s+ayudarte|podemos\s+ayudarte|si\s+quieres\s+te\s+ayudo)\s+a\s+(?:dejar|preparar|generar|enviar|registrar|coordinar)\b.{0,100}\b(?:contacto|inter[eé]s|solicitud|cotizaci[oó]n|pedido|asesor|seguimiento|list[ao])\b/iu;
const unconfirmedReadyWork=/\bdejar\s+list[oa]\s+(?:el|la|tu|su|un|una)\s+(?:seguimiento|pedido|cotizaci[oó]n|solicitud|caso|reclamo)\b/iu;
const deniedReadyWork=/\bno\s+(?:(?:puedo|podemos|se puede)\s+|voy\s+a\s+)dejar\s+list[oa]\s+(?:el|la|tu|su|un|una)\s+(?:seguimiento|pedido|cotizaci[oó]n|solicitud|caso|reclamo)\b/iu;
const promisedCommercialCheck=/\b(?:puedo|podemos|voy a|te puedo|si quieres puedo)\s+(?:ayudarte\s+a\s+)?(?:verificar|consultar|revisar|confirmar|cotizar|validar)\s+(?:el|la|las|los|un|una|tu|su)?\s*(?:cotizaci[oó]n|precio|compra|pedido|stock|disponibilidad|env[ií]o|entrega|compatibilidad|modelo|referencia|ficha\s+t[eé]cnica|producto)\b/iu;
const unprovenAffordability=/\b(?:encaj[a-záéíóú]*|cabe[n]?|entr[a-záéíóú]*|alcanz[a-záéíóú]*|ajust[a-záéíóú]*|est[aá][a-z]* dentro)\b.{0,100}\b(?:presupuesto|monto|inversi[oó]n)\b|\b(?:presupuesto|monto|inversi[oó]n)\b.{0,100}\b(?:encaj[a-záéíóú]*|cabe[n]?|entr[a-záéíóú]*|alcanz[a-záéíóú]*|ajust[a-záéíóú]*)\b/iu;
const affordabilityCaveat=/\b(?:no puedo|no podemos|no se puede|sin verificar|no est[aá] verificado|falta confirmar|hay que confirmar|no sabemos|no puedo asegurar|no es seguro)\b/iu;
const unfinishedQuotePromise=/\b(?:puedo|podemos|voy a|te puedo)\s+(?:ayudarte\s+a\s+)?(?:dejar|preparar|tener)\b.{0,60}\b(?:list[ao]|cotizaci[oó]n|reserva|pedido|proforma)\b/iu;
const redundantIdentifierRequest=/\b(?:(?:si\s+)?(?:me\s+)?(?:confirmas|confirmes|conf[ií]rmame|ind[ií]came|compartes|compartas|env[ií]as|env[ií]ame|mandas|m[aá]ndame|pasas|p[aá]same)|me\s+puedes\s+(?:confirmar|compartir|enviar)|me\s+podr[ií]as\s+confirmar)\s+(?:(?:la|el|tu|su|un|una)\s+)?(?:referencia\s+(?:completa|exacta)|c[oó]digo\s+(?:completo|exacto)|modelo\s+(?:completo|exacto)|n[uú]mero\s+de\s+modelo)\b/iu;
const phantomPreparation=/\b(?:puedo|podemos|podr[ií]a|voy\s+a|te\s+puedo)\s+(?:ayudarte\s+a\s+)?(?:preparar|armar|dejar\s+list[ao]|registrar|generar)\s+(?:la|las|el|los|una|un|tu|su)?\s*(?:referencia|detalle|resumen|solicitud|pedido|cotizaci[oó]n|proforma)\b/iu;
const unexecutedHandoff=/\b(?:dejar|dejamos|dejo|registrar|registro|preparar|preparo|tener)\b.{0,95}\b(?:referencia|inter[eé]s|datos|solicitud|contacto|pedido|cotizaci[oó]n)\b.{0,80}\b(?:list[ao]|asesor|revisar|confirme|seguimiento|registrad[ao])\b|\b(?:referencia|inter[eé]s|solicitud|contacto)\b.{0,60}\b(?:list[ao]|registrad[ao])\b.{0,55}\b(?:asesor|seguimiento|revisar)\b/iu;
const unsupportedOrderStatusPromise=/\b(?:te (?:indico|confirmo|digo)|voy a (?:decirte|indicarte|consultar)|lo (?:revisamos|ubico|consulto)|te puedo (?:indicar|confirmar))\b.{0,85}\b(?:estado (?:exacto|real)|(?:de )?(?:tu|el) pedido|donde va|enviado|despacho)\b/iu;
const prematureCustomerDetails=/\b(?:me\s+falta(?:n)?|necesito|requiero|env[ií]ame|p[aá]same|ind[ií]came|dame|comp[aá]rteme|debes\s+(?:darme|enviarme))\b.{0,55}\b(?:tu\s+)?(?:nombre|apellido|celular|tel[eé]fono|correo|direcci[oó]n|dni|ruc)\b/iu;
const unexecutedSupportOffer=/\b(?:puedo|podemos|voy\s+a|te\s+puedo)\s+(?:ayudar(?:te)?\s+a\s+)?(?:abrir|crear|registrar|dejar|enviar|derivar|escalar|levantar)\b.{0,100}\b(?:reclamo|ticket|caso|garant[ií]a|devoluci[oó]n|soporte|servicio\s+t[eé]cnico)\b/iu;
const explicitlyNegatedOffer=/\b(?:no\s+(?:puedo|podemos|voy\s+a|te\s+puedo)|tampoco\s+(?:puedo|podemos))\s+(?:ayudar(?:te)?\s+a\s+)?(?:abrir|crear|registrar|dejar|enviar|derivar|escalar|levantar)\b/iu;
const unsupportedSupportClaim=/\b(?:ya\s+(?:te\s+)?(?:abr[ií]|cre[eé]|registr[eé]|ingres[eé]|levant[eé]|notifiqu[eé]|asign[eé])(?=\s|[,.!?]|$).{0,65}\b(?:reclamo|ticket|caso|asesor|devoluci[oó]n)|(?:tu|su|el)\s+(?:reclamo|ticket|caso|devoluci[oó]n)\s+(?:ya\s+)?(?:est[aá]|qued[oó])\s+(?:abiert[oa]|registrad[oa]|aprobad[oa])\b)/iu;
const unsupportedBillingClaim=/\b(?:s[ií][,.:]?\s*(?:emitimos|aceptamos|puedes pagar)|(?:emitimos|entregamos|te damos)\s+(?:factura|boleta)|(?:aceptamos|recibimos)\s+(?:pago\s+con\s+)?(?:tarjeta|visa|mastercard|yape|plin)|puedes pagar con (?:tarjeta|visa|mastercard|yape|plin))\b/iu;
const unsupportedRefundClaim=/\b(?:te\s+(?:la|lo)\s+cambiamos|cambio inmediato (?:aprobado|asegurado|garantizado)|(?:ya\s+)?(?:aprobamos|aprobada)\s+(?:la|tu)\s+devoluci[oó]n|te\s+devolvemos\s+(?:el|tu)\s+dinero|reembolso\s+(?:aprobado|garantizado))\b/iu;
const unsupportedWarrantyDuration=/\b(?:tenemos|tiene|incluye|cuenta con|ofrecemos|te damos)\s+(?:una?\s+)?(?:garant[ií]a\s+(?:de\s+)?)?\d+\s*(?:meses?|a[ñn]os?)\s+(?:de\s+)?garant[ií]a\b|\b(?:garant[ií]a\s+(?:de\s+)?\d+\s*(?:meses?|a[ñn]os?))\b/iu;
const prematureDataRequest=/(?:\b(?:p[aá]same|dame|env[ií]ame|ind[ií]came|necesito|comp[aá]rteme|comparte|compartes|cu[aá]l es)\s+(?:tu|su)\s+(?:nombre|apellido|tel[eé]fono|celular|direcci[oó]n|ruc|dni|correo|tarjeta)\b|\b(?:tu|su)\s+(?:nombre\s+(?:y|completo)|direcci[oó]n|ruc|dni)\s+(?:para\s+(?:hacer|registrar|confirmar)))/iu;
/** Don't volunteer inventory status when buyer only asked about product benefits.
 * For explicit availability questions the original reply remains untouched.
 */
export function withoutUnsolicitedStockAside(reply,buyer){
 const text=String(reply||"");
 const prompt=String(buyer?.last_message||"");
 if(["disponibilidad","entrega","comprar"].includes(buyer?.current_intent)||
   /\b(?:stock|disponib|hay unidades|tienen unidades|entrega inmediata|hay para hoy)\b/iu.test(prompt))
  return text;
 const clean=text.replace(/\b(?:la disponibilidad (?:est[aá]|queda|se encuentra) (?:por confirmar|pendiente de confirmaci[oó]n)|(?:el )?stock (?:est[aá]|queda) por confirmar|no (?:puedo|podemos) confirmar (?:stock|disponibilidad)|(?:s[ií],?\s+)?(?:tenemos|hay) (?:stock|disponibilidad)(?: disponible)?)\b[.;,]?\s*/giu,"");
 return clean.replace(/\s{2,}/g," ").replace(/\.\s*\./g,".").trim()||text;
}
export function protectSalesResponse(reply,{catalog=[],buyer=null,simulated=false}={}){
 const text=typeof reply==="string"?reply.trim():"";
 if(!text)return {reply:"Puedo ayudarte con tu consulta. ¿Qué producto necesitas?",blocked:true,reason:"empty"};
 const intent=buyer?.current_intent||"consulta";
 const turnPlan=analyzeConversationTurn(buyer,catalog);
 if(buyer?.requires_human){
  return {reply:humanHandoffUnconfirmedReply(buyer),blocked:true,reason:"human_requested"};
 }
 if(buyer?.current_topic==="plazo_reclamo"&&asksFormalComplaintReplyDeadline(buyer?.last_message))
  return {reply:lawfulComplaintDeadlineReply,blocked:true,reason:"official_complaint_reply_deadline"};
 if(buyer?.current_topic==="libro_reclamaciones")
  return {reply:lawfulComplaintBookReply,blocked:true,reason:"official_complaint_book_access"};
 if(/\bno quiero (?:dar|compartir) (?:mi )?(?:dni|ruc|tel[eé]fono|n[uú]mero)\b/iu.test(buyer?.last_message||""))
   return {reply:"Sí, puedes consultar productos y recibir orientación sin dar tu DNI ni otros datos personales.",blocked:true,reason:"privacy_preference"};

 if(buyer?.draft_ambiguous===true&&Array.isArray(buyer?.draft_items)&&
   buyer.draft_items.length>1&&["comercial","facturacion_pago"].includes(buyer?.current_topic||"comercial")){
  const options=buyer.draft_items.slice(0,5).map(x=>String(x.partnumber).slice(0,80)).join(" o ");
  return {reply:"¿A cuál producto te refieres: "+options+
   "? Mantengo la lista anterior sin cambios hasta que me indiques cuál.",
   blocked:true,reason:"ambiguous_draft_quantity"};
 }
 const buyerText=String(buyer?.last_message||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 const askedAll=/(?:\b(?:cuanto(?: me)? (?:sale|cuesta|salen|saldria)|calcula|dame|pasame|precio|cotiza\w*)\b.{0,60}\b(?:total|todo|todos|los dos|ambos)\b|\b(?:total|todo)\b.{0,35}\b(?:cuanto|precio|cotiza\w*)\b|\b(?:y\s+)?el\s+total\b|^(?:y\s+)?(?:el\s+)?total\s*\??$)/u.test(buyerText);
 // Deterministic private calculation: the AI is not allowed to invent a
 // basket total. This does not create anything in Supabase or checkout.
 if(simulated&&askedAll&&["comercial","facturacion_pago"].includes(buyer?.current_topic)&&
   !buyer?.cancelled_purchase&&Array.isArray(buyer?.draft_items)&&buyer.draft_items.length>1){
  const basket=assessCommercialReadiness(buyer,{catalog,simulated:true}).demoBasket;
  if(basket?.lines?.length>1){
   const lineText=basket.lines.map(line=>{
    const name=String(line.title||line.partnumber).slice(0,90);
    const cost=line.subtotalPen===null?"importe pendiente":"S/ "+line.subtotalPen.toFixed(2);
    const state=line.availability==="disponible"?"disponible en prueba":
      line.availability==="no disponible"?"no disponible para esta cantidad":"disponibilidad por confirmar";
    return line.quantity+" × "+name+": "+cost+" ("+state+")";
   }).join("; ");
   const total=basket.totalPen===null?
    "No puedo calcular un total porque falta verificar al menos un precio.":
    "Total matemático de prueba: S/ "+basket.totalPen.toFixed(2)+".";
   const additional=turnPlan.asksDelivery?" La fecha de entrega no está confirmada.":"";
   const billing=buyerText.match(/\b(?:yape|plin|tarjeta|visa|pago)\b/u)?
    " Los medios de pago deben confirmarse.":"";
   const discount=turnPlan.asksDiscount?" No hay descuento aprobado.":"";
   return {reply:"Simulación: "+lineText+". "+total+additional+billing+discount+
    " No es cotización, reserva, pedido ni pago registrado.",
    blocked:true,reason:"demo_basket_calculated"};
  }
 }
 // For an explicit quantity revision, independently summarize each SKU.
 // This also protects against a nearly blank AI reply and false promises that
 // a six-unit line is ready when pilot stock can only support five.
 if(simulated&&!buyer?.draft_ambiguous&&
   (buyer?.draft_items||[]).length>1&&
   /\b(?:mejor|sube|aumenta|corrige|dejalo|dejala|dejamos)\b/u.test(buyerText)&&
   /\b(?:\d{1,3}|dos|tres|cuatro|cinco|seis)\b/u.test(buyerText)){
  const details=buyer.draft_items.map(item=>{
   const product=(Array.isArray(catalog)?catalog:[]).find(x=>x.partnumber===item.partnumber);
   return {quantity:item.quantity,name:String(product?.titulo||product?.title||item.partnumber),
    available:product?.disponibilidad==="disponible"};
  });
  const desc=details.map(x=>x.quantity+" × "+x.name).join("; ");
  const short=details.filter(x=>!x.available);
  const note=short.length?" Para la cantidad indicada, falta disponibilidad de: "+
   short.map(x=>x.name).join(", ")+".":"";
  return {reply:"Simulación: queda anotado el interés por "+desc+"."+note+
    " No es pedido ni reserva.",blocked:true,reason:"demo_draft_revision"};
 }
 const askedCommercialPrice=turnPlan.asksPrice||["consultar_precio","cotizar","comparar","objecion","comprar"].includes(intent);
 const available=(Array.isArray(catalog)?catalog:[]).filter(p=>p?.precio_soles!==null&&
   p?.precio_soles!==undefined&&Number.isFinite(Number(p.precio_soles))&&Number(p.precio_soles)>0);
 const mentionedSkuList=turnPlan.asksPrice?
   explicitlyMentionedCatalogProducts(buyer?.last_message,catalog):[];
 const multiPricesRequested=simulated&&mentionedSkuList.length>=2&&
   ["comercial","facturacion_pago"].includes(buyer?.current_topic||"comercial");
 const multiProductPrices=new Map(multiPricesRequested?
   mentionedSkuList.map(pn=>{
    const item=available.find(x=>x.partnumber===pn&&x.oferta_simulada===true);
    return [pn,item?Number(item.precio_soles):null];
   }):[]);
 const replyProduct=matchCustomerProduct(text,catalog);
 // A new, unverified customer reference outranks an old matched SKU, the AI's
 // proposed product and any sole priced catalogue item. Never transfer a price.
 const unverifiedReference=Boolean(buyer?.customer_reference&&!buyer?.matched_partnumber);
 const unverifiedBrand=Boolean(buyer?.brand&&!buyer?.matched_partnumber&&
   !available.some(p=>String(p.marca||p.brand||"").toUpperCase()===
     String(buyer.brand).toUpperCase()));
 const intendedPn=(unverifiedReference||unverifiedBrand)?null:
   buyer?.matched_partnumber||replyProduct?.partnumber||
   (available.length===1?available[0].partnumber:null);
 const pricedItems=intendedPn?available.filter(p=>p.partnumber===intendedPn):[];
 const priceValues=new Set(pricedItems.map(p=>Number(p.precio_soles)));
 if(multiPricesRequested)for(const value of multiProductPrices.values()){
  if(value!==null)priceValues.add(value);
 }
 const wrongProduct=Boolean(buyer?.matched_partnumber&&replyProduct?.partnumber&&
   buyer.matched_partnumber!==replyProduct.partnumber&&moneyRe.test(text));
 moneyRe.lastIndex=0;
 const budget=Number(buyer?.budget?.pen);
 let moneyViolation=false;
 for(const match of text.matchAll(moneyRe)){
  const amount=match.slice(1).find(x=>x!==undefined);
  const value=number(String(amount||"").replace(/[.,]+$/u,""));
  const isUsd=Boolean(match[4]||match[5]);
  const window=text.slice(Math.max(0,match.index-90),match.index).toLowerCase();
  const isRestatedBudget=Number.isFinite(budget)&&budget===value&&
    /\b(?:tu|su|el|un|de|con|presupuesto|monto|m[aá]ximo|inversi[oó]n)\b.{0,40}\b(?:presupuesto|monto|l[ií]mite|inversi[oó]n)\b|\bpresupuesto.{0,50}$/iu.test(window);
  const approvedPrice=!isUsd&&askedCommercialPrice&&priceValues.has(value);
  if(!approvedPrice&&!(isRestatedBudget&&!isUsd)){moneyViolation=true;break;}
 }
 if(multiPricesRequested){
  const mapped=new Set();
  let valid=true;
  const stated=[...text.matchAll(moneyRe)];
  moneyRe.lastIndex=0;
  for(const match of stated){
   const preceding=text.slice(Math.max(0,(match.index||0)-115),match.index||0);
   const nearby=explicitlyMentionedCatalogProducts(preceding,catalog).at(-1);
   const amount=number(String(match.slice(1).find(v=>v!==undefined)||"").replace(/[.,]+$/u,""));
   if(!nearby||!multiProductPrices.has(nearby)||multiProductPrices.get(nearby)!==amount){
    valid=false;break;
   }
   mapped.add(nearby);
  }
  if(!valid||!mentionedSkuList.every(sku=>
   multiProductPrices.get(sku)===null||mapped.has(sku))){
   const descriptions=mentionedSkuList.slice(0,5).map(sku=>{
    const product=(Array.isArray(catalog)?catalog:[]).find(p=>p.partnumber===sku);
    const amount=multiProductPrices.get(sku);
    return String(product?.titulo||product?.title||sku).slice(0,90)+": "+
     (amount===null?"precio por confirmar":"S/ "+amount.toFixed(2));
   });
   return {reply:"Precios del piloto (simulados): "+descriptions.join("; ")+
    ". Esto no es una cotización emitida ni un pedido. Para comparar otras características, usaré solo datos de las fichas verificadas.",
    blocked:true,reason:"multi_price_fact_correction"};
  }
 }
 const unsupportedPolicyClaim=unsupportedSupportClaim.test(text)||(unexecutedSupportOffer.test(text)&&!explicitlyNegatedOffer.test(text))||
   (buyer?.current_topic==="facturacion_pago"&&unsupportedBillingClaim.test(text))||
   (buyer?.current_topic==="devolucion_reclamo"&&unsupportedRefundClaim.test(text))||
   (buyer?.current_topic==="garantia"&&unsupportedWarrantyDuration.test(text));
 const actionViolation=(unconfirmedReadyWork.test(text)&&!deniedReadyWork.test(text))||fictitiousPendingWork.test(text)||unconfirmedFutureReply.test(text)||unexecutedCheckPromise.test(text)||unsupportedPolicyClaim||(buyer?.current_topic==="pedido_existente"&&unsupportedOrderStatusPromise.test(text))||forbiddenActions.some(x=>x.test(text))||unconfirmedFutureAction.test(text)||promisedCommercialCheck.test(text)||unfinishedQuotePromise.test(text)||phantomPreparation.test(text)||phantomContactHandoff.test(text)||unconfirmedPaymentDirections.test(text)||unexecutedHandoff.test(text);
 // When selling an accessory, asking for the laptop/tablet/host model is
 // valid compatibility discovery even though the accessory SKU is known.
 const hostRequest=text.match(/\b(?:modelo|referencia)\s+(?:exact[oa]|complet[oa])\s+de\s+(?:tu|su|la|el)\s+(laptop|computadora|celular|tel[eé]fono|tablet|impresora|monitor|router|equipo)\b/iu);
 const selectedProduct=(Array.isArray(catalog)?catalog:[]).find(x=>x?.partnumber===buyer?.matched_partnumber);
 const selectedTitle=String(selectedProduct?.titulo||selectedProduct?.title||"").toLowerCase();
 const askingHostModel=buyer?.current_intent==="compatibilidad"&&!buyer?.customer_reference&&hostRequest&&
   !selectedTitle.includes(hostRequest[1].toLowerCase());
 const repeatedModelRequest=Boolean((buyer?.customer_reference||buyer?.matched_partnumber)&&
    redundantIdentifierRequest.test(text)&&!askingHostModel);
 const stockViolation=stockUnits.test(text);
 const discountViolation=discount.test(text);
 const deliveryViolation=deliveryPromise.test(text);
 const prematureDataViolation=buyer?.current_intent==="comprar"&&(prematureDataRequest.test(text)||prematureCustomerDetails.test(text));
 const affordabilityViolation=unprovenAffordability.test(text)&&!affordabilityCaveat.test(text);
 // A compound price + availability request cannot be answered with price only.
 // Also distinguish confirmed zero/insufficient stock from truly unknown stock.
 // Only use the exact SKU and evidence already authorized in this conversation.
 const selectedForStock=buyer?.matched_partnumber?
   (Array.isArray(catalog)?catalog:[]).find(x=>x?.partnumber===buyer.matched_partnumber):null;
 const status=selectedForStock?.disponibilidad;
 const saleQuestion=turnPlan.asksStock &&
   !["soporte","handoff","cierre","decision"].includes(turnPlan.focus)&&
   ["comercial","facturacion_pago"].includes(buyer?.current_topic||"comercial")&&
   selectedForStock&&["disponible","no disponible","por confirmar"].includes(status);
 if(saleQuestion){
   const normalized=text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
   const saysNo=/\b(?:no disponible|no esta disponible|sin stock|agotad[oa]s?|no hay (?:stock|disponibilidad|para)|no tenemos (?:stock|disponibilidad)|no alcanzan? las unidades)\b/u.test(normalized);
   const saysUnknown=/\b(?:por confirmar|sin confirmar|falta confirmar|pendiente de confirmar|no (?:puedo|podemos) (?:asegurar|confirmar))\b/u.test(normalized);
   const saysYes=/\b(?:esta disponible|estan disponibles|figura disponible|disponibilidad\s*:?\s*disponible|estan disponibles|tenemos disponible|hay stock|tenemos stock|si hay|si tenemos|disponibilidad confirmada)\b/u.test(normalized);
   const consistentStock=status==="no disponible"?saysNo&&!saysYes:
     status==="por confirmar"?saysUnknown&&!saysYes:
     saysYes&&!saysNo;
   const price=Number(selectedForStock.precio_soles);
   const priceKnown=selectedForStock.precio_soles!==null&&
      selectedForStock.precio_soles!==undefined&&Number.isFinite(price)&&price>0;
   const priceWasAsked=turnPlan.asksPrice;
   const pricesInReply=[...text.matchAll(moneyRe)]
     .map(m=>number(String(m.slice(1).find(x=>x!==undefined)||"")));
   moneyRe.lastIndex=0;
   const hasCorrectPrice=pricesInReply.some(x=>x===price);
   const needsCorrection=!consistentStock||(buyer?.current_topic==="facturacion_pago"&&unsupportedBillingClaim.test(text))||
      (priceWasAsked&&priceKnown&&!hasCorrectPrice)||
      (priceWasAsked&&!priceKnown&&pricesInReply.length>0);
   if(needsCorrection){
     const label=String(selectedForStock.titulo||selectedForStock.title||"ese modelo").slice(0,110);
     const quantity=Number.isInteger(buyer?.quantity)&&buyer.quantity>0?
       " para las "+buyer.quantity+" unidades solicitadas":"";
     const availability=status==="no disponible"?
       "no está disponible"+quantity:
       status==="disponible"?"está disponible"+quantity:
       "tiene disponibilidad por confirmar"+quantity;
     const summary=priceWasAsked?(priceKnown?
       " Su precio "+(simulated?"simulado":"verificado")+" es S/ "+price.toFixed(2)+".":
       " Su precio está por confirmar."):"";
     return {reply:(simulated?"En esta simulación, ":"")+label+" "+availability+"."+summary+
       (buyer?.current_topic==="facturacion_pago"?" El medio de pago solicitado aún no está confirmado.":"")+
       (simulated?" No se ha generado un pedido ni una cotización.":""),
       blocked:true,reason:"availability_fact_correction"};
   }
 }
 // Rankings of camera/photo quality require comparable evidence, not just
 // one model's megapixels or a generic night-vision marketing claim.
 const buyerCamera=/\b(?:camara|fotos?|video)\b/u.test(normalizeComparison(buyer?.last_message));
 const responseNormalized=normalizeComparison(text);
 const assertedCameraRanking=/(?:\b(?:mejor|superior|ventaja|mas complet[oa]|mas fuerte|gana)\b.{0,110}\b(?:camara|fotos?|video)\b|\b(?:camara|fotos?|video)\b.{0,110}\b(?:mejor|superior|ventaja|mas complet[oa]|mas fuerte)\b)/u.test(responseNormalized)&&
   !/\b(?:no puedo asegurar|no podemos asegurar|no hay pruebas|sin pruebas|no puedo afirmar|no se puede afirmar)\b/u.test(responseNormalized);
 const comparedFacts=buyerCamera&&(intent==="comparar"||turnPlan.asksComparison)?
   comparedCameraFacts(buyer?.last_message,catalog):[];
 if(buyerCamera&&comparedFacts.length>=2&&assertedCameraRanking){
  return {reply:"No tengo una prueba comparativa que permita asegurar cuál toma mejores fotos. "+
   "Las fichas verificadas indican: "+comparedFacts.slice(0,2).join("; ")+
   ". La calidad real de imagen requiere una comparación equivalente.",
   blocked:true,reason:"unverified_camera_ranking"};
 }
 if(!wrongProduct&&!moneyViolation&&!actionViolation&&!stockViolation&&!discountViolation&&!deliveryViolation&&!prematureDataViolation&&!repeatedModelRequest&&!affordabilityViolation){
  // Earlier guards preserve specific denial reasons for invented payments,
  // quotes, discounts, delivery promises and repeated customer questions.
  // Otherwise unanswered price/stock queries get a factual direct response.
  const selected=buyer?.matched_partnumber?
    (Array.isArray(catalog)?catalog:[]).find(p=>p?.partnumber===buyer.matched_partnumber):null;
  const qty=buyer?.quantity&&Number.isInteger(buyer.quantity)?
    (buyer.quantity===1?"esa unidad":"las "+buyer.quantity+" unidades"):"ese producto";
  const priced=Boolean(
   (selected&&available.some(p=>p.partnumber===selected.partnumber))||
   // Sandbox prices are synthetic: a single priced test product remains valid
   // without a stored buyer SKU. Never relax this condition for real sales.
   (multiPricesRequested&&mentionedSkuList.every(sku=>multiProductPrices.get(sku)!==null))||
   (simulated&&((replyProduct&&available.some(p=>p.partnumber===replyProduct.partnumber))||
     available.length===1))
  );
  if((intent==="consultar_precio"||intent==="cotizar")&&!priced)
   return {reply:intent==="cotizar"?
    "Para cotizar "+qty+" todavía falta un precio vigente. No hay una cotización emitida desde este chat.":
    "El precio de "+qty+" está por confirmar. Aún no tengo un monto vigente para darte.",
    blocked:true,reason:"unverified_price"};
  if(intent==="disponibilidad"&&selected?.disponibilidad==="no disponible")
   return {reply:"Ese modelo no está disponible para la cantidad solicitada. Todavía no se ha registrado ningún pedido.",blocked:true,reason:"unavailable_stock"};
  if(intent==="disponibilidad"&&selected?.disponibilidad!=="disponible")
   return {reply:"La disponibilidad de ese modelo está por confirmar. Por ahora no puedo asegurarte stock para entrega.",blocked:true,reason:"unverified_availability"};
  // A safe, natural objection response must not be overwritten just because the buyer asked for a discount.
  // The deterministic discountViolation and moneyViolation checks above still block invented offers.
 // No checkout tool is wired into either the private CRM chat or WhatsApp
 // sandbox. A buying signal means the customer wants to proceed, NOT that an
 // order, payment link, reservation or handoff was created.
 // A purchase decision is an actionable lead, not an executed sale. Always
 // summarize every independent SKU/quantity instead of using a global count.
 // Run before generic model-response checks that can erase the buying intent.
 if(intent==="comprar"){
  const lines=(Array.isArray(buyer?.draft_items)?buyer.draft_items:[])
   .map(it=>{
    const p=(Array.isArray(catalog)?catalog:[]).find(x=>x.partnumber===it.partnumber);
    return {qty:it.quantity,name:String(p?.titulo||p?.title||it.partnumber).slice(0,95),
      available:p?.disponibilidad==="disponible"};
   });
  const single=(Array.isArray(catalog)?catalog:[]).find(x=>x.partnumber===buyer?.matched_partnumber);
  const description=lines.length?
    lines.map(x=>x.qty+" × "+x.name).join("; "):
    single?String(single.titulo||single.title||single.partnumber).slice(0,100):null;
  const shortfall=lines.some(x=>!x.available);
  const opening=description?"Entiendo que quieres comprar: "+description+". ":
    "Entiendo que quieres continuar con la compra. ";
  const next=shortfall?
    "Hay al menos un artículo cuya disponibilidad para esa cantidad requiere revisión. ":
    "El siguiente paso es validar los datos comerciales vigentes con STECH. ";
  return {reply:lines.length>1?
    (simulated?"Simulación: ":"")+opening+next+
      "Aún no se ha creado un pedido, reserva, cotización ni pago. "+
      "Antes de concretar la compra se deben confirmar precio, stock y condiciones de entrega.":
    (simulated?"Simulación: ":"")+opening+
      "Todavía no puedo crear un pedido ni un enlace de pago desde este chat. "+
      "Antes hay que confirmar precio, disponibilidad y condiciones vigentes con STECH.",
    blocked:true,reason:lines.length>1?"purchase_interest_no_checkout":"purchase_not_ready"};
 }
  return {reply:polishCommercialReply(withoutUnsolicitedStockAside(text,buyer),buyer),blocked:false,reason:null};
 }
 const reason=wrongProduct?"product_mismatch":repeatedModelRequest?"redundant_model_question":moneyViolation?"unverified_price":affordabilityViolation?"unverified_affordability":actionViolation?"unconfirmed_action":
   stockViolation?"exact_stock":discountViolation?"unapproved_discount":prematureDataViolation?"premature_personal_data":"delivery_promise";
 const quantity=Number.isInteger(buyer?.quantity)&&buyer.quantity>0?buyer.quantity:null;
 const qtyLabel=quantity?quantity+" unidad"+(quantity===1?"":"es"):"la cantidad solicitada";
 const fallback={
  product_mismatch:intent==="objecion"?"Entiendo que busques un mejor precio. No tengo un descuento aprobado que pueda confirmarte; tampoco mezclaré ofertas de modelos distintos.":"Necesito verificar el modelo exacto antes de darte un precio; no quiero mezclar productos diferentes.",
  redundant_model_question:"Ya tengo el modelo que indicaste. No necesitas repetirlo. Aún no dispongo de una ficha o precio vigente verificado de esa referencia.",
  unverified_affordability:intent==="cotizar"?"Entiendo que solicitas una cotización por "+qtyLabel+". No dispongo de precios vigentes verificados para calcularla y todavía no se ha generado ningún documento.":buyer?.budget?"Tengo presente el presupuesto indicado, pero sin precios confirmados no es posible asegurar que los productos se ajusten al monto.":"No sería correcto asegurar que una compra encaja en un presupuesto sin precios y condiciones comerciales confirmados.",
  premature_personal_data:"Ya tengo el producto que elegiste. Para comprarlo falta confirmar el precio y la disponibilidad vigente. Todavía no hay un pedido registrado ni es necesario que me envíes datos personales por aquí.",
  unverified_price:intent==="objecion"?"Entiendo que busques un mejor precio. No tengo un descuento aprobado para ese modelo y no mezclaré ofertas de otros productos.":intent==="cotizar"?"Tengo registrada tu solicitud por "+qtyLabel+", pero faltan precios vigentes verificados para emitir una cotización. No hay un documento generado.":intent==="consulta"?"Tengo presente tu consulta y sus requisitos. Sin precios verificados no puedo asegurar importes ni que los equipos entren en el presupuesto.":"No dispongo de un precio vigente verificado para ese modelo. Prefiero no darte una cifra que pueda ser incorrecta.",
  unconfirmed_action:intent==="disponibilidad"?"La disponibilidad de ese modelo está por confirmar; por ahora no puedo asegurarte stock para entrega.":intent==="objecion"?"Entiendo que buscas un mejor precio por "+qtyLabel+". Por ahora no tengo un descuento confirmado para ofrecerte.":buyer?.current_topic==="pedido_existente"?"No tengo acceso para confirmar el estado de tu pedido desde aquí. Eso necesita revisarlo una persona con acceso al sistema; todavía no hay una consulta registrada por este chat.":buyer?.current_topic==="estado_derivacion"?"Aún no tengo confirmación de que un asesor haya recibido la conversación.":buyer?.current_topic==="soporte_tecnico"?"Entiendo el problema con el equipo. Puedes comprobar si muestra algún mensaje de error y revisar las opciones de diagnóstico del fabricante. Si la falla continúa, requiere evaluación técnica; no se ha creado un caso desde este chat.":buyer?.current_topic==="facturacion_pago"?"Sobre la factura electrónica y el pago con tarjeta: todavía no tengo confirmadas esas condiciones comerciales de STECH, así que prefiero no asegurarte algo incorrecto.":buyer?.current_topic==="estado_reclamo"?"No tengo confirmación de que se haya abierto un reclamo o ticket. Eso necesita comprobarse en el sistema de atención; no hay una gestión registrada por este chat.":buyer?.current_topic==="devolucion_reclamo"?"Entiendo que necesitas resolver lo ocurrido con el equipo. No tengo confirmación de un cambio o devolución aprobados; eso requiere revisión del caso y de las condiciones de compra.":buyer?.current_topic==="garantia"?"Para darte una respuesta correcta sobre la garantía, falta comprobar la cobertura y el plazo específico de ese producto.":intent==="comprar"?"Para avanzar con la compra, falta confirmar precio y disponibilidad del producto elegido. Todavía no hay un pedido ni un pago registrado desde este chat.":intent==="cotizar"?"Entiendo que necesitas una cotización por "+qtyLabel+". Todavía no hay precios vigentes confirmados y no se ha generado ninguna cotización.":intent==="consultar_precio"?"No dispongo de un precio vigente confirmado para ese modelo. No sería correcto inventar el importe.":intent==="entrega"?"No hay una fecha de entrega confirmada para ofrecerte todavía. La disponibilidad y el despacho requieren verificación.":"Lo solicitado requiere información o una acción comercial que todavía no está confirmada. No afirmaré que se haya realizado.",
  exact_stock:"La disponibilidad para venta está por confirmar. Puedo ayudarte a revisar qué producto se ajusta mejor a tu necesidad.",
  unapproved_discount:"No tengo un descuento aprobado para confirmarte. Puedo ayudarte a comparar opciones y preparar una consulta comercial.",
  delivery_promise:"Para confirmarte una fecha de entrega primero hay que verificar disponibilidad y condiciones de despacho."
 }[reason];
 return {reply:fallback,blocked:true,reason};
}
/** Remove claims about exact units of warehouse stock without changing
 * legitimate customer quantities like "necesito 3 equipos". */
export function hideExactStockUnits(reply){
 return String(reply||"")
  .replace(/\b(?:tenemos|quedan|hay)\s+\d{1,6}\s+(?:unidades|equipos|laptops?|celulares?|impresoras?)\s*(?:en stock|disponibles?)?/giu,
    "La disponibilidad está por confirmar")
  .replace(/\b(?:stock de|en stock:?)\s*\d{1,6}\s*(?:unidades|equipos|laptops?|celulares?|impresoras?)?/giu,
    "disponibilidad por confirmar");
}
