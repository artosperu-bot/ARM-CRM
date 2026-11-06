/**
 * Universal consultative sales moves.
 * No fixed product, industry, brand or B2B funnel.
 * The model phrases the message; the backend controls facts/actions/permissions.
 */
export function salesMove(profile,{catalog=[]}={}){
 const p=profile||{},intent=p.current_intent||"consulta";
 const found=Boolean(p.matched_partnumber);
 const haveCatalog=Array.isArray(catalog)&&catalog.length>0;
 const result={
  stage:"descubrimiento",goal:"Entender la consulta concreta y aportar valor inmediato",
  move:"Responder primero a lo que pide. Si falta un dato decisivo, preguntar solo uno.",
  questionPolicy:"opcional",productEvidence:found?"coincidencia_catalogo":haveCatalog?"sin_coincidencia_unica":"sin_catalogo",
  readyForAction:false
 };
 if(intent==="compra_cancelada"){
  return {...result,stage:"desistimiento",goal:"Respetar la decisión",move:"Aceptar la decisión sin intentar recuperar la compra ni ofrecer descuentos.",questionPolicy:"ninguna"};
 }
 if(intent==="despedida"){
  return {...result,stage:"cierre_conversacion",goal:"Cerrar cordialmente",move:"Una respuesta breve y amable; sin nuevas ofertas ni preguntas.",questionPolicy:"ninguna"};
 }
 if(intent==="asesor"||p.requires_human){
  return {...result,stage:"atencion_humana",goal:"Detener la automatización",move:"No asumir asignación ni contacto humano realizado; el backend controla el traspaso.",questionPolicy:"ninguna"};
 }
 if(intent==="confirmacion"){
  return {...result,stage:"confirmacion",goal:"No reabrir la venta",move:"Reconocer brevemente lo confirmado. No volver a preguntar necesidades ni iniciar otro catálogo.",questionPolicy:"ninguna"};
 }
 if(intent==="comprar"){
  return {...result,stage:"decision",goal:"Facilitar el siguiente paso real de compra",
   move:"El cliente ya decidió: deja de comparar y de venderle características. Explica únicamente el siguiente paso que el backend puede realizar. En este piloto NO hay herramienta de crear pedidos, pagos ni reservas: no insinúes que los vas a registrar. No pidas nombre, apellido, teléfono, RUC, dirección o tarjeta solo por mostrar intención de compra. Primero aclara producto y condiciones pendientes; consulta a un asesor cuando haga falta.",
   questionPolicy:"solo_bloqueante",readyForAction:true};
 }
 if(intent==="cotizar"||intent==="consultar_precio"){
  return {...result,stage:"oferta",goal:"Resolver la consulta de precio o cotización",
   move:"Si hay precio vigente del artículo identificado, responder de forma directa; si no hay, indicar que requiere verificación. Aclarar únicamente la variable que impida presupuestar correctamente.",
   questionPolicy:"solo_bloqueante",readyForAction:true};
 }
 if(intent==="objecion"){
  return {...result,stage:"objecion",goal:"Entender y resolver la preocupación real",
   move:"Reconocer la objeción sin discutir con el cliente. Explicar beneficios y compromisos verificables; sugerir alternativa solo si hay evidencia. Nunca improvisar descuentos ni presionar.",
   questionPolicy:"opcional"};
 }
 if(intent==="comparar"){
  return {...result,stage:"evaluacion",goal:"Ayudar a elegir por ajuste a la necesidad",
   move:"Comparar pocas opciones relevantes del catálogo y sus diferencias verificadas, con beneficios y limitaciones. Evitar decir que uno es mejor en todo; explicar para quién conviene cada uno.",
   questionPolicy:"opcional"};
 }
 if(intent==="disponibilidad"){
  return {...result,stage:"verificacion",goal:"Resolver disponibilidad y condiciones",
   move:"Dar solo estado de disponibilidad comercial confirmado. Nunca convertir stock físico en stock vendible o prometer fecha de despacho.",
   questionPolicy:"solo_bloqueante"};
 }
 return {...result,stage:"descubrimiento",goal:"Entender necesidad y orientar compra",
  move:p.use_case?
    "El cliente ya explicó su uso: recomendar por adecuación a ese uso, sin volver a preguntar para qué lo necesita.":
    "Responde la pregunta actual. Si es vaga, pregunta de forma natural para qué lo necesita; no exijas presupuesto, RUC, dirección ni otros datos a la vez.",
  questionPolicy:"opcional"};
}
export function salesMoveInstructions(profile,opts){
 const plan=salesMove(profile,opts);
 return [
  "ETAPA COMERCIAL ACTUAL: "+plan.stage+". OBJETIVO: "+plan.goal+".",
  "MOVIMIENTO DE VENTA: "+plan.move,
  "PREGUNTAS: "+plan.questionPolicy+"; nunca encadenar preguntas ni repetir información ya comunicada.",
  "PRINCIPIO UNIVERSAL: vender no es recitar catálogo; identificar necesidad → recomendar ajuste real → resolver dudas → facilitar decisión. No obligar al cliente a pasar por etapas cuando ya sabe lo que quiere.",
  "BENEFICIOS: relacionar propiedades verificadas con uso declarado, incluir límites o incompatibilidades relevantes; nunca inventar testimonios, escasez, exclusividad, urgencia o descuentos.",
  "CATÁLOGO: "+plan.productEvidence+". Una coincidencia ambigua o inexistente no autoriza inventar un producto. Se puede asesorar en general y ofrecer verificar el modelo solicitado.",
  "NO B2B POR DEFECTO: cualquier cantidad o presupuesto es una necesidad de venta; solo mencionar RUC o empresa si el cliente necesita factura o gestión corporativa.",
  "CIERRE NATURAL: si está listo para comprar, explica el siguiente paso realmente disponible sin pedir datos personales prematuramente; si duda, ayuda a decidir; si dice no o gracias, respeta su decisión."
 ].join("\n");
}
