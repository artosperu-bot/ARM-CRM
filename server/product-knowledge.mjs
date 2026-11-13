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
export function enrichCatalog(rows, simulated=false, testOffers=[],{now=Date.now(),factsByPn={},commercialByPn={},requestedQuantity=1,requestedQuantitiesByPn={}}={}) {
 const offers = new Map((testOffers||[]).filter(o=>o.is_test_data===true).map(o=>[String(o.partnumber).toLowerCase(),o]));
 return (rows||[]).map(row=>{
  const demo=simulated?offers.get(String(row.partnumber).toLowerCase()):null;
  const evidence=commercialByPn[row.partnumber]||null;
  // Do not trust a legacy product.price_pen or verified_at alone. Only a
  // separately approved, unexpired direct-channel review can supply a price.
  const trustedPrice=!simulated&&evidence?.priceVerified===true&&
    Number.isFinite(Number(evidence.pricePen))&&Number(evidence.pricePen)>0;
  const price=simulated?(demo&&Number.isFinite(Number(demo.price_pen))?Number(demo.price_pen):null):
    trustedPrice?Number(evidence.pricePen):null;
  const requestedForSku=requestedQuantitiesByPn?.[row.partnumber];
  const qty=Number.isInteger(requestedForSku)&&requestedForSku>0?requestedForSku:
    Number.isInteger(requestedQuantity)&&requestedQuantity>0?requestedQuantity:1;
  const saleable=!simulated&&evidence?.saleableStock===true&&
    Number.isInteger(evidence.availableToPromiseUnits)&&evidence.availableToPromiseUnits>=qty;
  // Private stock units are assumed values, never a real inventory or order.
  // Check the buyer's requested quantity without revealing exact units to the LLM.
  const units=demo?.stock_units_demo;
  const demoUnitsValid=simulated&&demo?.is_test_data===true&&
    Number.isInteger(units)&&units>=0;
  const availability=simulated?(
    !demoUnitsValid?"por confirmar":
    demo.stock_status==="no disponible"||units<qty?"no disponible":
    demo.stock_status==="disponible"?"disponible":"por confirmar"
  ):saleable?"disponible":"por confirmar";
  const allCertifiedFacts=factsByPn[row.partnumber]||null;
  // Images are media assets, not specifications sent to the language model.
  const certifiedFacts=allCertifiedFacts?
   Object.fromEntries(Object.entries(allCertifiedFacts).filter(([key])=>key!=="product_image")):null;
  const hasSpecs=Boolean(certifiedFacts&&Object.keys(certifiedFacts).length);
  return {
   titulo:row.title,marca:row.brand,partnumber:row.partnumber,
   categoria:Array.isArray(row.category_path)?row.category_path:[],
   familia:row.family_key||null,
   variante:row.variant_options&&typeof row.variant_options==="object"?row.variant_options:{},
   especificaciones_fabricante:(hasSpecs?certifiedFacts:null)||specsByPn[row.partnumber]||null,
   nivel_evidencia:hasSpecs?"hechos_revisados":specsByPn[row.partnumber]?"ficha_fabricante_heredada":"sin_ficha_verificada",
   atributos_ficha:row.attributes||{},
   precio_soles:price,
   disponibilidad:availability,
   oferta_simulada:simulated,
   origen_stock:simulated?"simulacion_solo_pruebas":(saleable?"stock_vendible_verificado":"stock_no_verificado"),
   origen_datos:simulated?"simulacion_solo_pruebas":(trustedPrice?"precio_vigente_verificado":"precio_no_verificado")
  };
 });
}
