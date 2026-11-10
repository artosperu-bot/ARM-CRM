/** Handoff wording must match the action actually confirmed by the backend. */
export const HUMAN_QUEUE_CONFIRMED_REPLY =
 "Tu conversación quedó en cola para atención humana. Aún no puedo confirmar qué asesor la atenderá.";

export function humanHandoffUnconfirmedReply(buyer={}){
 const topic=buyer?.current_topic;
 if(topic==="estado_derivacion")
  return "Aún no tengo confirmación de una derivación o de un asesor asignado desde este chat.";
 if(topic==="pedido_existente"||topic==="estado_reclamo"||topic==="devolucion_reclamo"||topic==="soporte_tecnico"||topic==="garantia")
  return "Tu consulta requiere revisión humana. Desde este chat todavía no se ha confirmado una derivación ni un asesor asignado.";
 return "Entiendo que prefieres hablar con una persona. Desde este chat aún no hay una derivación o un asesor asignado que pueda confirmar.";
}
