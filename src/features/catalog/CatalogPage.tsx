import {AlertTriangle,Database,Package,RefreshCw,Search} from "lucide-react";
import {useCallback,useEffect,useMemo,useState} from "react";
import type {Product} from "../../types";
import {supabase} from "../../lib/supabase";
import "./erp-stock.css";

type StockObservation={
  arm_partnumber:string;erp_partnumber:string;source_updated_at:string;
  observed_at:string;physical_units:number|null;freshness:"fresh"|"stale"|"anomaly"|"pending_mapping";
};
type ProductMapping={arm_partnumber:string;erp_partnumber:string;mapping_status:"verified_exact"|"candidate"|"rejected";evidence:string};
type CommercialReview={
 partnumber:string;review_state:"pending"|"approved"|"revoked";reviewer_id:string|null;
 review_note:string;price_pen:number|null;price_source_ref:string|null;
 price_reviewed_at:string|null;price_expires_at:string|null;
 stock_reviewed_at:string|null;stock_expires_at:string|null;
};
function approvedPrice(review:CommercialReview|undefined,now=Date.now()):number|null{
 if(review?.review_state!=="approved"||!review.reviewer_id||review.review_note.trim().length<8||
    !review.price_source_ref||review.price_source_ref.trim().length<8||review.price_pen===null||
    !(Number(review.price_pen)>0))return null;
 const reviewed=Date.parse(review.price_reviewed_at||""),expires=Date.parse(review.price_expires_at||"");
 if(!Number.isFinite(reviewed)||!Number.isFinite(expires)||reviewed>now+120000||
    now-reviewed>6*3600000||expires<=now||expires-reviewed>6*3600000)return null;
 return Number(review.price_pen);
}
const MAX_AGE_MINUTES=180;
function sourceState(obs:StockObservation|undefined):"fresh"|"pending_mapping"|"stale"|"anomaly"|"missing"{
 if(!obs)return "missing";
 if(obs.freshness==="pending_mapping")return "pending_mapping";
 if(obs.freshness==="anomaly")return "anomaly";
 const t=Date.parse(obs.source_updated_at);
 if(!Number.isFinite(t)||Date.now()-t>MAX_AGE_MINUTES*60000||t>Date.now()+120000)return "stale";
 return obs.freshness;
}
const statusLabels={fresh:"Actualizado",pending_mapping:"PN pendiente de revisión",stale:"Datos vencidos",anomaly:"Revisar anomalía",missing:"Sin conexión validada"};
export default function CatalogPage({products,workspaceId,isAdmin=false}:{products:Product[],workspaceId:string,isAdmin?:boolean}){
 const [filter,setFilter]=useState("");
 const [sourceFilter,setSourceFilter]=useState("all");
 const [observations,setObservations]=useState<StockObservation[]>([]);
 const [mappings,setMappings]=useState<ProductMapping[]>([]);
 const [reviews,setReviews]=useState<CommercialReview[]>([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [priceEditor,setPriceEditor]=useState<string|null>(null);
 const [priceInput,setPriceInput]=useState("");
 const [sourceInput,setSourceInput]=useState("");
 const [reviewNote,setReviewNote]=useState("");
 const [savingPrice,setSavingPrice]=useState(false);
 const [reviewNotice,setReviewNotice]=useState("");
 const load=useCallback(async()=>{
  if(!supabase)return;
  setLoading(true);setError("");
  const [o,m,commercial]=await Promise.all([
   supabase.from("arm_erp_stock_observations")
     .select("arm_partnumber,erp_partnumber,source_updated_at,observed_at,physical_units,freshness")
     .eq("workspace_id",workspaceId).limit(500),
   supabase.from("arm_erp_product_map")
     .select("arm_partnumber,erp_partnumber,mapping_status,evidence")
     .eq("workspace_id",workspaceId).limit(500),
   supabase.from("arm_commercial_reviews")
     .select("partnumber,review_state,reviewer_id,review_note,price_pen,price_source_ref,price_reviewed_at,price_expires_at,stock_reviewed_at,stock_expires_at")
     .eq("workspace_id",workspaceId).limit(500)
  ]);
  if(o.error||m.error||commercial.error)setError(o.error?.message||m.error?.message||commercial.error?.message||"No se pudo consultar la evidencia comercial.");
  else{
   setObservations((o.data||[]) as StockObservation[]);
   setMappings((m.data||[]) as ProductMapping[]);
   setReviews((commercial.data||[]) as CommercialReview[]);
  }
  setLoading(false);
 },[workspaceId]);
 useEffect(()=>{void load();},[load]);
 const obsByPn=useMemo(()=>new Map(observations.map(x=>[x.arm_partnumber,x])),[observations]);
 const mapByPn=useMemo(()=>new Map(mappings.map(x=>[x.arm_partnumber,x])),[mappings]);
 const reviewByPn=useMemo(()=>new Map(reviews.map(x=>[x.partnumber,x])),[reviews]);
 const selected=products.filter(p=>{
  const found=(p.partnumber+" "+p.title+" "+p.brand).toLocaleLowerCase("es").includes(filter.toLocaleLowerCase("es"));
  if(!found)return false;
  const state=sourceState(obsByPn.get(p.partnumber));
  return sourceFilter==="all"||(sourceFilter==="fresh"&&state==="fresh")||
     (sourceFilter==="pending"&&state==="pending_mapping")||
     (sourceFilter==="missing"&&state!=="fresh");
 });
 const freshCount=products.filter(p=>sourceState(obsByPn.get(p.partnumber))==="fresh").length;
 const pendingCount=products.filter(p=>sourceState(obsByPn.get(p.partnumber))==="pending_mapping").length;
 const approvedPriceCount=products.filter(p=>approvedPrice(reviewByPn.get(p.partnumber))!==null).length;
 async function savePriceReview(partnumber:string,action:"approve"|"revoke"){
  if(!supabase||!isAdmin||savingPrice)return;
  const amount=Number(priceInput.trim().replace(",","."));
  if(action==="approve"&&(!/^[0-9]{1,6}(?:[.,][0-9]{1,2})?$/.test(priceInput.trim())||
     !Number.isFinite(amount)||amount<=0||amount>999999.99||
     sourceInput.trim().length<8||reviewNote.trim().length<10)){
   setReviewNotice("Para aprobar necesitas precio exacto, una fuente identificable y el motivo de revisión.");
   return;
  }
  if(action==="revoke"&&reviewNote.trim().length<10){
   setReviewNotice("Indica el motivo de revocación en al menos 10 caracteres.");return;
  }
  if(action==="revoke"&&!window.confirm("¿Revocar el precio comercial de este SKU? ALEX dejará de ofrecerlo."))return;
  setSavingPrice(true);setReviewNotice("");
  try{
   const {data,error:failure}=await supabase.rpc("arm_record_direct_price",{
    p_workspace_id:workspaceId,p_partnumber:partnumber,p_action:action,
    p_price_pen:action==="approve"?amount:null,
    p_source_ref:action==="approve"?sourceInput.trim():null,
    p_note:reviewNote.trim()
   });
   if(failure)throw failure;
   if(data?.partnumber!==partnumber||data?.action!==action||
     (action==="approve"&&(data?.state!=="approved"||Number(data?.price_pen)!==amount)))
    throw new Error("La base de datos no confirmó la operación.");
   await load();
   setPriceEditor(null);setPriceInput("");setSourceInput("");setReviewNote("");
   setReviewNotice(action==="approve"?
    "Precio directo aprobado y auditado para este SKU. Vence en seis horas; no implica stock ni pedido.":
    "Precio revocado y auditado. ALEX lo tratará como pendiente de revisión.");
  }catch(cause){
   setReviewNotice("No se pudo completar: "+(cause instanceof Error?cause.message:"Dato inválido o sin permiso."));
  }finally{setSavingPrice(false);}
 }
 return <section className="panel">
  <div className="panel-head">
   <div><h2>Catálogo comercial</h2><p>Datos de STECH y evidencia ERP PC005, sin asumir disponibilidad para venta.</p></div>
   <button className="secondary-button" disabled={loading} onClick={()=>void load()}>
    <RefreshCw size={14}/>{loading?"Consultando…":"Actualizar vista"}
   </button>
  </div>
  <div className="erp-summary">
   <span><Database size={16}/> <strong>{freshCount}</strong> fuentes recientes</span>
   <span><AlertTriangle size={16}/> <strong>{pendingCount}</strong> equivalencias pendientes</span>
   <span><Database size={16}/> <strong>{approvedPriceCount}</strong> precios aprobados vigentes</span>
   <span>Origen: <strong>PC005 / DB_ST</strong></span>
  </div>
  <p className="erp-disclaimer">El inventario físico no representa stock vendible. ALEX solo podrá comunicar un precio respaldado por revisión comercial aprobada y vigente; la disponibilidad exige conciliación reciente de reservas, compromisos, equivalencia exacta y canales. Sin evidencia suficiente, permanece por confirmar.</p>
  {error&&<div role="alert" className="auth-error">{error}</div>}
  {reviewNotice&&<div role="status" className="notice">{reviewNotice}</div>}
  <div className="erp-filter-row">
   <label className="search-box"><Search size={15}/><input aria-label="Buscar productos" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Part Number, marca o modelo"/></label>
   <select value={sourceFilter} aria-label="Filtrar estado ERP" onChange={e=>setSourceFilter(e.target.value)}>
    <option value="all">Todos los productos</option>
    <option value="fresh">Datos recientes</option>
    <option value="pending">Equivalencia pendiente</option>
    <option value="missing">Sin validación reciente</option>
   </select>
  </div>
  {!selected.length&&<div className="empty-records">No hay productos para este filtro.</div>}
  <div className="product-grid">{selected.map(p=>{
   const obs=obsByPn.get(p.partnumber),map=mapByPn.get(p.partnumber);
   const review=reviewByPn.get(p.partnumber),verifiedPrice=approvedPrice(review);
   const state=sourceState(obs);
   return <article className="product" key={p.partnumber}>
    <span className="product-icon"><Package size={24}/></span>
    <div><strong>{p.title}</strong><p>{p.brand} · PN ARM: {p.partnumber}</p></div>
    <div className="product-meta">
     <span>Precio autorizado para ALEX: <strong>{verifiedPrice===null?"Por confirmar":new Intl.NumberFormat("es-PE",{style:"currency",currency:"PEN"}).format(verifiedPrice)}</strong></span>
     {p.price!==null&&verifiedPrice===null&&<small>Precio histórico/importado sin revisión vigente; no se ofrecerá al cliente.</small>}
     {review?.review_state==="revoked"&&<small>La revisión comercial está revocada.</small>}
     {review?.price_reviewed_at&&verifiedPrice===null&&review.review_state==="approved"&&<small>Precio previamente revisado: caducado o con evidencia incompleta.</small>}
     <span>Disponibilidad vendible: <strong>Por confirmar</strong></span>
     <span className={"erp-evidence-state "+state}>{statusLabels[state]}</span>
     {obs&&<small>Fuente ERP: {obs.erp_partnumber} · {new Date(obs.source_updated_at).toLocaleString("es-PE",{dateStyle:"short",timeStyle:"short"})}</small>}
     {obs&&state==="fresh"&&<small>Existencias físicas observadas: {obs.physical_units} (uso interno; no prometer entrega)</small>}
     {map?.mapping_status==="candidate"&&<small className="erp-pn-warning">Verificar equivalencia: {p.partnumber} → {map.erp_partnumber}</small>}
     {!obs&&<small>Sin lectura ERP para este producto.</small>}
     {isAdmin&&<div className="catalog-price-operator">
       <button type="button" className="secondary-button" disabled={savingPrice}
         onClick={()=>{
           setPriceEditor(priceEditor===p.partnumber?null:p.partnumber);
           setPriceInput(verifiedPrice===null?"":String(verifiedPrice));
           setSourceInput(review?.price_source_ref||"");
           setReviewNote("");setReviewNotice("");
         }}>
          {priceEditor===p.partnumber?"Cancelar revisión":"Revisar precio directo"}
       </button>
       {priceEditor===p.partnumber&&<form className="catalog-price-form"
        onSubmit={e=>{e.preventDefault();void savePriceReview(p.partnumber,"approve");}}>
         <label>Precio directo en soles (IGV según política comercial)
           <input type="number" step="0.01" min="0.01" max="999999.99"
             value={priceInput} onChange={e=>setPriceInput(e.target.value)}
             placeholder="Ej. 999.00" required/>
         </label>
         <label>Fuente de precio (lista aprobada, cotización o referencia)
           <input value={sourceInput} onChange={e=>setSourceInput(e.target.value)}
             maxLength={320} placeholder="Documento o referencia comprobable" required/>
         </label>
         <label>Observación de revisión
           <textarea rows={2} value={reviewNote} onChange={e=>setReviewNote(e.target.value)}
             maxLength={600} placeholder="Indica cómo se validó el precio" required/>
         </label>
         <small>Solo precio de venta directa STECH: no autoriza stock, reservas, descuentos ni envíos. Vence en seis horas.</small>
         <div className="catalog-price-actions">
           <button className="primary-button" type="submit" disabled={savingPrice}>Aprobar precio comprobado</button>
           {review?.review_state==="approved"&&<button type="button" className="secondary-button"
            disabled={savingPrice} onClick={()=>void savePriceReview(p.partnumber,"revoke")}>Revocar precio</button>}
         </div>
       </form>}
     </div>}
    </div>
   </article>;
  })}</div>
 </section>;
}
