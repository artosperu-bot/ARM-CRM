/**
 * Sales voice, not sales-fact policy.
 * Favor a short, buyer-focused benefit in first contact. Detailed water/
 * durability/warranty conditions remain available and MUST be answered when
 * the buyer specifically asks. Never claim absolute water or impact resistance.
 */
const normalized=(s)=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export function asksDurabilityDetails(lastMessage){
 const s=normalized(lastMessage);
 return /\b(?:garantia|garantias|cobertura|exclusion|excluye|liquidos?|agua|mojad[oa]s?|mojar|se moja|inmers[ioa]n|sumergible|sumergir(?:lo|la|los|las|se)?|sumergid[oa]s?|impermeable|lluvia|bajo el agua|condiciones de prueba|laboratorio|ip68 hasta|limites de resistencia|resistencia no permanente|cuanto resiste|caidas?|golpes?)\b/u.test(s);
}
export function salesVoiceInstructions(buyer){
 const details=asksDurabilityDetails(buyer?.last_message);
 return [
  "VOZ COMERCIAL: Eres un vendedor real y cercano de una tienda peruana, no un folleto, abogado ni manual. Responde en español peruano cotidiano, sin jergas forzadas, frases de asistente IA ni saludos repetidos. Generalmente 1 a 3 oraciones de 15 a 65 palabras, según lo que el cliente realmente necesite.",
  "PRIMERO EL VALOR: Si pregunta si le sirve, entra directamente al motivo concreto para SU uso con una característica verificada y una ventaja práctica. Evita introducciones comodín como 'Sí te puede servir bastante para ese uso', 'Claro, perfecto', 'Este equipo cuenta con'. No recites especificaciones ni certificaciones en bloque. No repitas el modelo en cada oración.",
  "NO SABOTEES LA CONVERSACIÓN: No introduzcas espontáneamente exclusiones de garantía, daños por agua, pruebas de laboratorio, resistencia que disminuye, advertencias alarmistas o párrafos jurídicos. Es información de soporte, no una propuesta de valor. Nunca afirmes 'impermeable para siempre', 'indestructible' o protección absoluta.",
  details?
   "PREGUNTA EXPLÍCITA DE CONDICIONES: El cliente preguntó por agua, golpes, garantía o límites. Responde su duda de forma clara y veraz, incluyendo las condiciones pertinentes cuando estén verificadas. No ocultes exclusiones relevantes ni prometas cobertura que el fabricante no ofrece.":
   "EN ESTA CONSULTA: El cliente NO pidió detalles de garantía o resistencia en agua. Habla de beneficios relevantes y evita introducir condiciones que no fueron preguntadas. Solo añade una salvedad si es material para no inducir una compra incorrecta.",
  "PERSONALIDAD: Escucha. No vendas un producto distinto ni compares si el comprador ya eligió uno. No termines por costumbre con 'si quieres, puedo ayudarte a revisar', '¿quieres que compare con otro?' o 'te ayudo con el siguiente paso'. Cuando la respuesta ya resolvió la duda, termina sin pregunta. Pregunta UNA cosa solo si cambia la recomendación o impide avanzar. Si ya quiere comprar, explica el paso realmente disponible; no inventes pagos, cotizaciones, reservas o contactos humanos.",
  "FRASES A EVITAR POR SONAR ROBÓTICAS: 'bajo pruebas controladas' sin que lo pidan, 'resistencia no permanente' sin contexto, 'con los límites normales del fabricante' sin contexto, 'lo que tengo verificado es', 'en el registro que veo', 'no sería correcto inventar' repetido, 'ficha técnica no verificada' repetido y 'si quieres puedo ayudarte a revisar' en cada turno."
 ].join("\n");
}
export function evidenceForSalesTurn(specs,lastMessage){
 if(!specs||typeof specs!=="object"||Array.isArray(specs))return specs;
 if(asksDurabilityDetails(lastMessage))return specs;
 // Support/legal clauses stay in trusted source data for direct buyer questions,
 // but do not prime the model to recite them unsolicited.
 const {note,ip68,...benefits}=specs;
 return benefits;
}
/** Drop only unsolicited disclaimer *sentences*; don't suppress legitimate
 * warranty/immersion answers or alter technical claims/prices. */
export function softenUnsolicitedDurabilityCaveats(text,lastMessage){
 if(asksDurabilityDetails(lastMessage))return String(text||"");
 let answer=String(text||"").trim();
 // Remove self-contained warning sentences, including 'Ojo: ...', in ordinary
 // product recommendations. If a sentence contains useful product information
 // besides a warning, remove just the warning clause instead.
 const sentences=answer.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/u);
 answer=sentences.filter(s=>{
  const n=normalized(s);
  return !/^\s*(?:ojo[:;,]?\s*)?(?:esas?|estas?|las?|los?)?\s*(?:certificaciones?|resistencia|danos?|segun el fabricante|el fabricante|en cuanto a la garantia|la garantia)\b/u.test(n) ||
   !/(?:pruebas controladas|laboratorio|no es permanente|puede disminuir|danos por liquidos|no (?:estan|esta) cubiert[oa]s?)/u.test(n);
 }).join(" ");
 answer=answer
  .replace(/\s*[,;]\s*(?:con|bajo|sujeto a)\s+(?:los?\s+)?(?:l[ií]mites?|condiciones?|pruebas?)\s+(?:normales?\s+)?(?:del\s+fabricante|controladas|de\s+laboratorio)\b/giu,"")
  .replace(/\s{2,}/gu," ").trim();
 return answer||String(text||"");
}

/**
 * Remove low-value scripted endings without changing the core benefit or any
 * material warranty/compatibility facts. A substantive follow-up question is
 * preserved; only repeated generic pitches are removed.
 */
export function polishCommercialReply(text,buyer){
 const original=String(text||"").trim();
 let answer=softenUnsolicitedDurabilityCaveats(original,buyer?.last_message);
 const last=normalized(buyer?.last_message);
 const askedComparison=/\b(?:alternativas?|comparacion|comparar|comparame|diferencias?|versus|otro modelo|otra opcion|vs)\b/u.test(last);
 if(buyer?.matched_partnumber&&!askedComparison&&buyer?.current_intent!=="comparar"){
  answer=answer.replace(/\s*¿(?:quieres|te\s+gustar[ií]a|te\s+interesar[ií]a)\b.{0,155}\b(?:otro|otra|alternativa|comparar|comparaci[oó]n)\b[^?]{0,90}\?\s*$/iu,"").trim();
 }
 answer=answer.replace(/\s*(?:Si\s+(?:te\s+sirve|quieres),?\s*)?(?:puedo\s+ayudarte|te\s+puedo\s+ayudar|te\s+ayudo)\s+a\s+(?:revisar|ver|evaluar)\s+(?:el|los)\s+siguiente[s]?\s+paso[s]?\b[^.!?]*\.?\s*$/iu,"").trim();
 return answer.length>=14?answer:original;
}
