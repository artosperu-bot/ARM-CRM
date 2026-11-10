/**
 * Verified, narrow Peru consumer-rights facts. Separate nationwide law from
 * STECH-specific policies (which must come from a verified company source).
 *
 * Indecopi:
 * https://consumidor.gob.pe/libro-de-reclamaciones/
 * https://www.gob.pe/institucion/indecopi/campañas/119031-guia-como-resolver-tus-problemas-de-consumo
 *
 * DO NOT turn the 15-business-day RESPONSE deadline into a returns window,
 * a warranty period, or a deadline to refund.
 */
const n=(value)=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export function asksFormalComplaintReplyDeadline(message){
 const s=n(message);
 return /\b(?:reclamo|reclamaciones?|queja|libro)\b/u.test(s)&&
  /\b(?:cuantos?\s+dias?|plazo|tiempo|cuanto\s+(?:demoran?|tardan?)|cuando)\b/u.test(s)&&
  /\b(?:respon(?:den|der|da)|contestar|contesten|respuesta|atender|atienden|resolver|resuelven)\b/u.test(s);
}
export function asksForComplaintBook(message){
 const s=n(message);
 return /\b(?:libro(?:\s+(?:de|d))?\s+reclamaciones?|quiero\s+(?:poner|presentar)\s+(?:un\s+)?reclamo|como\s+(?:pongo|presento)\s+(?:un\s+)?reclamo)\b/u.test(s);
}
export function consumerRightsGuidance(topic,lastMessage){
 if(asksFormalComplaintReplyDeadline(lastMessage))
  return "DATO LEGAL PERÚ VERIFICADO (Indecopi): Los reclamos o quejas formalmente ingresados en el Libro de Reclamaciones deben recibir una respuesta del proveedor dentro de 15 días hábiles improrrogables. Es plazo de RESPUESTA, no de reembolso, devolución ni garantía. Fuente: https://consumidor.gob.pe/libro-de-reclamaciones/. Contesta de manera corta y directa.";
 if(topic==="devolucion_reclamo"||topic==="libro_reclamaciones"||asksForComplaintBook(lastMessage))
  return "DERECHOS DEL CONSUMIDOR PERÚ: El proveedor debe tener disponible el Libro de Reclamaciones físico o virtual. La reparación, reposición o devolución por defecto dependen del caso y de los derechos aplicables (Ley 29571, art. 97); no prometas devolución inmediata ni inventes una regla universal de 7 días por simple cambio de opinión. Diferencia estos derechos legales de la política interna de la tienda, todavía no verificada. Fuente: https://www.gob.pe/institucion/indecopi/normas-legales/3462038-ley-29571";
 return "";
}
export const lawfulComplaintDeadlineReply="Si registraste un reclamo en el Libro de Reclamaciones, la empresa tiene hasta 15 días hábiles para responderte. Ese plazo es para la respuesta, no significa que una devolución se apruebe automáticamente.";
