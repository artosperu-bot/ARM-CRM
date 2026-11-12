import {describe,it,expect} from "vitest";
import {analyzeConversationTurn,conversationTurnInstructions} from "./conversation-turn-plan.mjs";
import {buildBuyerContext,buyerGuidance} from "./buyer-reasoning.mjs";
import {protectSalesResponse} from "./sales-response-guard.mjs";
import {enrichCatalog} from "./product-knowledge.mjs";
import {salesMove} from "./sales-playbook.mjs";
const products=[
 {titulo:"Ulefone Armor X13 64GB",marca:"ULEFONE",partnumber:"ARMOR-X13",precio_soles:799,
  disponibilidad:"disponible",oferta_simulada:true,origen_datos:"simulacion_solo_pruebas"},
 {titulo:"Ulefone Armor 22 256GB",marca:"ULEFONE",partnumber:"ARMOR-22-256G",precio_soles:999,
  disponibilidad:"disponible",oferta_simulada:true,origen_datos:"simulacion_solo_pruebas"},
 {titulo:"Ulefone Armor X12 Pro 64GB",marca:"ULEFONE",partnumber:"ARMOR-X12Pro",precio_soles:659,
  disponibilidad:"no disponible",oferta_simulada:true,origen_datos:"simulacion_solo_pruebas"},
 {titulo:"Impresora Epson L1250",marca:"EPSON",partnumber:"E-L1250",precio_soles:null,
  disponibilidad:"por confirmar",oferta_simulada:false},
 {titulo:"Laptop Lenovo ThinkPad T14",marca:"LENOVO",partnumber:"T14-16",precio_soles:null,
  disponibilidad:"por confirmar",oferta_simulada:false}
];
const buyer=(turns,opts={})=>buildBuyerContext(turns,{catalog:products,...opts});
describe("ALEX adaptive conversation turn plans across buyer trajectories",()=>{
 it.each([
  ["oe tienes 3 armor x13? a cuanto me saldria? y hay para los 3?",["precio","disponibilidad"]],
  ["¿El Armor X13 tiene stock? Me lo envían mañana?",["disponibilidad","entrega"]],
  ["¿Cuánto cuesta el Armor 22 y me hacen descuento?",["precio","descuento"]],
  ["¿Cuál conviene más el X13 o X12 Pro? y cuanto vale?",["precio","comparacion"]],
  ["¿El cargador le sirve a mi laptop? y cuánto cuesta?",["precio","compatibilidad"]],
  ["pasame foto del Armor X13 y su precio",["precio","foto"]]
 ])("answers every independent question: %s",(input,axes)=>{
  const b=buyer([input]);const p=analyzeConversationTurn(b,products);
  expect(p.compound).toBe(true);
  for(const axis of axes)expect(p.axes).toContain(axis);
  expect(conversationTurnInstructions(b,products)).toContain("múltiples=true");
 });
 it.each([
  ["Quiero comprar el Armor X13 ya", "decision"],
  ["El Armor X13 esta muy caro", "objecion"],
  ["Compara el Armor 22 con el X13", "comparacion"],
  ["Mi X13 se malogró y no prende", "handoff"],
  ["No me llegó mi pedido", "handoff"],
  ["Pasame con un asesor ahora", "handoff"],
  ["Ya no quiero comprar el X13", "cierre"],
  ["Gracias por todo", "cierre"]
 ])("does not force a one-size-fits-all funnel: %s",(input,expected)=>{
  const b=buyer([input]);const plan=analyzeConversationTurn(b,products);
  expect(plan.focus).toBe(expected);
 });
 it("never treats an identity-document photo as a product image request",()=>{
  const b=buyer(["tengo que mandar foto de mi dni para preguntar precio del x13?"]);
  const p=analyzeConversationTurn(b,products);
  expect(p.asksPhoto).toBe(false);
  expect(p.asksPrice).toBe(true);
 });
 it("a combined price, stock and payment question must not authorize Yape",()=>{
  const b=buyer(["quiero dos armor x13, dime precio, stock y si aceptan yape"]);
  const g=protectSalesResponse("Sí aceptamos Yape, hay stock y el precio es S/ 799.",{
   buyer:b,catalog:products,simulated:true});
  expect(g.blocked).toBe(true);
  expect(g.reply).toMatch(/799/);
  expect(g.reply).toMatch(/disponible/i);
  expect(g.reply).toMatch(/medio de pago.*no est[aá] confirmado/i);
  expect(g.reply).not.toMatch(/s[ií] aceptamos yape/i);
 });
 it("keeps a safe compound answer instead of replacing it with a canned reply",()=>{
  const b=buyer(["quiero dos armor x13, dime precio, stock y si aceptan yape"]);
  const message="Precio simulado S/ 799 c/u. Disponibilidad: disponible. Sobre Yape no tengo confirmación del medio de pago.";
  const g=protectSalesResponse(message,{buyer:b,catalog:products,simulated:true});
  expect(g.blocked).toBe(false);
  expect(g.reply).toContain("Disponibilidad: disponible");
  expect(g.reply).toContain("Yape no tengo confirmación");
 });
 it("an expensive product objection should not turn into unrelated SKU verification",()=>{
  const b=buyer(["El Armor 25T Pro está caro, hay descuentito?"]);
  const g=protectSalesResponse("El X13 cuesta S/ 799, llévalo mejor.",{
   buyer:b,catalog:[{titulo:"Ulefone Armor 25T Pro",partnumber:"ARMOR-25TPro-256GB",precio_soles:1799,disponibilidad:"disponible",oferta_simulada:true},products[0]],simulated:true});
  expect(g.blocked).toBe(true);
  expect(g.reply).toMatch(/descuento aprobado/i);
  expect(g.reply).not.toMatch(/verificar el modelo exacto/i);
 });
 it("a product switch cannot reuse the old product price",()=>{
  const prior=buyer(["Me interesa el Armor X13, cuanto cuesta?"]);
  const newer=buyer(["mejor quiero una impresora Epson L1250, cuanto sale?"],{
   memory:{version:1,selected_partnumber:prior.matched_partnumber,quantity:1}
  });
  expect(newer.matched_partnumber).toBe("E-L1250");
  expect(conversationTurnInstructions(newer,products)).toMatch(/precio/i);
  const guard=protectSalesResponse("La Epson cuesta S/ 799.",{buyer:newer,catalog:products,simulated:true});
  expect(guard.blocked).toBe(true);
  expect(guard.reply).not.toContain("799");
 });
 it("does not confuse a hypothetical failure with an actual complaint",()=>{
  const hypothetical=buyer(["Si se malogra mi celular, que pasa?"]);
  expect(hypothetical.requires_human).toBe(false);
  const incident=buyer(["Me llegó malogrado el celular, se apaga solo y quiero devolución"]);
  expect(incident.requires_human).toBe(true);
  expect(analyzeConversationTurn(incident,products).focus).toBe("handoff");
 });
 it("recognizes the buyer already explained use and quantity without questioning again",()=>{
  const b=buyer(["Quiero 2 celulares Armor X13 para almacén","ya cuanto sale y tienen para los 2?"]);
  expect(b.quantity).toBe(2);
  expect(b.use_case).toBe("almacen");
  expect(buyerGuidance(b,{catalog:products})).toContain("No vuelvas a preguntar por cantidad");
 });
 it("post-sale never upsells during a support incident",()=>{
  const b=buyer(["Mi impresora no imprime y quiero reclamo"]);
  expect(analyzeConversationTurn(b,products).focus).toBe("handoff");
  expect(salesMove(b,{catalog:products}).stage).toBe("atencion_humana");
 });
});
describe("ALEX factual guard: price and inventory change the response",()=>{
 const one=[products[0]];
 it("corrects claimed stock when requested number exceeds demo units",()=>{
  const data=enrichCatalog(
    [{workspace_id:"ws",partnumber:"ARMOR-X13",brand:"ULEFONE",title:"Ulefone Armor X13"}],
    true,[{partnumber:"ARMOR-X13",price_pen:799,stock_status:"disponible",stock_units_demo:5,is_test_data:true}],
    {requestedQuantity:6}
  );
  const b=buildBuyerContext(["oe tienes 6 armor x13? a cuanto me sale?"],{catalog:data});
  expect(b.matched_partnumber).toBe("ARMOR-X13");
  const g=protectSalesResponse("Sí, está disponible. Precio S/ 799.",{catalog:data,buyer:b,simulated:true});
  expect(g.blocked).toBe(true);
  expect(g.reply).toMatch(/no est[aá] disponible/i);
  expect(g.reply).toMatch(/S\/ 799/);
 });
 it("corrects 'por confirmar' when the selected product is explicitly unavailable",()=>{
  const b=buyer(["Tienes el Armor X12 Pro?"]);
  const g=protectSalesResponse("Por confirmar, déjame ver.",{catalog:products,buyer:b,simulated:true});
  expect(g.blocked).toBe(true);
  expect(g.reply).toMatch(/no est[aá] disponible/i);
  expect(g.reply).not.toMatch(/tiene disponibilidad por confirmar/i);
 });
 it("answers BOTH facts when price appears without stock",()=>{
  const b=buyer(["Precio y stock del Armor X13 porfa"]);
  const g=protectSalesResponse("El Armor X13 cuesta S/ 799.",{catalog:products,buyer:b,simulated:true});
  expect(g.blocked).toBe(true);
  expect(g.reason).toBe("availability_fact_correction");
  expect(g.reply).toMatch(/disponible/i);
  expect(g.reply).toMatch(/799/);
 });
 it("doesn't invent a price while correcting an unsupported availability claim",()=>{
  const unpriced=[{...products[3],disponibilidad:"por confirmar"}];
  const b=buildBuyerContext(["Cuánto está la Epson L1250 y hay stock?"],{catalog:unpriced});
  const g=protectSalesResponse("Sí hay y cuesta S/ 899.",{catalog:unpriced,buyer:b});
  expect(g.blocked).toBe(true);
  expect(g.reply).not.toContain("899");
 });
 it("rejects unsupported camera winners but keeps model-specific verified features",()=>{
  const specCatalog=[
   {...products[0],especificaciones_fabricante:{highlights:["cámara principal de 50 MP","cámara de visión nocturna de 24 MP"]}},
   {...products[1],especificaciones_fabricante:{highlights:["cámara de visión nocturna"]}}
  ];
  const b=buildBuyerContext(["entre el x13 y el armor 22 cuál tiene mejor cámara?"],{catalog:specCatalog});
  const g=protectSalesResponse("El Armor 22 tiene ventaja en cámara, es mejor en conjunto para fotos.",{
    buyer:b,catalog:specCatalog,simulated:true});
  expect(g.blocked).toBe(true);
  expect(g.reason).toBe("unverified_camera_ranking");
  expect(g.reply).toMatch(/50 MP/i);
  expect(g.reply).toMatch(/no tengo una prueba comparativa/i);
  expect(g.reply).not.toMatch(/armor 22 tiene ventaja/i);
 });
 it("does not rewrite a safe, natural discount response as a rigid script",()=>{
  const b=buyer(["ta caro el armor x13, me haces descuentito?"]);
  const message="No tengo un descuento aprobado por ahora. Si buscas gastar menos, hay opciones para comparar según lo que necesites.";
  const g=protectSalesResponse(message,{buyer:b,catalog:products,simulated:true});
  expect(g.blocked).toBe(false);
  expect(g.reply).toContain("No tengo un descuento aprobado");
 });
 it("does not force a stock reply when user asks ONLY about camera",()=>{
  const b=buyer(["Qué tal la cámara del Armor X13?"]);
  const g=protectSalesResponse("Tiene una cámara que puedo describir con la ficha.",{catalog:one,buyer:b,simulated:true});
  expect(g.reason).not.toBe("availability_fact_correction");
 });
 it("a support complaint outranks an earlier price and availability question",()=>{
  const b=buyer(["Precio y stock del Armor X13","Oye pero mi pedido llegó roto y quiero devolverlo"]);
  const g=protectSalesResponse("Podemos seguir con tu compra del X13.",{catalog:one,buyer:b,simulated:true});
  expect(g.reply).not.toMatch(/seguir con tu compra/i);
 });
});
