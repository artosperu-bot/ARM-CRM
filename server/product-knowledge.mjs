// Independently verified manufacturer specifications. Do not infer warranty coverage.
export const specsByPn = Object.freeze({
 "ARMOR-22-256G":{
   certifications:["IP68","IP69K","MIL-STD-810H"],
   ip68:"1,5 m durante un máximo de 30 minutos bajo condiciones de laboratorio",
   battery:"6600 mAh",storage:"256 GB",highlights:["cámara de visión nocturna"],
   note:"Resistencia no permanente. Según el fabricante, los daños por líquidos no están cubiertos por la garantía.",
   source:"https://store.ulefone.com/es/pages/armor22-spec"
 },
 "ARMOR-25TPro-256GB":{
   certifications:["IP68","IP69K","MIL-STD-810H"],
   ip68:"2,0 m durante un máximo de 30 minutos bajo condiciones de laboratorio",
   battery:"6500 mAh",storage:"256 GB",highlights:["cámara térmica","visión nocturna"],
   note:"Resistencia no permanente. Según el fabricante, los daños por líquidos no están cubiertos por la garantía.",
   source:"https://store.ulefone.com/es/pages/armor-25t-pro-specs"
 }
});
export function enrichCatalog(rows, simulated=false) {
 const fictitious={
 "ARMOR-22-256G":999,"ARMOR-25TPro-256GB":1799,
 "ARMOR-X12Pro":659,"ARMOR-X13":799
 };
 return (rows||[]).map(row=>{
  const price=simulated?(fictitious[row.partnumber]??null):row.verified_at?row.price_pen:null;
  const available=simulated?"disponible":row.verified_at?(row.stock_erp>0?"disponible":"no disponible"):"por confirmar";
  return {
   titulo:row.title,marca:row.brand,partnumber:row.partnumber,
   especificaciones_fabricante:specsByPn[row.partnumber]||null,
   atributos_ficha:row.attributes||{},
   precio_soles:price,
   disponibilidad:available,
   oferta_simulada:simulated
  };
 });
}
