/**
 * Synthetic WhatsApp stress cases. New customers; four turns each.
 * expectDraft is a QA oracle, not an actual order. Five choose to buy.
 * Never transmit messages to clients.
 */
export const stressJourneys20=[
 {id:"S01",label:"Laptop + monitors, correct only monitors",kind:"decision",turns:[
  "hola mano, necesito 2 lenovo t14 de 16gb y 2 lg 27mr400",
  "mejor 1 monitor lg, las 2 laptops iguales",
  "y cuanto es todo? no me inventes stock",
  "ok quiero llevar esas 2 laptops y el monitor, como sigo?"
 ],expectDraft:[["QA-LEN-T14-16",2],["QA-LG-27MR400",1]]},
 {id:"S02",label:"Two Logitech SKU and explicit correction",kind:"decision",turns:[
  "buenas 2 audifonos logitech h390 y 1 h570e",
  "corrige los h390 a 3, el h570e igual",
  "cuanto es todo con esos tres? mejor dicho con los cuatro",
  "ya me llevo los 3 h390 y 1 h570e, dime como continuar"
 ],expectDraft:[["QA-LOG-H390",3],["QA-LOG-H570E",1]]},
 {id:"S03",label:"Samsung tablet compare then buy",kind:"decision",turns:[
  "oe entre tab a9 y tab a9 plus cual tiene mas almacenamiento?",
  "no compro aun solo comparo",
  "ya decidi, quiero una samsung tab a9 plus de 128gb",
  "listo la compro, cual es el siguiente paso?"
 ],expectDraft:[["QA-SAM-TAB-A9PLUS",1]]},
 {id:"S04",label:"Unavailable printer and available alternative",kind:"decision",turns:[
  "quiero una impresora epson l15150",
  "si no tienen, la l1250 cuanto sale?",
  "cambio la l15150 por 1 epson l1250",
  "ya compro esa l1250, que sigue?"
 ],expectDraft:[["QA-EPS-L1250",1]]},
 {id:"S05",label:"Router partial removal then buy",kind:"decision",turns:[
  "dame 2 tp link ax23 y un archer ax55",
  "quita los ax23, solo quiero el ax55",
  "el ax55 cuantos quedan supuestamente en esta prueba?",
  "perfecto quiero comprar 1 archer ax55"
 ],expectDraft:[["QA-TPL-AX55",1]]},
 {id:"S06",label:"Comparison is not a basket",kind:"consultation",turns:[
  "comparame el samsung ls24d300 y el lg 27mr400",
  "el segundo tiene 27 pulgadas?",
  "tambien dime diferencias de precio si los tienes",
  "solo compara, no registres ninguna compra"
 ],expectDraft:[]},
 {id:"S07",label:"DDR5 compatibility cannot be invented",kind:"consultation",turns:[
  "hola la kingston ddr5 7200 sirve para cualquier laptop?",
  "tengo una thinkpad t14 y necesito saber compatibilidad",
  "no me confirmes sin ficha",
  "no compro hasta revisar el tipo de memoria"
 ],expectDraft:[]},
 {id:"S08",label:"Power delivery technical uncertainty",kind:"consultation",turns:[
  "tengo una lenovo, cargador 65w o 100w?",
  "uno de 100w dañaria mi laptop o funciona seguro?",
  "sin saber modelo exacto, puedes confirmarlo?",
  "mejor lo veo despues"
 ],expectDraft:[]},
 {id:"S09",label:"Multiple independent requested quantities",kind:"consultation",turns:[
  "quiero 2 epson l1250 y 3 logitech h390",
  "sube los h390 a 4, la epson igual",
  "si agrego 2 archer ax55, cuanto de prueba seria?",
  "noo por ahora no, solo conserva las 2 epson y 4 logitech"
 ],expectDraft:[["QA-EPS-L1250",2],["QA-LOG-H390",4]]},
 {id:"S10",label:"Ambiguous correction asks product",kind:"consultation",turns:[
  "necesito 2 epson l1250 y 3 logitech h390",
  "noo mejor 4",
  "no me cambies nada si no dije cual",
  "al final deja los 2 epson y 3 h390 que dije al inicio"
 ],expectDraft:[["QA-EPS-L1250",2],["QA-LOG-H390",3]]},
 {id:"S11",label:"Pay by Yape unverified",kind:"consultation",turns:[
  "hola quiero 1 tablet a9 plus de 128gb",
  "se puede pagar con yape?",
  "y dan factura con ruc?",
  "todavia no confirmo compra, dime que falta validar"
 ],expectDraft:[["QA-SAM-TAB-A9PLUS",1]]},
 {id:"S12",label:"Stock exceeds synthetic availability",kind:"consultation",turns:[
  "necesito 3 LG 27MR400 monitores",
  "tienen para los 3 o solo dos en prueba?",
  "total de prueba cuanto es?",
  "no hagas pedido, no reservé nada"
 ],expectDraft:[["QA-LG-27MR400",3]]},
 {id:"S13",label:"Four-category provisional items",kind:"consultation",turns:[
  "quiero un router ax23 y 2 h570e",
  "agrega una epson l1250",
  "ademas una tablet samsung tab a9 plus de 128gb",
  "cuanto es todo de prueba?"
 ],expectDraft:[["QA-TPL-AX23",1],["QA-LOG-H570E",2],["QA-EPS-L1250",1],["QA-SAM-TAB-A9PLUS",1]]},
 {id:"S14",label:"Variant ambiguity Lenovo",kind:"consultation",turns:[
  "quiero 2 laptops lenovo t14",
  "pero espera, hay versiones 16 y 32 gb?",
  "hasta que te diga cual, no agregues ninguna",
  "mejor solo consulto"
 ],expectDraft:[]},
 {id:"S15",label:"Returns and human escalation",kind:"support",turns:[
  "oye mi monitor samsung se malogro",
  "se pone negro y sale un codigo raro, quiero devolucion",
  "pasame con un asesor humano ya",
  "en serio ya hay un asesor atendiendo mi caso?"
 ],expectDraft:[]},
 {id:"S16",label:"Cancel prior prospect",kind:"abandon",turns:[
  "quiero 2 cargadores 65w y un router ax23",
  "mejor cancelalo todo, ya no compro",
  "no me reserves nada",
  "no me escribas por seguimiento"
 ],expectDraft:[]},
 {id:"S17",label:"No upsell without permission",kind:"consultation",turns:[
  "busco la epson l1250, quiero 1",
  "tambien venden audifonos logitech? solo preguntaba",
  "no agregues audifonos a mi lista",
  "cuanto sale esa epson de prueba?"
 ],expectDraft:[["QA-EPS-L1250",1]]},
 {id:"S18",label:"Two routers compare and remove",kind:"consultation",turns:[
  "quisiera 1 archer ax55 y 2 ax23",
  "elimina el ax55, mejor solo 2 ax23",
  "a ver mi lista ahora",
  "cuanto saldria todo?"
 ],expectDraft:[["QA-TPL-AX23",2]]},
 {id:"S19",label:"Mixed smartphones and tablets not equivalent",kind:"consultation",turns:[
  "quiero comparar Armor X13 con Samsung Tab A9 Plus",
  "el segundo se puede usar para llamar con SIM?",
  "no me digas que si sin especificaciones exactas",
  "por ahora solo comparo, nada de compra"
 ],expectDraft:[]},
 {id:"S20",label:"High-value request with no approved checkout",kind:"consultation",turns:[
  "tengo un presupuesto, necesito 2 t14 de 32gb y 1 epson l15150",
  "la epson no tienen? cuanto saldria igual la suma?",
  "para comprar necesito factura, yape y entrega hoy",
  "no hagas nada aun, solo dame el paso siguiente sin prometer pago"
 ],expectDraft:[["QA-LEN-T14-32",2],["QA-EPS-L15150",1]]}
];
