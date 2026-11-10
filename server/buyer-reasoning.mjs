import {salesMoveInstructions} from "./sales-playbook.mjs";
import {matchCustomerProduct,quantityForAnyCatalogItem,affirmativeProductText} from "./catalog-matching.mjs";
import {classifyCustomerTopic,customerTopicInstructions,isExplicitProductSwitch,needsPostSaleSpecialist} from "./customer-topic.mjs";
import {consumerRightsGuidance} from "./peru-consumer-knowledge.mjs";
/**
 * Shared sales-reasoning for WhatsApp and the supervised CRM agent.
 * Grounded facts ONLY from customer turns. No extra OpenAI calls, personal
 * details, identity guesses, promised actions or probabilistic conversion.
 */
const norm=(v)=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
const RX={
  device:/\b(?:laptops?|notebooks?|computadoras?|pcs?|impresoras?|tablets?|celulares?|telefonos?|smartphones?|equipos?)\b/u,
  purchase:/\b(?:quiero comprar(?:lo|la|los|las)?|voy a comprar(?:lo|la|los|las)?|lo compro|la compro|los compro|las compro|me lo llevo|me la llevo|como pago|donde pago|pasame (?:el|un) (?:link|enlace) de pago|confirmo la compra|procedamos con (?:la )?compra|(?:siguiente paso|como hago|que sigue|como procedo)\s+(?:para\s+)?comprar(?:lo|la|los|las)?|(?:siguiente paso|que sigue)\s+para\s+(?:la\s+)?compra)\b/u,
  cancelPurchase:/\b(?:ya no (?:quiero|voy a) comprar|no (?:quiero|voy a) comprar|cancele? (?:la )?compra|no me interesa comprar|no comprare|mejor no compro)\b/u,
  quotation:/\b(?:cotizaci[oó]n|cotizar|cotizame|cotiza|proforma|presupuesto para|orden de compra)\b/u,
  price:/\b(?:precio|cuanto cuestan?|cuanto salen?|cuanto valen?|cuanto esta(?:n)?|a como|a cuanto|cuanto me salen?|cuanto por (?:unidad|las? \d+|los? \d+)|valor del (?:producto|equipo))\b/u,
  compare:/\b(?:compar(?:ar|acion|ame)|cual es mejor|diferencias?|vs\.?\b|versus|otra opcion|alternativas?|que me recomiendas|cual conviene)\b/u,
  objection:/\b(?:muy caro|demasiado caro|esta caro|sta caro|ta caro|precio alto|no hay rebaja|hay rebaja|rebaja|descuentito|no me convence|hay descuento|haces descuento|mas barato|no tengo tanto presupuesto)\b/u,
  complaint:/\b(?:reclamo|denuncia|estafa|devolucion|producto defectuoso|no me llego|me cobraron de mas)\b/u,
  human:/\b(?:quiero hablar con (?:un |una )?(?:asesor|vendedor|persona)|quiero q(?:ue)? un asesor (?:vea|revise|me ayude)|necesito (?:un |una )?asesor|pasame con (?:un |una )?(?:asesor|persona|alguien)|pasame con alguien|pasame (?:a|con) (?:una? )?persona|atencion humana|no quiero (?:hablar con )?(?:un )?robot|quiero que me atienda (?:un |una )?(?:asesor|vendedor|persona)(?: humano| humana)?|(?:puedes|podrian|podr[ií]as) comunicarme con (?:alguien|una persona|un asesor)|quiero (?:atencion|asesoria) (?:de )?(?:un )?humana?)\b/u,
  notHuman:/\b(?:no quiero hablar con (?:un |una )?asesor|no necesito (?:un |una )?asesor)\b/u,
  b2b:/\b(?:mi empresa|para la empresa|para mi empresa|para nuestra empresa|para la oficina|para mi negocio|para mi oficina|mi ruc|corporativ[oa]|entidad publica|para el personal|para nuestros empleados|compra institucional|licitacion|orden de compra)\b/u,
  deadline:/\b(?:urgente|lo necesito hoy|para hoy|para manana|esta semana|antes del viernes|entrega inmediata)\b/u,
  confirmation:/^(?:si|ok|okay|dale|perfecto|de acuerdo|correcto|esta bien|listo)[!. ]*$/u,
  thanks:/^(?:gracias(?: por todo)?|muchas gracias|nada mas|eso seria todo|listo gracias)[!. ]*$/u,
  budget:/\b(?:presupuesto|presupuestado|maximo|puedo gastar|cuento con|hasta|dispongo de)\b/u,
  compatibility:/\b(?:sirve|funciona|compatible|compatibilidad|se adapta|conector|potencia|puerto|watts?|65w|carga mi)\b/u,
  delivery:/\b(?:entrega(?:n|r)?|despacho|env[ií]o|llega(?:r[áa])?|delivery)\b/u
};
const numberWords={un:1,una:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10};
const amountValue=(s)=>{
  let n=norm(s).replace(/\s+/g,"");
  if(Object.hasOwn(numberWords,n))return numberWords[n];
  if(!/^\d{1,3}$/.test(n))return null;
  const value=Number(n);return value>=1&&value<=999?value:null;
};
function parseQuantity(text,{allowBareCorrection=false}={}){
 const results=[];
 const devicePattern=/(?:^|[\s,.;:])(?:necesito|quiero|requiero|comprar|cotizar|busco|serian|son|para)?\s*(\d{1,3}|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(laptops?|notebooks?|computadoras?|pcs?|impresoras?|tablets?|celulares?|telefonos?|smartphones?|equipos?)\b/gu;
 for(const m of text.matchAll(devicePattern)){
   const n=amountValue(m[1]);if(n!==null)results.push({index:m.index,quantity:n});
 }
 const alternative=/(?:mejor|cambi(?:amos|a|e)|en vez de|ahora (?:son|quiero|necesito|serian)|(?:no[o]?\s+)?era[n]?|quise decir|son|me equivoque[,:]?\s*(?:eran?|son)?)\s*(\d{1,3}|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/gu;
 if(allowBareCorrection)for(const m of text.matchAll(alternative)){
   const n=amountValue(m[1]);if(n!==null)results.push({index:m.index,quantity:n});
 }
 // Distinguish a sales quantity ("precio x 5", "precio x5") from a model
 // name ("Armor X13", "X12 Pro"). A bare x13 is a MODEL, not 13 units.
 for(const m of text.matchAll(/\b(?:precio\s+)?x\s+(\d{1,3})\b|\b(?:precio|cotiza|llev[oa]|quiero|necesito)\s+x(\d{1,3})\b|\b(?:si llevo|llevo|por los|serian los)\s+(\d{1,3})\b/gu)){
   const q=amountValue(m[1]||m[2]||m[3]);if(q!==null)results.push({index:m.index,quantity:q});
 }
 results.sort((a,b)=>a.index-b.index);
 return results.at(-1)?.quantity??null;
}
function parseBudget(text){
 // Budget only when explicitly contextualized; never infer from an asked price.
 const re=/\b(?:presupuesto(?:\s+(?:total|aproximado|maximo|por unidad))?(?:\s+(?:es|de|sera|seria))?|puedo gastar|cuento con|maximo(?:\s+de)?|dispongo de|hasta)\s*(?:unos?|aprox(?:imadamente)?|de)?\s*(?:s\/\.?\s*|soles?\s*)?(\d{1,3}(?:[.,]\d{3})+|\d{3,6})\s*(?:soles)?\b/gu;
 const matches=[...text.matchAll(re)];
 if(!matches.length)return null;
 const last=matches.at(-1);
 const n=Number(last[1].replace(/[.,]/g,""));
 if(!Number.isFinite(n)||n<=0||n>1000000)return null;
 const around=text.slice(Math.max(0,last.index-15),Math.min(text.length,last.index+last[0].length+30));
 const scope=/\b(?:por (?:equipo|unidad|cada uno)|cada (?:equipo|uno)|unitario)\b/u.test(around)?
   "por_unidad":/\b(?:en total|por todos|total|entre todos)\b/u.test(around)?"total":"sin_aclarar";
 return {pen:n,scope};
}
function parseBrand(text){
 const m=[...text.matchAll(/\b(lenovo|epson|ulefone|msi|hp|asus|motorola|xiaomi|samsung|apple|brother|canon|dell|acer|huawei|logitech|genius|razer|microsoft|dji|jbl)\b/gu)].at(-1);
 return m?m[1].toUpperCase():null;
}
function parseUseCase(text){
 const match=[...text.matchAll(/\b(?:para|en|lo (?:usare|usaria) en|la (?:usare|usaria) en)\s+(?:mi |la |el |un |una )?(construccion|obra|campo|almacen|oficina|empresa|colegio|estudio|universidad|reparto|trabajo|gaming)\b/gu)].at(-1);
 return match?match[1]:null;
}
function classifyLatest(text){
 if(!text)return "sin_mensaje";
 const topic=classifyCustomerTopic(text);
 if(RX.cancelPurchase.test(text))return "compra_cancelada";
 if(RX.notHuman.test(text))return "consulta";
 if(RX.human.test(text))return "asesor";
 if(["estado_reclamo","devolucion_reclamo","soporte_tecnico","pedido_existente","plazo_reclamo","libro_reclamaciones","estado_derivacion"].includes(topic))return "postventa";
 if(topic==="facturacion_pago")return "consulta_facturacion";
 if(topic==="garantia")return "consulta_garantia";
 if(topic==="privacidad")return "consulta_privacidad";
 if(topic==="fuera_del_negocio")return "consulta_ajena";
 if(topic==="explicacion_tecnica")return "explicacion_tecnica";
 if(RX.complaint.test(text))return "postventa";
 if(RX.purchase.test(text))return "comprar";
 if(RX.objection.test(text))return "objecion";
 if(RX.compare.test(text)&&!/\b(?:no (?:quiero|necesito|me interesa|deseo) (?:comparar|comparaciones?|alternativas?|otras opciones)|sin (?:comparar|comparaciones?))\b/u.test(text))return "comparar";
 if(RX.quotation.test(text))return "cotizar";
 if(RX.price.test(text))return "consultar_precio";
 if(RX.compatibility.test(text))return "compatibilidad";
 if(RX.delivery.test(text))return "entrega";
 if(RX.thanks.test(text)||/\b(?:gracias,? por ahora (?:lo )?voy a pensar|lo (?:voy a|tengo que) pensar|por ahora (?:solo )?estoy averiguando,? gracias|por el momento nada mas)\b/u.test(text))return "despedida";
 if(RX.confirmation.test(text))return "confirmacion";
 if(/\b(?:hay|tienen|tienes|disponible|stock|entrega)\b/u.test(text))return "disponibilidad";
 return "consulta";
}
export function buildBuyerContext(customerTurns,{leadProfile=null,catalog=[],memory=null}={}){
 const turns=(Array.isArray(customerTurns)?customerTurns:[]).filter(x=>typeof x==="string"&&x.trim()).slice(-200);
 const state={
  quantity:Number.isInteger(memory?.quantity)&&memory.quantity>=1&&memory.quantity<=999?memory.quantity:null,
  budget:memory?.budget?.pen>0?memory.budget:null,
  brand:typeof memory?.brand==="string"?memory.brand:null,
  use_case:typeof memory?.use_case==="string"?memory.use_case:null,
  buyer_type:"sin_confirmar",is_b2b_signal:false,
  current_intent:"sin_mensaje",current_topic:"comercial",last_message:"",
  mentioned_product_family:null,product_switched:false,objection:false,urgency:false,
  explicit_purchase:false,cancelled_purchase:false,
  known_facts:[],next_step:"responder_consulta",requires_human:false,matched_partnumber:null,customer_reference:null
 };
 // A stored partnumber is a hint, not verified evidence: validate against this
 // request's freshly retrieved catalogue before using it for price/stock.
 const remembered=(Array.isArray(catalog)?catalog:[]).find(x=>x?.partnumber===memory?.selected_partnumber);
 if(remembered){
  state.matched_partnumber=remembered.partnumber;
  state.mentioned_product_family=remembered.titulo||remembered.title||null;
 }
 if(typeof memory?.customer_reference==="string")state.customer_reference=memory.customer_reference;
 let b2bExplicit=false,productSeen=Boolean(memory?.selected_partnumber||memory?.customer_reference);
 let requestedAdvisor=memory?.requires_human===true;
 for(const raw of turns){
  const text=norm(raw).slice(0,1600);
  if(RX.device.test(text))productSeen=true;
  const affirmative=affirmativeProductText(raw);
  const matching=matchCustomerProduct(affirmative,catalog);
  if(matching){
   state.product_switched=false;
   state.mentioned_product_family=matching.name;
   state.matched_partnumber=matching.partnumber||null;
   productSeen=true;
  }
  const q=quantityForAnyCatalogItem(raw,catalog) ??
    parseQuantity(text,{allowBareCorrection:state.quantity!==null});
  if(q!==null)state.quantity=q;
  const budget=parseBudget(text);
  if(budget)state.budget=budget;
  const brand=matching?.brand||parseBrand(text);
  // Explicit product changes trump an old SKU even when the new catalogue
  // query returns ZERO rows (in that case remembered wasn't revalidated).
  if(isExplicitProductSwitch(raw)&&!matching&&
     (state.matched_partnumber||memory?.selected_partnumber||state.customer_reference||state.brand)){
    state.matched_partnumber=null;
    state.mentioned_product_family=null;
    state.customer_reference=null;
    state.product_switched=true;
    if(q===null)state.quantity=null;
    state.brand=null;
  }
  if(brand)state.brand=brand;
  const useCase=parseUseCase(text);
  if(useCase)state.use_case=useCase;
  if(RX.b2b.test(text))b2bExplicit=true;
  if((RX.human.test(text)&&!RX.notHuman.test(text))||needsPostSaleSpecialist(text))requestedAdvisor=true;
  if(RX.notHuman.test(text)||/\b(?:prefiero seguir aqui|quiero continuar con el bot|con alex esta bien)\b/u.test(text))requestedAdvisor=false;
  const modelCodes=[...String(affirmative).matchAll(/\b(?=[A-Z0-9._-]{5,}\b)(?=[A-Z0-9._-]*[A-Z])(?=[A-Z0-9._-]*\d)[A-Z0-9._-]+\b/giu)].map(x=>x[0]);
  const reference=modelCodes.find(x=>!/^\d+(?:GB|TB|W|HZ|MAH)$/iu.test(x)&&!/^S\d+$/iu.test(x));
  if(reference){
   // An explicitly named different model invalidates any SKU kept from an older turn.
   // Without this, a price from the previous product could be presented as the new one.
   state.customer_reference=reference;
   const candidate=String(reference).toUpperCase();
   const sameMatchedProduct=Boolean(matching&&(
     String(matching.partnumber||"").toUpperCase()===candidate||
     String(matching.name||"").toUpperCase().includes(candidate)
   ));
   if(!sameMatchedProduct){
     state.product_switched=true;
     state.matched_partnumber=null;
     state.mentioned_product_family=null;
     state.brand=parseBrand(text);
   }
  }else if(matching){
   // Clear a historical unknown model when the buyer switches back to a known item.
   state.customer_reference=null;
  }

 }
 state.last_message=norm(turns.at(-1)).slice(0,1500);
 state.current_topic=classifyCustomerTopic(state.last_message);
 state.current_intent=classifyLatest(state.last_message);
 state.explicit_purchase=state.current_intent==="comprar";
 state.cancelled_purchase=state.current_intent==="compra_cancelada";
 state.objection=state.current_intent==="objecion";
 state.urgency=RX.deadline.test(state.last_message) &&
  !/\b(?:no es urgente|ya no es urgente|sin apuro|sin prisa|no (?:lo )?necesito urgente)\b/u.test(state.last_message);
 state.requires_human=requestedAdvisor||state.current_intent==="asesor"||Boolean(leadProfile?.requires_human);
 state.is_b2b_signal=b2bExplicit||(state.quantity!==null&&state.quantity>=2&&productSeen);
 state.buyer_type=b2bExplicit?"empresa_indicada":state.is_b2b_signal?"posible_b2b":"sin_confirmar";
 if(state.quantity!==null)state.known_facts.push("cantidad solicitada: "+state.quantity+" unidades (no asumir tipo de producto)");
 if(state.budget)state.known_facts.push("presupuesto comunicado: S/ "+state.budget.pen+" ("+state.budget.scope+")");
 if(state.brand)state.known_facts.push("marca mencionada: "+state.brand);
 if(state.use_case)state.known_facts.push("uso indicado: "+state.use_case);
 if(state.mentioned_product_family)state.known_facts.push("producto identificado en el catálogo: "+state.mentioned_product_family);
 if(state.customer_reference)state.known_facts.push("referencia indicada por cliente, pendiente de validar en catálogo: "+state.customer_reference);
 if(state.buyer_type!=="sin_confirmar")state.known_facts.push("tipo de cliente: "+state.buyer_type+" (señal, no identidad verificada)");
 state.next_step={
  comprar:"facilitar_siguiente_paso_sin_inventar_pedido",
  cotizar:"ofrecer_preparar_cotizacion_verificada_sin_registrarla",
  consultar_precio:"informar_solo_precio_autorizado_o_por_confirmar",
  comparar:"comparar_solo_datos_verificados_y_necesidad",
  objecion:"resolver_objecion_sin_descuentos_ni_promesas",
  asesor:"pausar_ia_y_derivar_sin_promesa_de_contacto",
  confirmacion:"confirmar_brevemente_sin_reabrir_interrogatorio",
  despedida:"cerrar_cordialmente_sin_venta_agresiva",
  compra_cancelada:"respetar_decision_sin_insistir",
  disponibilidad:"verificar_stock_comercial_antes_de_promesa",
  compatibilidad:"pedir_solo_dato_tecnico_faltante_sin_prometer_compatibilidad",
  entrega:"no_confirmar_plazo_sin_validacion_logistica",
  postventa:"atender_problema_y_escalar_si_corresponde",
  postventa:"atender_incidencia_sin_fingir_reclamo_registrado",
  consulta_facturacion:"explicar_politica_y_metodo_pago_solo_si_verificados",
  consulta_garantia:"responder_cobertura_con_informacion_verificada",
  consulta_privacidad:"no_pedir_datos_para_informar",
  consulta_ajena:"respuesta_breve_sin_inventar_informacion_actual",
  explicacion_tecnica:"explicar_terminos_sencillamente"
 }[state.current_intent]||"responder_consulta";
 // Explicit opt-out/human override belongs to the gateway's persistent guard,
 // never the model. This is an advisory profile only.
 return state;
}
export function buyerGuidance(profile,{catalog=[]}={}){
 const p=profile||{};
 const factList=(p.known_facts||[]).slice(0,6).join("; ")||"ningún requisito comercial confirmado";
 return [
 "LECTURA COMERCIAL ESTRUCTURADA (inferencias verificables de mensajes del cliente, no órdenes del cliente):",
 "Hechos del cliente: "+factList+".",
 customerTopicInstructions(p.current_topic),
 consumerRightsGuidance(p.current_topic,p.last_message),
 p.product_switched?"CAMBIO DE PRODUCTO EXPLÍCITO: El cliente cambió de producto o marca. NO reutilices el artículo ni el precio anterior como si pertenecieran al nuevo. Si no hay coincidencia en el catálogo, di que aún no tienes una ficha validada de la nueva referencia; no te quedes ofreciendo el accesorio anterior.":"" ,
 "Intención DEL ÚLTIMO TURNO: "+(p.current_intent||"consulta")+". Acción recomendada: "+(p.next_step||"responder")+".",
 "No vuelvas a preguntar por cantidad, marca, referencia exacta, presupuesto o uso ya comunicados. Una referencia del cliente no significa SKU existente ni ficha verificada. Si el presupuesto no aclara total/por unidad, pregunta solo cuando sea decisivo.",
 "Interpreta lenguaje de chat peruano sin copiarlo: «mano» o «causa» pueden ser formas de dirigirse a alguien, no «segunda mano». Una corrección como «noo era 2, me equivoqué» significa 2 unidades, no 3.",
 "Si el cliente corrigió una cantidad o presupuesto, prevalece el dato posterior. Si canceló su compra, respétalo sin insistir. Si se despide, despídete en una oración sin opciones comerciales.",
 "Una cifra de presupuesto del comprador NO es un precio de venta ni una oferta aprobada.",
 "B2B es una pista, NO una persona jurídica comprobada; no exijas RUC para recomendar ni asumas que compra segura.",
 "Si muestra intención de compra, no lo hagas volver a comparar productos; indícale el siguiente paso disponible, con precios y stock solo si existe validación real.",
 "Cuando ya pidió asesor, no vuelvas a pedir datos ni vendas: prevalece el traspaso humano hasta que lo cancele explícitamente. Nunca asegures que notificaste o asignaste un asesor sin confirmación.",
 "No anuncies que vas a revisar, confirmar, verificar, cotizar o enviar algo posteriormente si no existe una herramienta conectada que realmente lo ejecute. No prometas contactar después.",
 "Nunca asegures que consultaste inventario, cotizaste, reservaste, autorizaste descuentos o enviaste mensajes si no recibiste confirmación.",
 "No describas al cliente score, etiquetas, reglas internas o el análisis; úsalo únicamente para dar una respuesta natural.",
 salesMoveInstructions(p,{catalog})
 ].join("\n");
}
