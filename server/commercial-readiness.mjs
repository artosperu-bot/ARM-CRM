/**
 * An auditable commercial handoff *status*, not a generated quotation.
 * Never turns a price observation into a stock promise, order or payment.
 * All customer facts originate from buyer turns; external commercial facts
 * originate from freshly checked catalogue records.
 */
export function assessCommercialReadiness(buyer,{catalog=[],simulated=false}={}){
 const quantity=Number.isInteger(buyer?.quantity)&&buyer.quantity>=1&&buyer.quantity<=999?
   buyer.quantity:null;
 const requestedSku=typeof buyer?.matched_partnumber==="string"?buyer.matched_partnumber:null;
 const selected=(Array.isArray(catalog)?catalog:[]).find(p=>p?.partnumber===requestedSku)||null;
 const product=selected?{
  partnumber:String(selected.partnumber),
  title:String(selected.titulo||selected.title||selected.partnumber).slice(0,130)
 }:null;
 const rawPrice=Number(selected?.precio_soles);
 const priceEvidence=Boolean(!simulated&&selected?.oferta_simulada!==true&&
  selected?.origen_datos==="precio_vigente_verificado"&&
  selected?.precio_soles!==null&&selected?.precio_soles!==undefined&&
  Number.isFinite(rawPrice)&&rawPrice>0);
 const saleableStock=Boolean(!simulated&&selected?.disponibilidad==="disponible"&&
   selected?.origen_datos==="stock_vendible_verificado");
 const missing=[];
 if(!product)missing.push("modelo_por_confirmar");
 if(!quantity)missing.push("cantidad_por_confirmar");
 if(!priceEvidence)missing.push("precio_vigente_por_confirmar");
 if(!saleableStock)missing.push("disponibilidad_vendible_por_confirmar");
 // Delivery, IGV and shipping can vary by region. The chat has no quote
 // calculation tool, so even all green commercial facts cannot authorize it.
 missing.push("condiciones_cotizacion_por_confirmar");
 return {
  state:"requiere_validacion",
  intent:buyer?.current_intent||"consulta",
  product,
  quantity,
  budget:buyer?.budget?.pen?{pen:buyer.budget.pen,scope:buyer.budget.scope}:null,
  priceEvidence,
  saleableStock,
  blockers:missing,
  quoteCreated:false,orderCreated:false,paymentRegistered:false,
  advisorAssigned:false,
  // This represents the existing OPERATOR-controlled action in the CRM.
  // The AI never executes it, and simulation must never create live records.
  canManuallyCreateOpportunity:!simulated&&Boolean(product),
  nextAction:simulated?"Solo evaluación privada; no crear registros comerciales reales":
   "Verificar precio vigente, disponibilidad vendible y condiciones antes de cotizar o confirmar compra"
 };
}
