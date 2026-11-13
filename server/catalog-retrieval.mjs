/**
 * Retrieve relevant catalog SKUs for a conversation using indexed workspace-scoped
 * Postgres RPC. NEVER send the first 25 arbitrary products to the AI.
 * Zero semantic/external API calls; 2 bounded lexical searches at most.
 *
 * The matched catalogue is only evidence available to ALEX, not the full store.
 * Fact provenance is kept separate from test offers and sellable stock.
 */
const stop=new Set(
 "hola buenas buenos tardes noches gracias ok listo si no por favor necesito quiero busco buscamos comprar cotizar cotizacion cuanto cuesta costo precio precios vale sale dime tienes tienen hay disponibilidad disponible stock entregas entrega para de del la las los el un una uno unos unas y o que como me mi mis nuestro nuestros su sus por con sin en es son era seria sera puedo pueden puedes deseo desearia estoy quisiera ayudame ayudar recomiendas recomendar recomiendame recomendarme diferencia mejor compara comparar ofertas ofertasito descuento mañana manana hoy esta estas este estos esa ese eso esto eso seria final como esta mas menos muchisimo gracias este exacto aun antes despues tienen vendes vender venden venderian informame consulta consultar informacion ayuda necesito necesito totalmente si tengo fue darme"
 .split(/\s+/u)
);
const normalize=s=>String(s||"")
 .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
 .toLowerCase().replace(/s\s*\/\s*\d[\d.,]*/gu," ")
 .replace(/[^a-z0-9]+/gu," ").replace(/\s+/gu," ").trim();
export function catalogQueries(customerMessages,{maxQueries=2}={}){
 const turns=(Array.isArray(customerMessages)?customerMessages:[])
  .filter(x=>typeof x==="string"&&x.trim()).slice(-20);
 const latest=normalize(turns.at(-1));
 if(/^(?:gracias(?: por todo)?|listo gracias|no me escriban|stop|ya no quiero comprar|mejor ya no voy a comprar|nada mas)$/u.test(latest))
   return [];
 const capQueries=Math.max(1,Math.min(maxQueries,3));
 // A two-line request must search BOTH models. A single combined query can
 // otherwise return only the first ranked SKU from the indexed RPC.
 const fragments=String(turns.at(-1)||"").split(/\s+(?:y|ademas)\s+|[,;+]/iu)
  .map(part=>normalize(part).split(" ").filter(w=>
   (w.length>=3||/^\d{2,}$/u.test(w))&&!stop.has(w) &&
   !/^\d{4,6}$/u.test(w)).slice(0,8).join(" "))
  .filter(x=>x.length>=3&&/\b(?:[a-z]{1,12}\d{2,5}|[a-z]{3,20}\s+\d{2,4})\b/u.test(x));
 if(fragments.length>=2){
  return [...new Set(fragments)].slice(0,capQueries).map(x=>x.slice(0,120));
 }
 const queries=[];
 for(const raw of [...turns].reverse()){
  const tokens=normalize(raw).split(" ").filter(word=>
    (word.length>=3||/^\d{2,}$/u.test(word))&&!stop.has(word) &&
    !/^\d{4,6}$/u.test(word) /* broad prices/years are too weak alone */);
  if(!tokens.length)continue;
  const phrase=tokens.slice(0,8).join(" ").slice(0,120);
  if(phrase.length<3||queries.includes(phrase))continue;
  queries.push(phrase);
  if(queries.length>=capQueries)break;
 }
 return queries;
}
export function reviewedProductFacts(rows,{now=Date.now()}={}){
 const factsByPn={};
 for(const item of Array.isArray(rows)?rows:[]){
  if(!item?.partnumber||!item?.fact_key||item?.review_status!=="verified")continue;
  const reviewed=Date.parse(String(item.reviewed_at||""));
  const expires=item.expires_at?Date.parse(item.expires_at):Infinity;
  if(!Number.isFinite(reviewed)||reviewed>now+120000||!(expires>now))continue;
  if(item.source_type!=="manufacturer"&&item.source_type!=="official_manual"&&
     item.source_type!=="supplier"&&item.source_type!=="erp"&&item.source_type!=="reviewed_internal")continue;
  if(!(item.source_url||["erp","reviewed_internal"].includes(item.source_type)))continue;
  const value=item.fact_value;
  if(value===null||typeof value==="undefined")continue;
  (factsByPn[item.partnumber]||=(Object.create(null)))[item.fact_key]={
    value,source_type:item.source_type,source_url:item.source_url||null,
    reviewed_at:item.reviewed_at
  };
 }
 return factsByPn;
}
export async function retrieveSalesCatalog(client,workspaceId,customerMessages,{limit=18,requiredPartnumbers=[]}={}){
 if(!client||!workspaceId||typeof client.rpc!=="function")
  throw new Error("ARM_CATALOG_SEARCH_NOT_CONFIGURED");
 const queries=catalogQueries(customerMessages);
 const required=[...new Set((Array.isArray(requiredPartnumbers)?requiredPartnumbers:[])
   .filter(x=>typeof x==="string"&&/^[A-Z0-9][A-Z0-9._-]{3,79}$/iu.test(x)).slice(0,12))];
 if(!queries.length&&!required.length)return {products:[],factsByPn:{},searchQueries:[],limited:true};
 const cap=Math.min(24,Math.max(1,Math.floor(limit)));
 const scored=new Map();
 for(let i=0;i<queries.length;i++){
  const {data,error}=await client.rpc("arm_search_catalog",{
   p_workspace_id:workspaceId,p_query:queries[i],p_max_results:cap
  });
  if(error)throw new Error("ARM_CATALOG_SEARCH_FAILED");
  for(const row of data||[]){
   if(!row||row.workspace_id!==workspaceId||!row.partnumber)continue;
   const relevance=Number(row.search_rank)||0;
   const weighted=relevance+(i===0?35:0);
   if(!scored.has(row.partnumber)||scored.get(row.partnumber).score<weighted)
    scored.set(row.partnumber,{product:row,score:weighted});
  }
 }
 if(required.length){
  // A saved draft SKU is a lookup hint, never an entitlement or a cached offer.
  // RLS and workspace filters remain in force; missing/deleted items are omitted.
  const {data:extra,error:extraError}=await client.from("arm_products")
   .select("id,workspace_id,partnumber,title,brand,attributes,category_path,family_key,variant_options,price_pen,stock_erp,verified_at")
   .eq("workspace_id",workspaceId).in("partnumber",required).limit(12);
  if(extraError)throw new Error("ARM_CATALOG_DRAFT_LOOKUP_FAILED");
  for(const row of extra||[]){
   if(row?.workspace_id!==workspaceId||!required.includes(row.partnumber))continue;
   if(!scored.has(row.partnumber))scored.set(row.partnumber,{product:row,score:130});
  }
 }
 const ranked=[...scored.values()].sort((a,b)=>b.score-a.score||
  String(a.product.partnumber).localeCompare(String(b.product.partnumber)));
 // When one exact model/SKU is far more relevant than every other candidate,
 // avoid distracting the sales agent with unrelated alternatives. But preserve
 // comparable variants when the buyer explicitly asks for alternatives.
 const current=String(customerMessages.at(-1)||"").normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"").toLowerCase();
 const comparing=/\b(?:compara\w*|diferencia\w*|alternativa\w*|opciones|versus|vs|mejor que|otra opcion)\b/u.test(current);
 const strongest=ranked[0];
 const multiProduct=queries.length>=2&&
   /\b(?:y|ademas)\b|[,;+]/u.test(current);
 const exactFocus=!comparing&&!multiProduct&&required.length<=1&&strongest?.score>=140&&
   (!ranked[1]||strongest.score>ranked[1].score*1.7);
 const products=(exactFocus?[strongest]:ranked.slice(0,cap)).map(x=>x.product);
 if(!products.length)return {products:[],factsByPn:{},searchQueries:queries,limited:true};
 // Only fetch facts for the shortlisted SKUs, and only evidence reviewed
 // for the actual workspace. Never feed pending or expired facts to ALEX.
 const {data:facts,error:factsError}=await client.from("arm_product_facts")
  .select("partnumber,fact_key,fact_value,source_type,source_url,review_status,reviewed_at,expires_at")
  .eq("workspace_id",workspaceId).eq("review_status","verified")
  .in("partnumber",products.map(p=>p.partnumber)).limit(300);
 if(factsError)throw new Error("ARM_CATALOG_FACTS_FAILED");
 return {products,factsByPn:reviewedProductFacts(facts),searchQueries:queries,limited:true};
}
