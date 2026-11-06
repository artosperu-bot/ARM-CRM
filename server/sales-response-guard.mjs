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
const moneyRe=/\bS\/\.?\s*(\d[\d.,]*)/giu;
const forbiddenActions=[
 /\b(?:ya\s+(?:te\s+|lo\s+|la\s+)?(?:he\s+)?|te\s+(?:he\s+)?)(?:agend[eé]|reserv[eé]|registr[eé]|envi[eé])(?=\s|[.,!?]|$)/iu,
 /\b(?:tu|su|el)\s+(?:pedido|cotizaci[oó]n|reserva|compra|cita)\s+(?:ya\s+)?(?:est[aá]|qued[oó])\s+(?:confirmad[ao]|registrad[ao]|reservad[ao]|agendad[ao]|enviad[ao])/iu,
 /\b(?:ya\s+qued[oó]|qued[oó]\s+list[oa])\s+(?:tu|su|el|la)\s+(?:pedido|reserva|cita|cotizaci[oó]n)\b/iu
];
const stockUnits=/\b(?:quedan|tenemos|hay|disponibles?|en stock|stock de)\s+\d{1,5}\s+(?:unidades|equipos|laptops?|celulares?|impresoras?|licencias?|monitores?|routers?|productos?|servicios?|accesorios?|sillas?)\b/iu;
const discount=/\b(?:descuento|rebaja|promoci[oó]n|off)\s+(?:de|del|hasta)?\s*\d{1,3}\s*%|\b\d{1,3}\s*%\s+de\s+(?:descuento|rebaja)/iu;
const deliveryPromise=/\b(?:te|le)\s+(?:llega|entregamos|enviamos)\s+(?:ma[ñn]ana|hoy)\b/iu;
const unconfirmedFutureAction=/\b(?:puedo|podr[ií]a|voy a|te puedo)\s+(?:dejar|registrar|derivar|enviar|coordinar|agendar)\b.{0,90}\b(?:inter[eé]s|pedido|cotizaci[oó]n|asesor|reserva|cita|solicitud|list[oa]|registrad[oa])\b/iu;
const prematureDataRequest=/(?:\b(?:p[aá]same|dame|env[ií]ame|ind[ií]came|necesito|comp[aá]rteme|comparte|compartes|cu[aá]l es)\s+(?:tu|su)\s+(?:nombre|apellido|tel[eé]fono|celular|direcci[oó]n|ruc|dni|correo|tarjeta)\b|\b(?:tu|su)\s+(?:nombre\s+(?:y|completo)|direcci[oó]n|ruc|dni)\s+(?:para\s+(?:hacer|registrar|confirmar)))/iu;
export function protectSalesResponse(reply,{catalog=[],buyer=null,simulated=false}={}){
 const text=typeof reply==="string"?reply.trim():"";
 if(!text)return {reply:"Puedo ayudarte con tu consulta. ¿Qué producto necesitas?",blocked:true,reason:"empty"};
 const intent=buyer?.current_intent||"consulta";
 const askedCommercialPrice=["consultar_precio","cotizar","comparar","objecion","comprar"].includes(intent);
 const available=(Array.isArray(catalog)?catalog:[]).filter(p=>p?.precio_soles!==null&&
   p?.precio_soles!==undefined&&Number.isFinite(Number(p.precio_soles))&&Number(p.precio_soles)>0);
 const replyProduct=matchCustomerProduct(text,catalog);
 const intendedPn=buyer?.matched_partnumber||replyProduct?.partnumber||
   (available.length===1?available[0].partnumber:null);
 const pricedItems=intendedPn?available.filter(p=>p.partnumber===intendedPn):[];
 const priceValues=new Set(pricedItems.map(p=>Number(p.precio_soles)));
 const wrongProduct=Boolean(buyer?.matched_partnumber&&replyProduct?.partnumber&&
   buyer.matched_partnumber!==replyProduct.partnumber&&moneyRe.test(text));
 moneyRe.lastIndex=0;
 const budget=Number(buyer?.budget?.pen);
 let moneyViolation=false;
 for(const match of text.matchAll(moneyRe)){
  const value=number(match[1].replace(/[.,]+$/u,"")); // sentence-ending punctuation is not part of the amount
  const window=text.slice(Math.max(0,match.index-90),match.index).toLowerCase();
  const isRestatedBudget=Number.isFinite(budget)&&budget===value&&
    /\b(?:tu|su|el|un|de|con|presupuesto|monto|m[aá]ximo|inversi[oó]n)\b.{0,40}\b(?:presupuesto|monto|l[ií]mite|inversi[oó]n)\b|\bpresupuesto.{0,50}$/iu.test(window);
  const approvedPrice=askedCommercialPrice&&priceValues.has(value);
  if(!approvedPrice&&!isRestatedBudget){moneyViolation=true;break;}
 }
 const actionViolation=forbiddenActions.some(x=>x.test(text))||unconfirmedFutureAction.test(text);
 const stockViolation=stockUnits.test(text);
 const discountViolation=discount.test(text);
 const deliveryViolation=deliveryPromise.test(text);
 const prematureDataViolation=buyer?.current_intent==="comprar"&&prematureDataRequest.test(text);
 if(!wrongProduct&&!moneyViolation&&!actionViolation&&!stockViolation&&!discountViolation&&!deliveryViolation&&!prematureDataViolation)
  return {reply:text,blocked:false,reason:null};
 const reason=wrongProduct?"product_mismatch":moneyViolation?"unverified_price":actionViolation?"unconfirmed_action":
   stockViolation?"exact_stock":discountViolation?"unapproved_discount":prematureDataViolation?"premature_personal_data":"delivery_promise";
 const fallback={
  product_mismatch:"Necesito verificar el modelo exacto antes de darte un precio; no quiero mezclar productos diferentes.",
  premature_personal_data:"Podemos confirmar el artículo y las condiciones vigentes antes de coordinar la compra. Todavía no puedo registrar pedidos ni cobrar desde este chat.",
  unverified_price:"Para darte un precio correcto necesito verificar la oferta vigente con STECH. Puedo ayudarte a elegir la opción adecuada según lo que necesitas.",
  unconfirmed_action:"Puedo ayudarte con el siguiente paso, pero todavía no tengo confirmación de que se haya registrado una cotización, pedido o seguimiento.",
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
