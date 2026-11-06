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
export default function CatalogPage({products,workspaceId}:{products:Product[],workspaceId:string}){
 const [filter,setFilter]=useState("");
 const [sourceFilter,setSourceFilter]=useState("all");
 const [observations,setObservations]=useState<StockObservation[]>([]);
 const [mappings,setMappings]=useState<ProductMapping[]>([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const load=useCallback(async()=>{
  if(!supabase)return;
  setLoading(true);setError("");
  const [o,m]=await Promise.all([
   supabase.from("arm_erp_stock_observations")
     .select("arm_partnumber,erp_partnumber,source_updated_at,observed_at,physical_units,freshness")
     .eq("workspace_id",workspaceId).limit(500),
   supabase.from("arm_erp_product_map")
     .select("arm_partnumber,erp_partnumber,mapping_status,evidence")
     .eq("workspace_id",workspaceId).limit(500)
  ]);
  if(o.error||m.error)setError(o.error?.message||m.error?.message||"No se pudo consultar la evidencia del ERP.");
  else{
   setObservations((o.data||[]) as StockObservation[]);
   setMappings((m.data||[]) as ProductMapping[]);
  }
  setLoading(false);
 },[workspaceId]);
 useEffect(()=>{void load();},[load]);
 const obsByPn=useMemo(()=>new Map(observations.map(x=>[x.arm_partnumber,x])),[observations]);
 const mapByPn=useMemo(()=>new Map(mappings.map(x=>[x.arm_partnumber,x])),[mappings]);
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
   <span>Origen: <strong>PC005 / DB_ST</strong></span>
  </div>
  <p className="erp-disclaimer">El stock físico observado no representa disponibilidad comprometible: todavía falta descontar reservas, pedidos y ventas multicanal. La aplicación no utiliza estos valores para responder precios ni prometer stock.</p>
  {error&&<div role="alert" className="auth-error">{error}</div>}
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
   const state=sourceState(obs);
   return <article className="product" key={p.partnumber}>
    <span className="product-icon"><Package size={24}/></span>
    <div><strong>{p.title}</strong><p>{p.brand} · PN ARM: {p.partnumber}</p></div>
    <div className="product-meta">
     <span>Precio de venta: {p.price===null?"No validado":new Intl.NumberFormat("es-PE",{style:"currency",currency:"PEN"}).format(p.price)}</span>
     <span>Disponibilidad vendible: <strong>Por confirmar</strong></span>
     <span className={"erp-evidence-state "+state}>{statusLabels[state]}</span>
     {obs&&<small>Fuente ERP: {obs.erp_partnumber} · {new Date(obs.source_updated_at).toLocaleString("es-PE",{dateStyle:"short",timeStyle:"short"})}</small>}
     {obs&&state==="fresh"&&<small>Existencias físicas observadas: {obs.physical_units} (uso interno; no prometer entrega)</small>}
     {map?.mapping_status==="candidate"&&<small className="erp-pn-warning">Verificar equivalencia: {p.partnumber} → {map.erp_partnumber}</small>}
     {!obs&&<small>Sin lectura ERP para este producto.</small>}
    </div>
   </article>;
  })}</div>
 </section>;
}
