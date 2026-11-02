// Independently verified manufacturer specifications. Do not infer warranty coverage.
export const specsByPn = Object.freeze({
 "ARMOR-22-256G":{
   certifications:["IP68","IP69K","MIL-STD-810H"],
   ip68:"1,5 m durante un máximo de 30 minutos bajo condiciones de laboratorio",
   battery:"6600 mAh",storage:"256 GB",highlights:["cámara de visión nocturna"],
   note:"Resistencia no permanente. Según el fabricante, los daños por líquidos no están cubiertos por la garantía.",
   source:"https://store.ulefone.com/es/pages/armor22-spec"
 },
 "ARMOR-X13":{
   certifications:["IP68","IP69K","MIL-STD-810H"],
   ip68:"1,5 m durante un máximo de 30 minutos bajo condiciones de laboratorio",
   battery:"6320 mAh",storage:"64 GB",highlights:["cámara principal de 50 MP","cámara de visión nocturna de 24 MP"],
   note:"Certificación bajo pruebas controladas. La resistencia puede disminuir; daños por líquidos excluidos según el fabricante.",
   source:"https://store.ulefone.com/es/pages/armorx13-spec"
 },
 "ARMOR-25TPro-256GB":{
   certifications:["IP68","IP69K","MIL-STD-810H"],
   ip68:"2,0 m durante un máximo de 30 minutos bajo condiciones de laboratorio",
   battery:"6500 mAh",storage:"256 GB",highlights:["cámara térmica","visión nocturna"],
   note:"Resistencia no permanente. Según el fabricante, los daños por líquidos no están cubiertos por la garantía.",
   source:"https://store.ulefone.com/es/pages/armor-25t-pro-specs"
 }
});
/** Real offers are never filled from laboratory records. For simulations only use saved Supabase test offers. */
export function enrichCatalog(rows, simulated=false, testOffers=[]) {
 const offers = new Map((testOffers||[]).filter(o=>o.is_test_data===true).map(o=>[String(o.partnumber).toLowerCase(),o]));
 return (rows||[]).map(row=>{
  const demo=simulated?offers.get(String(row.partnumber).toLowerCase()):null;
  const price=simulated?(demo?Number(demo.price_pen):null):row.verified_at?row.price_pen:null;
  const availability=simulated?(demo?.stock_status||"por confirmar"):
    row.verified_at?(row.stock_erp>0?"disponible":"no disponible"):"por confirmar";
  return {
   titulo:row.title,marca:row.brand,partnumber:row.partnumber,
   especificaciones_fabricante:specsByPn[row.partnumber]||null,
   atributos_ficha:row.attributes||{},
   precio_soles:price,
   disponibilidad:availability,
   oferta_simulada:simulated,
   origen_datos:simulated?"simulacion_solo_pruebas":(row.verified_at?"erp_verificado":"sin_verificar")
  };
 });
}
