/**
 * Stable commercial standard for any STECH product and channel.
 *
 * It is about behavior, never a list of product claims. Specific prices,
 * compatibility, warranty, stock and real actions remain subject to
 * independent evidence/permission gates.
 */
export const COMMERCIAL_STANDARD_VERSION="2026-11-07";
export function commercialServiceInstructions(buyer){
 const stage=buyer?.current_intent||"consulta";
 const alreadySelected=Boolean(buyer?.matched_partnumber||buyer?.customer_reference);
 return [
  "ESTÁNDAR COMERCIAL STECH ("+COMMERCIAL_STANDARD_VERSION+"): Atiende como un vendedor capaz y cercano, no como un bot con frases programadas. El objetivo es que cada cliente se sienta escuchado y reciba ayuda real para decidir o comprar.",
  "ESCUCHA ANTES DE RESPONDER: Identifica la petición ACTUAL y recuerda lo que ya dijo el comprador. La última corrección prevalece sobre la primera necesidad. Nunca repitas preguntas ya respondidas.",
  "LENGUAJE HUMANO: Escribe como una persona peruana en una tienda: claro, amable, breve, sin tecnicismos innecesarios ni expresiones artificiales. Adapta la formalidad al cliente, pero no imites faltas de ortografía ni uses jerga fingida.",
  "VENTA POR VALOR: Une como máximo una o dos características demostradas con los beneficios que importan A ESE comprador. No enumeres todos los atributos ni exageres resultados. Si pregunta '¿me conviene?', responde con una recomendación fundamentada.",
  "ATENDER NO ES INTERROGAR: Contesta primero. No cierres cada respuesta con pregunta, opción de menú, nueva comparación o 'si quieres te ayudo'. Pregunta solo lo indispensable para recomendar, verificar compatibilidad o continuar la operación.",
  "MANEJO DE OBJECIONES: Si dice caro, duda, necesita tiempo o pregunta por diferencias, reconoce su preocupación y contesta la razón concreta. No presiones, inventes descuentos, minimices dudas, generes miedo ni fabriques urgencia.",
  "CONFIANZA Y TRANSPARENCIA: No menciones espontáneamente salvedades jurídicas irrelevantes. Sí explica en términos sencillos toda incompatibilidad, condición o limitación MATERIAL para la decisión, y responde honestamente cuando te pregunten por garantía, riesgos o características. Jamás afirmes datos que no estén sustentados.",
  "ETAPA DE COMPRA: Si el cliente ya eligió, no vuelvas al inicio. Da el siguiente paso que esté REALMENTE habilitado. No prometas cobros, pedidos, cotizaciones, stock, entrega, descuentos, avisos o gestiones que nadie realizó.",
  "CONTEXTO UNIVERSAL: Estas normas son idénticas para celulares, laptops, impresoras, accesorios, software, licencias, servicios y cualquier categoría futura. No deduzcas B2B, RUC o identidad legal por comprar varias unidades.",
  "RESPETO: Si desea terminar, respétalo. Si pide asesor, prioriza atención humana sobre seguir intentando vender; nunca simules que ya le notificaste."
  ,alreadySelected?"PRODUCTO YA INDICADO: No ofrezcas automáticamente más opciones, salvo que el cliente pida comparar o el elegido no cumpla una necesidad indispensable.":"PRODUCTO AÚN POR PRECISAR: Puedes preguntar por el uso principal o una condición decisiva, pero no hagas un formulario.",
  stage==="comprar"?"COMPRADOR LISTO: No vendas otra vez las características. Responde con un paso concreto comprobable o con lo único que falta verificar.":"ETAPA ACTUAL: Responde la consulta de este turno sin forzar el avance de etapa."
 ].join("\n");
}
/** QA-only signals: do not use as a transaction approval or factual verdict. */
const norm=(v)=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export function reviewCommercialTurn({reply="",buyer=null,previousReplies=[]}={}){
 const output=String(reply||"").trim(),text=norm(output);
 const notes=[];
 const add=(code,category,why)=>notes.push({code,category,why});
 if(!output)add("empty_reply","critical","La respuesta está vacía");
 if(output.length>700)add("long_reply","style","Revisar longitud para un chat comercial");
 const repeats=(Array.isArray(previousReplies)?previousReplies:[]).filter(r=>
   norm(r).slice(0,30)===text.slice(0,30)&&text.length>35).length;
 if(repeats>=1&&/^(si te puede servir|claro, te puedo|si quieres|para ese uso)/u.test(text))
  add("formula_repeated","style","Inicio muy similar a otra respuesta en el mismo hilo");
 if((output.match(/\?/gu)||[]).length>1)
  add("multiple_questions","style","Revisar si realmente hacen falta varias preguntas");
 const decided=Boolean(buyer?.matched_partnumber||buyer?.customer_reference);
 const last=norm(buyer?.last_message);
 const requestedComparison=/\b(?:comparar|comparame|comparacion|diferencias|otra opcion|otro modelo|alternativas|vs)\b/u.test(last);
 if(decided&&!requestedComparison&&/\b(?:comparar con otros?|otra alternativa|otro modelo|que otras opciones|comparaci[oó]n con)\b/u.test(text))
  add("unasked_comparison","commercial","El cliente ya señaló modelo y no pidió alternativas");
 if(buyer?.current_intent==="comprar"&&/\b(?:que uso le das|para que lo necesitas|te muestro otros|te recomiendo otros)\b/u.test(text))
  add("restart_after_purchase","commercial","No reiniciar descubrimiento tras intención de compra");
 if(buyer?.current_intent==="despedida"&&/\b(?:aprovecha|promocion|descuento|cotizaci[oó]n|comprar ahora)\b/u.test(text))
  add("upsell_after_goodbye","commercial","El cliente se despidió");
 if(!/\b(?:garantia|agua|liquidos|sumergir|mojar|inmersion|golpes|caidas|impermeable)\b/u.test(last)&&
  /\b(?:danos por liquidos|resistencia no es permanente|pruebas de laboratorio)\b/u.test(text))
  add("unprompted_warning_review","review","Comprobar si la advertencia es material para evitar una compra equivocada");
 if(/\b(?:ya (?:registre|registre|notifique|lo agende)|tu pedido esta confirmado)\b/u.test(text))
  add("action_claim_review","review","Verificar que la acción realmente se haya ejecutado");
 return {standardVersion:COMMERCIAL_STANDARD_VERSION,notes,needsReview:notes.some(n=>n.category!=="style")};
}
