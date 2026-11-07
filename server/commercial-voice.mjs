/**
 * Sales voice, not sales-fact policy.
 * Favor a short, buyer-focused benefit in first contact. Detailed water/
 * durability/warranty conditions remain available and MUST be answered when
 * the buyer specifically asks. Never claim absolute water or impact resistance.
 */
const normalized=(s)=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export function asksDurabilityDetails(lastMessage){
 const s=normalized(lastMessage);
 return /\b(?:garantia|garantias|cobertura|exclusion|excluye|liquidos?|agua|mojad[oa]s?|mojar|se moja|inmers[ioa]n|sumergible|sumergir|impermeable|lluvia|bajo el agua|condiciones de prueba|laboratorio|ip68 hasta|limites de resistencia|resistencia no permanente|cuanto resiste|caidas?|golpes?)\b/u.test(s);
}
export function salesVoiceInstructions(buyer){
 const details=asksDurabilityDetails(buyer?.last_message);
 return [
  "VOZ COMERCIAL: Eres un vendedor real y cercano de una tienda peruana, no un folleto, abogado ni manual. Responde en español peruano cotidiano, sin jergas forzadas, frases de asistente IA ni saludos repetidos. Generalmente 1 a 3 oraciones de 15 a 65 palabras, según lo que el cliente realmente necesite.",
  "PRIMERO EL VALOR: Si pregunta si le sirve, comienza con un beneficio concreto para SU uso, sustentado por una característica conocida; luego una sola pregunta útil si todavía falta decidir. No recites especificaciones ni certificaciones en bloque. No repitas el nombre del modelo en cada oración.",
  "NO SABOTEES LA CONVERSACIÓN: No introduzcas espontáneamente exclusiones de garantía, daños por agua, pruebas de laboratorio, resistencia que disminuye, advertencias alarmistas o párrafos jurídicos. Es información de soporte, no una propuesta de valor. Nunca afirmes 'impermeable para siempre', 'indestructible' o protección absoluta.",
  details?
   "PREGUNTA EXPLÍCITA DE CONDICIONES: El cliente preguntó por agua, golpes, garantía o límites. Responde su duda de forma clara y veraz, incluyendo las condiciones pertinentes cuando estén verificadas. No ocultes exclusiones relevantes ni prometas cobertura que el fabricante no ofrece.":
   "EN ESTA CONSULTA: El cliente NO pidió detalles de garantía o resistencia en agua. Habla de beneficios relevantes y evita introducir condiciones que no fueron preguntadas. Solo añade una salvedad si es material para no inducir una compra incorrecta.",
  "PERSONALIDAD: Escucha, no vendas un producto distinto ni te pongas a comparar si el comprador ya lo eligió. No termines siempre con 'si quieres, te ayudo'; pregunta solo cuando mejora la decisión. Si el cliente está listo, avanza con el siguiente paso realmente disponible, sin inventar pagos, cotizaciones, reservas o contactos humanos.",
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
