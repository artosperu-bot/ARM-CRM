import {hideExactStockUnits} from "./sales-response-guard.mjs";
/**
 * WhatsApp Cloud API supports *bold* and _italic_; it does not render
 * Markdown headers or double-asterisk bold. Keep this adapter isolated from
 * the web CRM, which uses its own presentation.
 */
export function whatsappPresentationInstructions(){
 return [
  "FORMATO EXCLUSIVO DE WHATSAPP: El valor reply se envía como texto WhatsApp, NO como Markdown web.",
  "Usa *una sola estrella* para negritas: *Armor 22*, *Precio de prueba:*. NO uses **doble estrella**, encabezados #, tablas ni HTML.",
  "Haz respuestas fáciles de escanear en pantalla pequeña: líneas cortas, espacios entre bloques y, SI aportan valor, hasta tres viñetas con •.",
  "Orden NATURAL: responde primero lo que te preguntaron; resalta producto y dato principal; añade 1-3 beneficios relevantes para ese caso; ofrece alternativas numeradas SOLO si el cliente las pide o son realmente útiles.",
  "Si el usuario pregunta el precio de un modelo, da su precio y dos o tres aspectos verificables; no enumeres otros productos innecesariamente ni termines en un menú de opciones forzado.",
  "Cuando propongas opciones, usa *1.* y *2.* con nombre de modelo y diferencia comprobada; no inventes que uno es más económico o más potente si la evidencia no lo acredita.",
  "Una sola pregunta al final SOLAMENTE cuando ayude a avanzar la compra; una respuesta simple de sí/no, saludo o confirmación no necesita pregunta automática.",
  "Normalmente 35-75 palabras, y como máximo unos 110 si realmente hace falta comparar. 2-5 bloques breves. Sin párrafos de catálogo extensos ni emojis en exceso.",
  "Resalta con *negrita* el nombre del producto y el precio únicamente si el cliente pidió precio. Nunca anuncies stock, unidades, precios o descuentos espontáneamente.",
  "El encabezado 🧪 *PRUEBA STECH* será incorporado por el servidor en simulación: NO lo incluyas dentro de reply.",
  "Modelo de estructura ORIENTATIVA para una consulta de precio: *Producto*\n*Precio de prueba:* S/ XXX\n\n• Beneficio verificable\n• Beneficio verificable\n\nPregunta breve solo si es necesaria.",
  "Nunca escribas literalmente S/ XXX en la respuesta real: usa exclusivamente el precio autorizado en el catálogo, o indica que está por confirmar."
 ].join("\n");
}
export function formatWhatsAppReply(raw,{simulated=false,maxChars=1300}={}){
 if(typeof raw!=="string")return "";
 let text=raw
   .replace(/\r\n?/g,"\n")
   .replace(/^\s*#{1,6}\s+/gm,"") // WhatsApp cannot render Markdown headings
   .replace(/\*\*([^*\n]+)\*\*/g,"*$1*") // Markdown bold → native WhatsApp bold
   .replace(/^[ \t]*[-–•]\s+/gm,"• ")
   .replace(/^[ \t]+|[ \t]+$/gm,"")
   .replace(/\n{3,}/g,"\n\n")
   .trim();
 // Avoid repeating simulation headers when the model supplies one despite prompt.
 if(simulated){
   text=text.replace(/^\s*(?:🧪|📌|📝|✏️)?\s*\*?PRUEBA STECH\*?[^\n]*\n*/iu,"").trimStart();
 }
 text=hideExactStockUnits(text);
 const header=simulated?"🧪 *PRUEBA STECH* (precios y disponibilidad simulados)\n\n":"";
 const budget=Math.max(0,maxChars-header.length);
 if(text.length>budget){
   // Prefer cutting at a sentence/block boundary to preserve readable WhatsApp markup.
   let cut=text.slice(0,budget);
   const pivot=Math.max(cut.lastIndexOf("\n\n"),cut.lastIndexOf(". "));
   if(pivot>budget*0.65)cut=cut.slice(0,pivot+(cut[pivot]==="."?1:0));
   else cut=cut.replace(/\s+\S*$/u,"");
   text=cut.trim();
   // Prevent unpaired * or _ at the truncated edge.
   if((text.match(/\*/g)||[]).length%2)text=text.replace(/\*([^*]*)$/u,"$1");
   if((text.match(/_/g)||[]).length%2)text=text.replace(/_([^_]*)$/u,"$1");
 }
 return header+text;
}
