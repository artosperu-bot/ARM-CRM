/**
 * An auditable commercial handoff *status*, not a generated quotation.
 * Never turns a price observation into a stock promise, order or payment.
 * All customer facts originate from buyer turns; external commercial facts
 * originate from freshly checked catalogue records.
 */
export function assessCommercialReadiness(buyer,{catalog=[],simulated=false}={}){
 const all=Array.isArray(catalog)?catalog:[];
 const draftLines=(Array.isArray(buyer?.draft_items)?buyer.draft_items:[]).slice(0,12).map(x=>{
  const product=all.find(p=>p.partnumber===x.partnumber);
  return {partnumber:x.partnumber,quantity:x.quantity,
   title:product?String(product.titulo||product.title||x.partnumber).slice(0,130):null,
   inCurrentCatalog:Boolean(product)};
 });
 const demoLines=simulated?draftLines.map(x=>{
  const p=all.find(z=>z.partnumber===x.partnumber);
  const valid=p?.oferta_simulada===true&&p?.origen_datos==="simulacion_solo_pruebas";
  const price=valid&&p.precio_soles!==null&&Number.isFinite(Number(p.precio_soles))&&Number(p.precio_soles)>0?Number(p.precio_soles):null;
  const cents=price!==null?Math.round(price*100)*x.quantity:null;
  return {...x,unitPricePen:price,subtotalPen:cents!==null?cents/100:null,
   availability:valid?p.disponibilidad:"por confirmar"};
 }):[];
 const basketTotal=demoLines.length&&demoLines.every(x=>x.subtotalPen!==null)?
  Math.round(demoLines.reduce((sum,x)=>sum+Math.round(x.subtotalPen*100),0))/100:null;
 const demoBasket=simulated&&demoLines.length>0?{testOnly:true,
  lines:demoLines,totalPen:basketTotal,allPriced:basketTotal!==null,
  allAvailable:demoLines.every(x=>x.availability==="disponible"),
  ambiguousQuantity:buyer?.draft_ambiguous===true}:null;
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
   selected?.origen_stock==="stock_vendible_verificado");
 // Mathematical exercise only: no quote, reservation, tax or delivery operation.
 const demoEstimate=simulated&&selected?.oferta_simulada===true&&product&&quantity&&
   selected?.precio_soles!==null&&selected?.precio_soles!==undefined&&
   Number.isFinite(rawPrice)&&rawPrice>0?
   {testOnly:true,partnumber:product.partnumber,quantity,
    unitPricePen:rawPrice,totalPen:Math.round(rawPrice*quantity*100)/100,
    status:selected.disponibilidad==="disponible"?"disponible":
      selected.disponibilidad==="no disponible"?"no disponible":"por confirmar"}:null;
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
  demoEstimate,
  draftLines,
  demoBasket,
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
