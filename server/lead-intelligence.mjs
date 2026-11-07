// Deterministic sales triage. This is a conservative, explainable signal filter,
// not a probability of purchase, nor a replacement for a sales agent's judgment.
// It never sends messages, schedules follow-ups or creates deals.
import {buildBuyerContext} from "./buyer-reasoning.mjs";
const clean=(s)=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
const includes=(text,re)=>re.test(text);
const RE={
 optout:/\b(?:no me (?:escribas|escriban|contactes|contacten)|no (?:quiero|deseo) (?:mas )?(?:mensajes|contacto|publicidad)|(?:darme|dame) de baja|cancelar suscripcion|deja(?:n)? de escribirme|stop|unsubscribe|bloqueame)\b/u,
 optin:/\b(?:si (?:quiero|pueden|puedes) (?:que me (?:escriban|contacten)|recibir mensajes)|autorizo (?:el contacto|que me contacten)|pueden volver a escribirme|reanudar contacto)\b/u,
 human:/\b(?:quiero (?:hablar|conversar) con (?:un |una )?(?:humano|persona|asesor|vendedor)|pasame con (?:un |una )?(?:asesor|vendedor|persona)|atencion humana|comunicarme con (?:un |una )?(?:asesor|vendedor)|necesito un asesor|quiero que me atienda (?:un |una )?(?:asesor|vendedor|persona)(?: humano| humana)?|(?:puedes|podrian|podrias) comunicarme con (?:alguien|una persona|un asesor))\b/u,
 complaint:/\b(?:reclamo|denuncia|estafa|producto defectuoso|me llego (?:mal|roto)|no me llego|quiero devol(?:ver|ucion)|me cobraron de mas)\b/u,
 purchase:/\b(?:lo compro|la compro|los compro|quiero comprar|voy a comprar|me lo llevo|donde pago|como (?:realizo|hago) el pago|pasame (?:el|tu) (?:link|enlace) de pago|quiero hacer (?:el )?pedido|procedamos con la compra)\b/u,
 quote:/\b(?:cotiza(?:cion|r|me)|presupuesto|proforma|precio|cuanto (?:cuesta|vale|sale)|a como|valor del (?:equipo|producto)|factura|orden de compra)\b/u,
 compare:/\b(?:compar(?:a|acion|ame|ar)|diferencias?|cual (?:es )?mejor|otra opcion|alternativas?|recomiendas?|conviene)\b/u,
 objection:/\b(?:muy caro|demasiado caro|hay descuento|haces descuento|precio alto|mas barato|se me hace caro|no me convence)\b/u,
 business:/\b(?:mi empresa|para la empresa|para una empresa|para mi negocio|para mi oficina|para (?:nuestro|nuestra) (?:personal|equipo|empresa)|ruc|corporativ[oa]s?|licitacion|entidad publica|oficina|b2b|compras empresariales|compras del estado)\b/u,
 urgent:/\b(?:lo necesito (?:hoy|manana|urgente)|para hoy|para manana|esta semana|urgente|de inmediato)\b/u,
 budget:/\b(?:mi presupuesto|tengo (?:de )?presupuesto|puedo gastar|hasta s\/?\s*\d|hasta \d{3,}(?:\b|$))\b/u,
 product:/\b(?:armor[\s-]?(?:22|x13|x12|25t)|ulefone|lenovo|epson|laptop|notebook|computadora|pc|impresora|tablet|celular|telefono|smartphone)\b/u,
 availability:/\b(?:stock|disponib(?:le|ilidad)|tienen|hay unidades|entrega inmediata)\b/u
};
const quantity=text=>{
 const m=text.match(/\b(\d{1,3})\s*(?:laptops?|computadoras?|pcs?|impresoras?|tablets?|celulares?|telefonos?|equipos?)\b/u)
 ||text.match(/\b(?:necesito|quiero|requiero|comprar|cotizar)\s*(\d{1,3})\b/u);
 if(!m)return null;
 const n=Number(m[1]);return Number.isInteger(n)&&n>=1&&n<=999?n:null;
};
export function analyzeSalesConversation(messages,{
 threadStatus="pending",assignedTo=null,previousOptOut=false,sourceMode="sandbox"
}={}){
 const inbound=(Array.isArray(messages)?messages:[])
   .filter(m=>m?.direction==="inbound"&&typeof m.content==="string"&&m.content.trim())
   .slice(-16);
 const latest=clean(inbound.at(-1)?.content);
 const journey=buildBuyerContext(inbound.map(m=>m.content));
 const purchaseCancelled=journey.current_intent==="compra_cancelada";
 const conversationFinished=journey.current_intent==="despedida";
 const body=clean(inbound.map(m=>m.content).join(" "));
 const has=(key)=>includes(body,RE[key]);
 const signals=[];
 const add=(cond,label)=>{if(cond)signals.push(label);};
 const deniedHuman=/\b(?:no quiero hablar con|no necesito (?:un |una )?asesor)\b/u.test(latest);
 const askedHuman=(includes(latest,RE.human)&&!deniedHuman)||includes(latest,RE.complaint);
 const explicitStop=includes(latest,RE.optout);
 const explicitResume=includes(latest,RE.optin);
 const optOut=explicitStop||(Boolean(previousOptOut)&&!explicitResume);
 const human=threadStatus==="human"||Boolean(assignedTo)||askedHuman;
 const closed=threadStatus==="closed";
 const amount=quantity(body);
 const isBusiness=has("business")||(amount!==null&&amount>=2&&has("product"));
 const askedPrice=has("quote");
 const intendsBuy=has("purchase")&&!purchaseCancelled&&!conversationFinished;
 const comparison=has("compare");
 const objection=has("objection");
 const urgency=has("urgent");
 const product=has("product");
 const budget=has("budget");
 add(intendsBuy,"compra_explicita");
 add(purchaseCancelled,"compra_cancelada");
 add(conversationFinished,"conversacion_finalizada");
 add(askedPrice,"precio_cotizacion");
 add(isBusiness,"cliente_empresa_o_volumen");
 add(comparison,"comparacion");
 add(objection,"objecion");
 add(urgency,"plazo_corto");
 add(budget,"presupuesto_indicado");
 add(product,"producto_identificado");
 add(askedHuman,"requiere_persona");
 add(optOut,"no_contactar");
 const score=optOut||closed?0:purchaseCancelled||conversationFinished?10:Math.min(100,Math.max(5,
   10+(intendsBuy?38:0)+(askedPrice?17:0)+(isBusiness?15:0)+
   (comparison?8:0)+(urgency?12:0)+(budget?8:0)+(product?8:0)-
   (objection&&!intendsBuy?8:0)));
 const intent=optOut?"no_contactar":askedHuman?"atencion_humana":purchaseCancelled||conversationFinished?"consulta_general":intendsBuy?"compra":
   askedPrice?"cotizacion":comparison?"comparacion":objection?"objecion":
   product?"consulta_producto":"consulta_general";
 const priority=optOut||closed?"sin_contacto":human||score>=65?"alta":score>=35?"media":"baja";
 const suppressionReason=optOut?"opt_out":closed?"conversacion_cerrada":human?"atencion_humana":"sin_consentimiento_de_seguimiento";
 const nextAction=optOut?"No contactar; respetar baja solicitada":
   purchaseCancelled?"Respetar la decisión de no comprar; no insistir ni crear seguimiento":
   conversationFinished?"Cerrar cordialmente sin reactivar oferta ni seguimiento":
   closed?"Conversación cerrada; no reabrir automáticamente":
   human?"Revisión por asesor; pausar respuestas automáticas":
   intendsBuy?"Facilitar compra solo con precio, stock y condiciones verificadas":
   askedPrice?"Preparar cotización con información comercial verificada":
   comparison?"Comparar opciones y resolver la necesidad principal":
   objection?"Aclarar objeción con datos comprobables":
   "Responder la consulta y esperar una señal concreta de interés";
 return {
  intent,score,priority,is_b2b:isBusiness,quantity_min:amount,
  signals,requires_human:human,opt_out:optOut,
  followup_suppressed:true,suppression_reason:suppressionReason,
  next_action:nextAction,source_mode:sourceMode==="real"?"real":"sandbox",
  should_reply:!optOut&&!human&&!closed,
  last_message_id:inbound.at(-1)?.external_message_id||null
 };
}
export function immediateStop(text){
 const normalized=clean(text);
 return RE.optout.test(normalized)||(RE.human.test(normalized)&&!/\b(?:no quiero hablar con|no necesito (?:un |una )?asesor)\b/u.test(normalized))||RE.complaint.test(normalized);
}
