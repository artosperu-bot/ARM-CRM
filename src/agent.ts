export type BuyerIntent = "cotizacion" | "disponibilidad" | "comparacion" | "posventa" | "consulta";
export function detectBuyerIntent(text: string): BuyerIntent {
  const s = text.toLocaleLowerCase("es");
  if (/reclamo|garant[ií]a|devoluci[oó]n|falla|reparaci[oó]n/.test(s)) return "posventa";
  if (/compar|diferencia|versus|vs\b/.test(s)) return "comparacion";
  if (/stock|disponib|tienen|hay\s|entrega|llega/.test(s)) return "disponibilidad";
  if (/precio|cu[aá]nto|cotiz|comprar|descuento|pagar/.test(s)) return "cotizacion";
  return "consulta";
}
export function createSafeDraft(message: string): string {
  const intent = detectBuyerIntent(message);
  switch (intent) {
    case "disponibilidad":
      return "¡Hola! Con gusto te ayudo. Primero voy a confirmar el modelo exacto y la disponibilidad vigente antes de ofrecerte una entrega. ¿Qué modelo o característica buscas?";
    case "cotizacion":
      return "¡Hola! Puedo prepararte una cotización. ¿Qué producto o modelo te interesa? Verificaré el precio y stock actuales antes de confirmarlos.";
    case "comparacion":
      return "¡Hola! Puedo ayudarte a comparar opciones según tu uso y presupuesto. Cuéntame qué modelos te interesan; revisaré sus fichas técnicas verificadas.";
    case "posventa":
      return "Gracias por escribirnos. Voy a derivar tu caso a atención posventa para validar tu compra y ayudarte con el procedimiento correspondiente.";
    default:
      return "¡Hola! Bienvenido a STECH. Cuéntame qué necesitas y te ayudaré a elegir una opción adecuada, verificando los datos antes de confirmarlos.";
  }
}
