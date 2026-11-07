import {matchCustomerProduct} from "./catalog-matching.mjs";
/**
 * Final deterministic safety check for AI-generated commercial text.
 * No model is trusted to approve prices, discounts, promises or actions.
 * When ungrounded, replace the claim rather than "correcting" its amount.
 */
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
const unconfirmedFutureAction=/\b(?:puedo|podr[ií]a|voy a|te puedo)\s+(?:dejar|registrar|derivar|enviar|coordinar|agendar)\b.{0,90}\b(?:inter[eé]s|pedido|cotizaci[oó]n|asesor|reserva|cita|solicitud|list[oa]|registrad[oa])\b/iu;
const promisedCommercialCheck=/\b(?:puedo|podemos|voy a|te puedo|si quieres puedo)\s+(?:ayudarte\s+a\s+)?(?:verificar|consultar|revisar|confirmar|cotizar|validar)\s+(?:el|la|las|los|un|una|tu|su)?\s*(?:cotizaci[oó]n|precio|compra|pedido|stock|disponibilidad|env[ií]o|entrega|compatibilidad|modelo)\b/iu;
const unprovenAffordability=/\b(?:encaj[a-záéíóú]*|cabe[n]?|entr[a-záéíóú]*|alcanz[a-záéíóú]*|ajust[a-záéíóú]*|est[aá][a-z]* dentro)\b.{0,100}\b(?:presupuesto|monto|inversi[oó]n)\b|\b(?:presupuesto|monto|inversi[oó]n)\b.{0,100}\b(?:encaj[a-záéíóú]*|cabe[n]?|entr[a-záéíóú]*|alcanz[a-záéíóú]*|ajust[a-záéíóú]*)\b/iu;
const affordabilityCaveat=/\b(?:no puedo|no podemos|no se puede|sin verificar|no est[aá] verificado|falta confirmar|hay que confirmar|no sabemos|no puedo asegurar|no es seguro)\b/iu;
const unfinishedQuotePromise=/\b(?:puedo|podemos|voy a|te puedo)\s+(?:ayudarte\s+a\s+)?(?:dejar|preparar|tener)\b.{0,60}\b(?:list[ao]|cotizaci[oó]n|reserva|pedido|proforma)\b/iu;
const redundantIdentifierRequest=/\b(?:(?:si\s+)?(?:me\s+)?(?:confirmas|confirmes|conf[ií]rmame|ind[ií]came|compartes|compartas|env[ií]as|env[ií]ame|mandas|m[aá]ndame|pasas|p[aá]same)|me\s+puedes\s+(?:confirmar|compartir|enviar)|me\s+podr[ií]as\s+confirmar)\s+(?:(?:la|el|tu|su|un|una)\s+)?(?:referencia\s+(?:completa|exacta)|c[oó]digo\s+(?:completo|exacto)|modelo\s+(?:completo|exacto)|n[uú]mero\s+de\s+modelo)\b/iu;
const phantomPreparation=/\b(?:puedo|podemos|podr[ií]a|voy\s+a|te\s+puedo)\s+(?:ayudarte\s+a\s+)?(?:preparar|armar|dejar\s+list[ao]|registrar|generar)\s+(?:la|las|el|los|una|un|tu|su)?\s*(?:referencia|detalle|resumen|solicitud|pedido|cotizaci[oó]n|proforma)\b/iu;
const prematureDataRequest=/(?:\b(?:p[aá]same|dame|env[ií]ame|ind[ií]came|necesito|comp[aá]rteme|comparte|compartes|cu[aá]l es)\s+(?:tu|su)\s+(?:nombre|apellido|tel[eé]fono|celular|direcci[oó]n|ruc|dni|correo|tarjeta)\b|\b(?:tu|su)\s+(?:nombre\s+(?:y|completo)|direcci[oó]n|ruc|dni)\s+(?:para\s+(?:hacer|registrar|confirmar)))/iu;
export function protectSalesResponse(reply,{catalog=[],buyer=null,simulated=false}={}){
 const text=typeof reply==="string"?reply.trim():"";
 if(!text)return {reply:"Puedo ayudarte con tu consulta. ¿Qué producto necesitas?",blocked:true,reason:"empty"};
 const intent=buyer?.current_intent||"consulta";
 if(buyer?.requires_human)return {reply:"Entiendo que prefieres hablar con un asesor. No tengo confirmación de que se haya asignado o notificado a alguien; la atención humana debe gestionarla el equipo comercial.",blocked:true,reason:"human_requested"};
 if(/\bno quiero (?:dar|compartir) (?:mi )?(?:dni|ruc|tel[eé]fono|n[uú]mero)\b/iu.test(buyer?.last_message||""))
   return {reply:"Sí, puedes consultar productos y recibir orientación sin dar tu DNI ni otros datos personales.",blocked:true,reason:"privacy_preference"};

 const askedCommercialPrice=["consultar_precio","cotizar","comparar","objecion","comprar"].includes(intent);
 const available=(Array.isArray(catalog)?catalog:[]).filter(p=>p?.precio_soles!==null&&
   p?.precio_soles!==undefined&&Number.isFinite(Number(p.precio_soles))&&Number(p.precio_soles)>0);
 const replyProduct=matchCustomerProduct(text,catalog);
 // A new, unverified customer reference outranks an old matched SKU, the AI's
 // proposed product and any sole priced catalogue item. Never transfer a price.
 const unverifiedReference=Boolean(buyer?.customer_reference&&!buyer?.matched_partnumber);
 const intendedPn=unverifiedReference?null:buyer?.matched_partnumber||replyProduct?.partnumber||
   (available.length===1?available[0].partnumber:null);
 const pricedItems=intendedPn?available.filter(p=>p.partnumber===intendedPn):[];
 const priceValues=new Set(pricedItems.map(p=>Number(p.precio_soles)));
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
 const actionViolation=forbiddenActions.some(x=>x.test(text))||unconfirmedFutureAction.test(text)||promisedCommercialCheck.test(text)||unfinishedQuotePromise.test(text)||phantomPreparation.test(text);
 const repeatedModelRequest=Boolean((buyer?.customer_reference||buyer?.matched_partnumber)&&redundantIdentifierRequest.test(text));
 const stockViolation=stockUnits.test(text);
 const discountViolation=discount.test(text);
 const deliveryViolation=deliveryPromise.test(text);
 const prematureDataViolation=buyer?.current_intent==="comprar"&&prematureDataRequest.test(text);
 const affordabilityViolation=unprovenAffordability.test(text)&&!affordabilityCaveat.test(text);
 if(!wrongProduct&&!moneyViolation&&!actionViolation&&!stockViolation&&!discountViolation&&!deliveryViolation&&!prematureDataViolation&&!repeatedModelRequest&&!affordabilityViolation)
  return {reply:text,blocked:false,reason:null};
 const reason=wrongProduct?"product_mismatch":repeatedModelRequest?"redundant_model_question":moneyViolation?"unverified_price":affordabilityViolation?"unverified_affordability":actionViolation?"unconfirmed_action":
   stockViolation?"exact_stock":discountViolation?"unapproved_discount":prematureDataViolation?"premature_personal_data":"delivery_promise";
 const fallback={
  product_mismatch:"Necesito verificar el modelo exacto antes de darte un precio; no quiero mezclar productos diferentes.",
  redundant_model_question:"Ya tengo el modelo que indicaste. No necesitas repetirlo. Aún no dispongo de una ficha o precio vigente verificado de esa referencia.",
  unverified_affordability:buyer?.budget?"Con el presupuesto que me indicaste puedo orientarte entre las opciones, pero sin precios confirmados no sería correcto afirmar que la compra entra en ese monto.":"No sería correcto asegurar que una compra encaja en un presupuesto sin precios y condiciones comerciales confirmados.",
  premature_personal_data:"Podemos confirmar el artículo y las condiciones vigentes antes de coordinar la compra. Todavía no puedo registrar pedidos ni cobrar desde este chat.",
  unverified_price:"Para darte un precio correcto necesito verificar la oferta vigente con STECH. Puedo ayudarte a elegir la opción adecuada según lo que necesitas.",
  unconfirmed_action:intent==="comprar"?"Entiendo que quieres comprar. Antes de indicar el pago hay que confirmar el producto exacto, las condiciones y el precio. No hay un pedido ni un pago registrado desde este chat.":intent==="entrega"?"No hay una fecha de entrega confirmada para ofrecerte todavía. La disponibilidad y el despacho requieren verificación.":"La información o la gestión solicitada requiere verificación del equipo comercial. Por ahora no tengo confirmación de que se haya realizado esa acción.",
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
