/**
 * 20 completely fictional buyer journeys, written as realistic WhatsApp chats.
 * Exactly five end in an explicit decision to buy; none imply an actual order.
 * All identities, amounts, quantities, and intentions are QA-only.
 */
export const conversionJourneys20 = [
 {id:"C01",kind:"decision",name:"Repartidor directo",turns:[
  "buenas, el armor x13 sirve para trabajar en moto?",
  "es que se me caen los celulares seguido, quiero 1",
  "cuanto está y si lo tienen?",
  "ya está, me lo llevo. cómo sigo para comprar?"
 ]},
 {id:"C02",kind:"no_compra",name:"Agotado y alternativa",turns:[
  "oe tienes armor x12 pro? necesito dos",
  "asu y si no hay, cual otro parecido tienes?",
  "cuanto sale el x13 entonces?",
  "ya mejor lo voy a pensar, no me escriban por ahora"
 ]},
 {id:"C03",kind:"decision",name:"Compara y decide",turns:[
  "hola mano cual me conviene, armor 22 o x13? lo uso en obra",
  "y cual tiene más memoria? nada de floro",
  "ok me quedo con 2 armor 22, no con el x13",
  "listo, quiero comprar esos dos. que sigue?"
 ]},
 {id:"C04",kind:"no_compra",name:"Precio objetado",turns:[
  "25t pro cuanto está?",
  "asu bien caro, me haces 30 por ciento de descuento?",
  "y para qué me serviría la cámara térmica?",
  "por ahora no compro gracias"
 ]},
 {id:"C05",kind:"decision",name:"Multi SKU y corrección",turns:[
  "oe quiero 3 armor x13 y 2 armor 22",
  "mejor 4 del x13, el otro dejalo en 2",
  "y el total? se puede pagar con yape?",
  "ya decidido, quiero comprar los 4 x13 y 2 armor 22. como coordinamos?"
 ]},
 {id:"C06",kind:"no_compra",name:"Solo mirar",turns:[
  "hola estoy viendo celulares resistentes para mí",
  "que diferencias hay entre armor 22 y x13?",
  "solo preguntaba, no agregues nada ni me hagas pedido",
  "gracias lo sigo viendo"
 ]},
 {id:"C07",kind:"decision",name:"Campo térmico",turns:[
  "buenas, necesito un celular con camara termica pa mi trabajo",
  "el armor 25t pro es ese? sirve para revisar temperatura?",
  "ya, quiero 1 armor 25t pro. cuánto?",
  "si, lo compro. dime el siguiente paso sin inventar disponibilidad"
 ]},
 {id:"C08",kind:"no_compra",name:"Posventa molesta",turns:[
  "oye mi celular se malogro, yo compre con ustedes",
  "lo mojé y ahora no prende, la garantia me lo cubre o que",
  "quiero devolucion, pasame con persona",
  "ya me pasaste con alguien? estoy esperando"
 ]},
 {id:"C09",kind:"decision",name:"Sustitución por falta stock",turns:[
  "oe busco un x12 pro, tienes?",
  "si no hay, dime si el armor x13 me sirve pal almacén",
  "quiero uno de ese x13, cuánto costaría?",
  "ok voy a comprar el x13, qué paso sigue?"
 ]},
 {id:"C10",kind:"no_compra",name:"Apurado pero indeciso",turns:[
  "tengo 1 minuto, armor 22 aguanta golpes? habla rapido",
  "y la bateria? no me metas 3 preguntas",
  "es para delivery, necesito que dure",
  "ya luego te confirmo"
 ]},
 {id:"C11",kind:"no_compra",name:"Ambigüedad de segundo",turns:[
  "hola comparame el armor x13 y el armor 22",
  "el segundo cuanta memoria trae?",
  "y el otro cuanto vale?",
  "solo comparo, no he pedido nada"
 ]},
 {id:"C12",kind:"no_compra",name:"Corrección sin modelo",turns:[
  "quiero 2 armor x13 y 3 armor 22",
  "noo mejor 4",
  "el que dije primero, déjalo en 4",
  "cuanto sale todo ahora?"
 ]},
 {id:"C13",kind:"no_compra",name:"Facturación y Yape",turns:[
  "buenas armor 22 está disponible?",
  "si llevo 2, cuánto me sale?",
  "aceptan yape y dan factura con ruc?",
  "no puedo decidir hasta saber eso"
 ]},
 {id:"C14",kind:"no_compra",name:"Cambio de necesidad",turns:[
  "hola quiero el armor 22",
  "mmm no, es para alguien que hace fotos nocturnas",
  "y el x13? qué cámaras trae?",
  "aun no decido entre los dos"
 ]},
 {id:"C15",kind:"no_compra",name:"Cotización no emitida",turns:[
  "necesito 3 armor 25t pro",
  "me preparas una cotización con igv y envio a arequipa?",
  "ya la emitiste? mandamela en pdf",
  "si no se puede, hablame claro y lo vemos luego"
 ]},
 {id:"C16",kind:"no_compra",name:"Retomada tras días",turns:[
  "buenas quiero un armor 22, dime precio",
  "lo voy a pensar un rato",
  "hola soy el de armor 22, volvi despues de varios dias, sigue el precio?",
  "por ahora averiguo, no confirmes pedido"
 ]},
 {id:"C17",kind:"no_compra",name:"Entrega urgente",turns:[
  "hola necesito armor x13 para hoy",
  "estoy en lima, llegaría esta tarde?",
  "me confirmas entrega inmediata?",
  "si no hay confirmacion mejor sigo buscando"
 ]},
 {id:"C18",kind:"no_compra",name:"Privacidad",turns:[
  "precio del armor 22 porfa",
  "me vas a pedir foto de dni para responder?",
  "no quiero dar mi telefono ni dni",
  "igual puedo seguir consultando cierto?"
 ]},
 {id:"C19",kind:"no_compra",name:"Sin stock suficiente",turns:[
  "buenas necesito 3 armor x13 y 2 armor 22",
  "mejor sube los x13 a 6, el otro queda igual",
  "total cuanto sería? pero tienes stock para todos?",
  "ya fue, no compres ni reserves nada"
 ]},
 {id:"C20",kind:"no_compra",name:"Cambio de opinión y pausa",turns:[
  "oe qué tal el armor 25t pro para trabajo",
  "y si mejor compro x13 es muy distinto?",
  "el de mas memoria cual era?",
  "lo reviso después, no quiero que me escriban"
 ]}
];