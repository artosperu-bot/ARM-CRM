/**
 * Universal customer-service routing. Intent (buying vs browsing) and topic
 * (warranty vs technical support vs billing) are separate axes.
 * These rules route the model; they do NOT assert merchant policies or perform
 * customer-support actions. When no rule matches, the model answers normally.
 */
import {asksFormalComplaintReplyDeadline,asksForComplaintBook,consumerRightsGuidance} from "./peru-consumer-knowledge.mjs";
const norm=(x)=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/gu,"").toLowerCase().replace(/\s+/gu," ").trim();
/** Product-focused retrieval only when the client clearly switches the item,
 * not when they briefly switch to billing, support or an unrelated question. */
export function isExplicitProductSwitch(message){
 const s=norm(message);
 const switchVerb=/\b(?:ahora\s+(?:estoy\s+viendo|quiero|busco|prefiero|me\s+interesa)|mejor\s+(?:quiero|busco|prefiero)|en\s+vez\s+de|cambie?\s+(?:a|por)|regresemos\s+(?:al?|a\s+la)|volvamos\s+(?:al?|a\s+la))\b/u.test(s);
 const productMention=/\b(?:laptops?|notebooks?|computadoras?|pcs?|impresoras?|tablets?|celulares?|telefonos?|cargador(?:es)?|baterias?|camaras?|monitores?|routers?|mouse|teclados?|audifonos?|discos?|licencias?|software|lenovo|epson|ulefone|samsung|apple|brother|asus|acer|dell|microsoft|logitech|jbl|genius|xiaomi|motorola|canon|msi|dji)\b/u.test(s);
 return switchVerb&&productMention;
}
/** Reset only the model's conversational input after an explicit product
 * change. Durable customer facts remain in buyerGuidance; older dialogue must
 * not turn a request for a new tablet into a request for an old charger. */
export function selectCustomerPromptInput(history,lastMessage){
 const current={role:"user",content:String(lastMessage||"")};
 if(isExplicitProductSwitch(current.content))return [current];
 const turns=(Array.isArray(history)?history:[]).filter(x=>
  (x?.role==="user"||x?.role==="assistant")&&typeof x.content==="string");
 if(turns.at(-1)?.role==="user"&&turns.at(-1).content===current.content)return turns;
 return [...turns,current];
}
export function classifyCustomerTopic(message){
 const s=norm(message);
 if(!s)return "comercial";
 if(asksFormalComplaintReplyDeadline(s))return "plazo_reclamo";
 if(asksForComplaintBook(s))return "libro_reclamaciones";
 if(/\b(?:ya (?:le|les) avisaron a alguien|ya me pasaste con el asesor|ya me pasaron con (?:un|el) asesor|ya lo derivaron|ya avisaron al asesor|sigo esperando al asesor)\b/u.test(s))
  return "estado_derivacion";
 if(/\b(?:dni|foto (?:del|de mi) (?:dni|documento)|datos personales|mi privacidad|datos de mi tarjeta|documento de identidad)\b/u.test(s)&&
   /\b(?:necesit|pides?|tengo que|debo|obligatorio|requier|pedir|dar|enviar|entregar|mostrar|foto|seguridad)\b/u.test(s))
  return "privacidad";
 if(/\b(?:ya me (?:abriste|registraste|hiciste|ingresaste) (?:un |el )?(?:reclamo|caso|ticket)|numero de reclamo|libro de reclamaciones|estado de mi reclamo)\b/u.test(s))
  return "estado_reclamo";
 if(/\b(?:devolucion|devuelv[ea]n?|devolver|reembolso|reembols[oa]|cambio inmediato|me la cambian|me lo cambian|me dan otr[oa]|me lo cambian por otr[oa]|quiero otra? (?:unidad|equipo)|me devuelven la plata|me regresan la plata|quiero reclamar|presentar reclamo)\b/u.test(s))
  return "devolucion_reclamo";
 if(/\b(?:no imprime|no enciende|no prende|no funciona|no carga|dejo de funcionar|dejo de imprimir|dejo de prender|falla(?:ndo)?|fallo|se malogro|malogr[oa]|se mojo|llego roto|llego mal|vino roto|llego defectuoso|no sirve|atasco de papel|error (?:e\d+|\d{2,})|pantalla negra|problema con (?:mi|la|el) (?:impresora|celular|laptop|tablet)|servicio tecnico|reparar(?:lo|la)?)\b/u.test(s))
  return "soporte_tecnico";
 if(/\b(?:garantia|cobertura|que cubre|cuanto dura la garantia|condiciones de garantia)\b/u.test(s))
  return "garantia";
 if(/\b(?:factura electronica|factura|boleta|ruc|comprobante|igv|pago con tarjeta|tarjeta de (?:credito|debito)|yape|plin|transferencia bancaria|metodos? de pago|medios? de pago)\b/u.test(s))
  return "facturacion_pago";
 if(/\b(?:mi pedido|donde esta mi pedido|seguimiento (?:de|del) (?:envio|pedido)|guia de envio|numero de tracking|no me llego|no llego nada|paquete no llega|lo pedi hace|ya lo mandaron|ya me lo mandaron|ya lo enviaron|me cobraron)\b/u.test(s))
  return "pedido_existente";
 if(/\b(?:partido de futbol|quien gano (?:el|la) (?:partido|juego)|resultados? (?:de futbol|deportivos)|clima (?:de|para|en|hoy|manana)|pronostico del tiempo|receta de cocina|quien es el presidente)\b/u.test(s))
  return "fuera_del_negocio";
 if(/\b(?:que significa|que quiere decir|cual es la diferencia|explicame que es)\b/u.test(s)&&
   /\b(?:ram|ssd|hdd|procesador|gpu|usb-c|displayport|hdmi|office|licencia|dpi|impresion|bluetooth|wifi)\b/u.test(s))
  return "explicacion_tecnica";
 return "comercial";
}
const instructions={
 privacidad:"PRIVACIDAD: Responde directamente si hace falta DNI, RUC, teléfono o foto: para información y recomendaciones no es necesario compartir documentos ni datos personales. No los pidas por costumbre. Para una gestión específica indica únicamente el requisito confirmado si existe evidencia.",
 plazo_reclamo:"PLAZO LEGAL: Responde de forma directa y corta el plazo de respuesta del Libro de Reclamaciones. No lo confundas con días para devolución ni con garantía.",
 libro_reclamaciones:"LIBRO DE RECLAMACIONES: Orienta sobre el acceso al Libro físico o virtual, sin inventar un enlace particular de STECH. No digas que abriste un reclamo en nombre del cliente.",
 estado_derivacion:"ESTADO DE ASESOR: El cliente pregunta si ya se avisó a alguien. No afirmes que un asesor fue notificado/asignado si no hay confirmación del backend. Responde en una oración sencilla, sin pedir de nuevo nombre, teléfono o documento.",
 estado_reclamo:"ESTADO DE RECLAMO: Es una pregunta sobre una gestión supuestamente realizada. NO afirmes que existe ticket, reclamo, número de caso, asesor asignado, registro ni actualización sin consulta al sistema. Explica con cercanía que no puedes confirmar un registro desde aquí y que requiere comprobación real. No cambies de tema hacia la venta.",
 devolucion_reclamo:"DEVOLUCIONES Y RECLAMOS: Reconoce el inconveniente en una frase, escucha qué solicita y no inventes cambios inmediatos, reembolsos aprobados, plazos ni políticas de tienda. Ofrece solo el procedimiento efectivamente conocido; si no hay herramienta o política verificada, explica que la solicitud debe ser evaluada por atención al cliente. Nunca digas que abriste o enviaste el caso.",
 soporte_tecnico:"SOPORTE: El cliente pide ayuda con un equipo, no que le vendas otro. Da uno o dos pasos de diagnóstico seguros y reversibles si están sustentados por la información disponible. No asegures una causa, compatibilidad o reparación sin evidencia. No aconsejes acciones riesgosas ni limpiezas profundas como primer paso; ofrece evaluación de servicio técnico cuando sea pertinente, sin fingir que ya la coordinaste.",
 garantia:"GARANTÍA: Contesta la pregunta de condiciones y cobertura con datos verificados, distinguiendo garantía de certificaciones. Si falta política específica, dilo con sencillez; no inventes duración, extensión o exclusiones. Una condición material sí se explica, aunque sea menos atractiva comercialmente.",
 facturacion_pago:"FACTURACIÓN Y MEDIOS DE PAGO: Contesta exactamente la pregunta sobre boleta, factura, RUC, IGV o tarjeta. Sin condiciones del comercio verificadas, NO confirmes que STECH emite cierto comprobante, acepta una tarjeta/monedero o aplica cierto impuesto. No confundas '¿aceptan tarjeta?' con 'ya pagué'. No solicites número de tarjeta, claves ni documentos personales.",
 pedido_existente:"PEDIDO EXISTENTE: No presupongas que hay orden vinculada, pago registrado ni despacho. Sin acceso al historial de pedidos, no inventes estado, número, transportista, rastreo ni promesas de entrega. Distingue ayuda para identificar el pedido de acceso real a registros.",
 fuera_del_negocio:"PREGUNTA AJENA AL NEGOCIO: Responde breve y cordialmente si es posible con conocimientos generales; si requiere información actual, reconoce que no dispones de consulta en tiempo real. No inventes resultados, noticias ni clima. No fuerces venta ni borres el contexto comercial previo; si el cliente regresa, retoma el producto.",
 explicacion_tecnica:"EDUCACIÓN DEL CLIENTE: Explica términos técnicos de manera sencilla con ejemplos prácticos y sin inventar prestaciones de un modelo concreto. Conecta con el uso si es natural, sin vender agresivamente.",
 comercial:"CONSULTA COMERCIAL: Responde la necesidad actual según producto y etapa, sin forzar preguntas ni cambiar al cliente de categoría."
};
export function customerTopicInstructions(topic){
 return "TIPO DE CONSULTA ACTUAL: "+(topic in instructions?topic:"comercial")+". "+(instructions[topic]||instructions.comercial);
}
