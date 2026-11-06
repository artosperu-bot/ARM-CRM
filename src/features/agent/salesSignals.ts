export type CommercialSignal = {
  key: "exploring" | "quote" | "buying" | "objection" | "missing" | "followup";
  label: string;
  priority: "normal" | "medium" | "high";
  handoff: boolean;
  followupSuggested: boolean;
  nextAction: string;
};
/** Derived only from customer utterances; never treats an AI promise as an executed CRM action. */
export function detectCommercialSignal(customerMessages: string[]): CommercialSignal {
 const content=customerMessages.slice(-5).join(" ").toLocaleLowerCase("es");
 if(/(viernes|lunes|martes|miercoles|miércoles|jueves|sabado|sábado|domingo|mañana|pr[oó]xima semana|la semana que viene|recu[eé]rdame|retom(ar|amos)|seguimiento|agend|cobro|me avisas|av[ií]same|me escribes)/.test(content)){
  return {key:"followup",label:"Solicita seguimiento",priority:"medium",handoff:false,followupSuggested:true,
   nextAction:"Confirmar consentimiento y contacto; elegir fecha y hora y guardar tarea en Seguimientos. Aún no está agendada."};
 }
 if(/(iphone|apple|samsung|motorola|xiaomi|redmi)/.test(content) && !/ulefone/.test(content)){
  return {key:"missing",label:"Producto fuera de catálogo",priority:"medium",handoff:true,followupSuggested:true,
   nextAction:"Solicitar autorización para que un asesor confirme la disponibilidad del producto solicitado."};
 }
 if(/(reserv|separ|pagar ahora|pago hoy|comprar hoy|compra inmediata|lo compro|me llevo|retiro hoy|recojo hoy)/.test(content)){
  return {key:"buying",label:"Alta intención de compra",priority:"high",handoff:true,followupSuggested:true,
   nextAction:"Derivar al asesor para verificar stock, precio, pago y entrega; crear oportunidad y seguimiento con aprobación."};
 }
 if(/(garant[ií]a|reclamo|devoluci[oó]n|prometes|me garantizas|nunca entra agua|fall[oó])/i.test(content)){
  return {key:"objection",label:"Requiere validación humana",priority:"high",handoff:true,followupSuggested:true,
   nextAction:"Solicitar validación humana de garantía o condición especial; no prometer características no verificadas."};
 }
 if(/(cotiz|precio exacto|cu[aá]nto cuesta|descuento|cu[aá]ntos te quedan|disponib|stock|env[ií]o)/.test(content)){
  return {key:"quote",label:"Solicita cotización",priority:"medium",handoff:true,followupSuggested:true,
   nextAction:"Revisar precio y stock con asesor, y registrar oportunidad sin dar montos inventados."};
 }
 return {key:"exploring",label:"Exploración de productos",priority:"normal",handoff:false,followupSuggested:false,
  nextAction:"Descubrir uso, presupuesto y prioridades; orientar hacia un máximo de dos opciones verificadas."};
}
