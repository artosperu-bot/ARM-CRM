export type CommercialSignal = {
 key:"exploring"|"quote"|"buying"|"objection"|"missing"|"followup"|"human"|"ended";
 label:string;
 priority:"normal"|"medium"|"high";
 handoff:boolean;
 followupSuggested:boolean;
 nextAction:string;
};
/**
 * UI summary based on what the client currently wants, not a bag of keywords
 * accumulated from earlier turns. This never creates a deal, price, booking
 * or assignment.
 */
const normalize=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
export function detectCommercialSignal(customerMessages:string[]):CommercialSignal{
 const texts=customerMessages.filter(s=>typeof s==="string"&&s.trim());
 const last=normalize(texts.at(-1)||"");
 const searching={key:"exploring",label:"Orientación comercial",priority:"normal",handoff:false,followupSuggested:false,
  nextAction:"Responder la necesidad actual sin inventar precios ni iniciar gestiones."} as const;
 if(!last)return searching;
 if(/\b(?:ya no (?:quiero|voy a) comprar|no (?:quiero|voy a) comprar|mejor no compro|cancelo (?:la )?compra|ya no me interesa|gracias[, ]+(?:por ahora )?(?:lo )?voy a pensar|por ahora lo voy a pensar|eso seria todo|no necesito nada mas)\b/u.test(last))
  return {key:"ended",label:"No insistir en la venta",priority:"normal",handoff:false,followupSuggested:false,
   nextAction:"Respetar la decisión del cliente. No crear tareas ni reabrir comparaciones."};
 const noHuman=/\b(?:no (?:necesito|quiero) (?:un )?asesor|prefiero seguir (?:aqui|con el bot))\b/u.test(last);
 if(!noHuman&&/\b(?:quiero (?:hablar|conversar) con (?:un )?(?:asesor|persona)|quiero que me atienda (?:un )?asesor|necesito (?:un )?asesor|pasame con (?:un )?asesor|puedes comunicarme con alguien|atencion humana)\b/u.test(last))
  return {key:"human",label:"Solicita atención humana",priority:"high",handoff:true,followupSuggested:true,
   nextAction:"Pedir intervención del equipo mediante una acción real del CRM. Todavía no hay asesor asignado."};
 if(/\b(?:reclam[oa]|denuncia|estafa|devolucion|me cobraron|producto defectuoso)\b/u.test(last))
  return {key:"objection",label:"Atención especializada",priority:"high",handoff:true,followupSuggested:true,
   nextAction:"Revisar el caso con el equipo comercial; no afirmar que existe una gestión registrada."};
 if(/\b(?:quiero comprar(?:lo|la|los|las)?|voy a comprar|lo compro|la compro|los compro|las compro|me lo llevo|me la llevo|donde pago|como pago|pagar ahora|confirmo la compra|procedamos con la compra|(?:siguiente paso|como hago|que sigue|como procedo)\\s+(?:para\\s+)?comprar(?:lo|la|los|las)?|siguiente paso para la compra|necesito (?:\\d+|dos|tres|cuatro) .{0,45}para comprarlos)\b/u.test(last))
  return {key:"buying",label:"Cliente quiere comprar",priority:"high",handoff:true,followupSuggested:true,
   nextAction:"Revisar precio y disponibilidad. El operador puede abrir una oportunidad con un contacto identificado; no hay pedido ni pago generado."};
 if(/\b(?:cotiz|proforma|precio exacto|cuanto cuesta|cuanto sale|descuento|disponibilidad|disponible|stock|envio|entrega|despacho)\b/u.test(last))
  return {key:"quote",label:"Consulta comercial por verificar",priority:"medium",handoff:true,followupSuggested:true,
   nextAction:"Responder con datos vigentes o verificar lo pendiente. Una consulta no equivale a cotización creada."};
 if(/\b(?:agend[aeo]|programame|recuerdame|avisame|me avisas|escribeme|me escribes|contactame|llamame|solicito seguimiento)\b/u.test(last)&&
   !/\b(?:no (?:me )?(?:agendes|escribas|contactes|llames|avises))\b/u.test(last))
  return {key:"followup",label:"Solicita seguimiento",priority:"medium",handoff:false,followupSuggested:true,
   nextAction:"Validar consentimiento, contacto y fecha/hora antes de registrar un seguimiento real."};
 if(/\b(?:iphone|apple|samsung|motorola|xiaomi|redmi)\b/u.test(last)&&!/\b(?:ulefone)\b/u.test(last))
  return {key:"missing",label:"Verificar producto solicitado",priority:"medium",handoff:false,followupSuggested:true,
   nextAction:"Comprobar ese modelo en el catálogo; no asumir que la marca está ausente o que existe stock."};
 return searching;
}
