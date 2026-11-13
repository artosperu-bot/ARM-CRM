/**
 * Single-turn conversation planner. The model still writes naturally, but must
 * answer every material question in a compound message and never treat a
 * post-sale incident as a new sales lead. No external tools or state writes.
 */
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/gu,"")
 .toLowerCase().replace(/\s+/gu," ").trim();
const match=(t,re)=>re.test(t);
export function analyzeConversationTurn(buyer={},catalog=[]){
 buyer=buyer&&typeof buyer==="object"?buyer:{};
 const text=norm(buyer.last_message);
 const topic=buyer.current_topic||"comercial",intent=buyer.current_intent||"consulta";
 const asksPrice=match(text,/\b(?:precio|cuanto (?:cuesta|sale|esta|vale|me sale|me saldria|salen|saldria)|a cuanto|a como|por cuanto|cuanto por|cotiz|proforma)\b/u);
 const asksStock=match(text,/\b(?:stock|disponib|tienen|tienes|te queda|les queda|les quedan|hay para|hay unidades|hay existencias|quedan|alcanza el stock|en inventario)\b/u)||
  match(text,/\b(?:hay|tiene|tienen)\s+(?:(?:para|de|en|los|las)\s+)?\d{1,3}\b/u)||
  intent==="disponibilidad";
 const asksDelivery=match(text,/\b(?:envio|enviar|envian|envias|mandar|mandan|despacho|entrega|llega|delivery|para hoy|para manana|antes de viernes)\b/u);
 const asksComparison=match(text,/\b(?:compar\w*|vs\b|versus|diferencia|cual es mejor|conviene mas|entre (?:el|la|los|las)|otra opcion|alternativa)\b/u);
 const asksCompatibility=match(text,/\b(?:compatible|compatibilidad|le sirve|me sirve|funciona con|soporta|necesita (?:un|una)|puerto|watt|conector)\b/u);
 const identityPhoto=match(text,/\b(?:foto|fotito|imagen)\s+(?:(?:de|del)\s+)?(?:mi\s+)?(?:dni|documento|identidad|tarjeta|carnet)\b/u);
 const asksPhoto=!identityPhoto&&match(text,/\b(?:foto|fotito|imagen|muestra(?:me)?|mandame (?:la|una) foto|pasame (?:la|una) foto)\b/u);
 const asksDiscount=match(text,/\b(?:rebaja|descuento|descuentito|mas barato|menos precio|mejor precio|precio especial)\b/u);
 const wantsHuman=buyer.requires_human===true||intent==="asesor";
 const isSupport=["soporte_tecnico","devolucion_reclamo","estado_reclamo","estado_derivacion",
  "pedido_existente","plazo_reclamo","libro_reclamaciones"].includes(topic)||intent==="postventa";
 const isOptOut=intent==="compra_cancelada"||intent==="despedida";
 const axes=[
  ...(asksPrice?["precio"]:[]),...(asksStock?["disponibilidad"]:[]),
  ...(asksDelivery?["entrega"]:[]),...(asksComparison?["comparacion"]:[]),
  ...(asksCompatibility?["compatibilidad"]:[]),...(asksPhoto?["foto"]:[]),
  ...(asksDiscount?["descuento"]:[])
 ];
 const compound=axes.length>1;
 const selected=Array.isArray(catalog)?catalog.find(x=>x?.partnumber===buyer.matched_partnumber):null;
 const noStock=selected?.disponibilidad==="no disponible";
 const preemptive=wantsHuman?"handoff":isSupport?"soporte":
  isOptOut?"cierre":intent==="comprar"?"decision":
  compound?"multipregunta":intent==="objecion"?"objecion":(intent==="comparar"||asksComparison)?"comparacion":"consulta";
 let questionPolicy=isOptOut||wantsHuman?"ninguna":
  isSupport?"solo_si_resuelve_incidente":
  intent==="comprar"?"solo_si_bloquea_compra":"una_si_es_decisiva";
 let instructions="";
 if(preemptive==="cierre")
  instructions="Respeta la despedida o desistimiento; una sola frase, sin nuevas preguntas, precio ni descuentos.";
 else if(preemptive==="handoff")
  instructions="Prioriza la petición humana. Nunca digas que ya asignaste o notificaste a alguien sin confirmación operacional; no reanudes la venta.";
 else if(preemptive==="soporte")
  instructions="Atiende la incidencia actual, no vendas otro producto. En devoluciones, errores de pedido y reclamos indica el estado operativo real, sin prometer una solución aprobada.";
 else if(preemptive==="decision")
  instructions="El comprador ya decidió: no vuelvas a comparar. Resuelve la duda puntual y explica únicamente el paso de compra realmente habilitado.";
 else if(compound)
  instructions="El cliente juntó varias preguntas: contesta TODAS las que pidió en orden de utilidad, sin separarlas en respuestas futuras. No respondas solo al precio olvidando stock, entrega o medios de pago; si una condición no está verificada dilo, sin inventarla ni cambiar de tema.";
 else if(asksComparison)instructions="Compara solo diferencias técnicas documentadas y para qué uso conviene cada opción. No proclames mejor cámara, batería, rendimiento ni calidad global si no existe comparación verificable entre modelos.";
 else if(asksDiscount)instructions="Reconoce la objeción sin inventar rebajas; ofrece una alternativa respaldada solo si realmente encaja con lo solicitado.";
 else if(asksCompatibility)instructions="No inventes compatibilidad. Si falta un dato decisivo, pide SOLO ese dato, sin repetir los que el cliente ya dio.";
 else instructions="Resuelve primero la pregunta del último turno; no uses un guion de venta ni agregues preguntas por costumbre.";
 if(noStock&&asksStock)instructions+=" El SKU seleccionado está NO DISPONIBLE para esta cantidad: nunca lo reformules como disponibilidad por confirmar ni sugieras una entrega inmediata. Solo ofrece alternativa si su idoneidad está sustentada.";
 if(asksPrice&&selected?.precio_soles==null)instructions+=" El precio está por confirmar; evita inventar importes o convertir el presupuesto del comprador en precio.";
 return {focus:preemptive,axes,compound,asksPrice,asksStock,asksDelivery,asksComparison,
  asksCompatibility,asksPhoto,asksDiscount,noStock,questionPolicy,instructions};
}
export function conversationTurnInstructions(buyer,catalog){
 const plan=analyzeConversationTurn(buyer,catalog);
 return "PLAN ADAPTATIVO DEL ÚLTIMO MENSAJE (sin sustituir guardas): prioridad="+plan.focus+
  "; preguntas="+(plan.axes.join(", ")||"consulta puntual")+
  "; múltiples="+plan.compound+"; preguntas permitidas="+plan.questionPolicy+
  ". "+plan.instructions;
}
