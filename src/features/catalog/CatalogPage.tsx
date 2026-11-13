import {AlertTriangle,Database,Package,RefreshCw,Search} from "lucide-react";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import type {Product} from "../../types";
import {supabase} from "../../lib/supabase";
import "./catalog.css";

type CommercialReview={
 partnumber:string;review_state:"pending"|"approved"|"revoked";reviewer_id:string|null;
 review_note:string;price_pen:number|null;price_source_ref:string|null;
 price_reviewed_at:string|null;price_expires_at:string|null;
};
type StockPosition={
 workspace_id:string;partnumber:string;on_hand:number;approved:boolean;
 source_ref:string|null;reviewed_at:string|null;expires_at:string|null;
 held_units:number;available_units:number;
};
type Reservation={
 id:string;partnumber:string;quantity:number;status:"held"|"released"|"expired";
 expires_at:string;
};
const expires=(start:string|null,end:string|null,limit:number,clock:number)=>{
 const a=Date.parse(start||""),b=Date.parse(end||"");
 return Number.isFinite(a)&&Number.isFinite(b)&&a<=clock+120000&&
   clock-a<=limit&&b>clock&&b>a&&b-a<=limit;
};
const priceValue=(r:CommercialReview|undefined,clock:number)=>{
 if(!r||r.review_state!=="approved"||!r.reviewer_id||r.review_note.trim().length<8||
    (r.price_source_ref||"").trim().length<8||r.price_pen===null||
    !(Number(r.price_pen)>0)||!expires(r.price_reviewed_at,r.price_expires_at,21600000,clock))
  return null;
 return Number(r.price_pen);
};
const stockValid=(s:StockPosition|undefined,clock:number)=>
 Boolean(s?.approved&&Number(s.available_units)>0&&
  (s.source_ref||"").trim().length>=8&&
  expires(s.reviewed_at,s.expires_at,3600000,clock));
const money=(n:number)=>new Intl.NumberFormat("es-PE",{style:"currency",currency:"PEN"}).format(n);

export default function CatalogPage({products,workspaceId,isAdmin=false}:{
 products:Product[];workspaceId:string;isAdmin?:boolean;
}){
 const [clock,setClock]=useState(Date.now());
 const [filter,setFilter]=useState("");
 const [sourceFilter,setSourceFilter]=useState("all");
 const [reviews,setReviews]=useState<CommercialReview[]>([]);
 const [positions,setPositions]=useState<StockPosition[]>([]);
 const [reservations,setReservations]=useState<Reservation[]>([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const [priceEditor,setPriceEditor]=useState<string|null>(null);
 const [priceInput,setPriceInput]=useState("");
 const [priceSource,setPriceSource]=useState("");
 const [priceNote,setPriceNote]=useState("");
 const [stockEditor,setStockEditor]=useState<string|null>(null);
 const [units,setUnits]=useState("");
 const [stockSource,setStockSource]=useState("");
 const [stockNote,setStockNote]=useState("");
 const [holdQty,setHoldQty]=useState("1");
 const pendingHold=useRef<{partnumber:string;quantity:number;key:string}|null>(null);

 const load=useCallback(async()=>{
  if(!supabase)return;
  setLoading(true);setError("");
  const skus=products.map(p=>p.partnumber).filter(Boolean);
  const chunks:string[][]=[];
  for(let i=0;i<skus.length;i+=30)chunks.push(skus.slice(i,i+30));
  const [rv,holds,snapshots]=await Promise.all([
   supabase.from("arm_commercial_reviews")
    .select("partnumber,review_state,reviewer_id,review_note,price_pen,price_source_ref,price_reviewed_at,price_expires_at")
    .eq("workspace_id",workspaceId).limit(1000),
   supabase.from("arm_stock_reservations")
    .select("id,partnumber,quantity,status,expires_at")
    .eq("workspace_id",workspaceId).eq("status","held").limit(1000),
   Promise.all(chunks.map(s=>supabase!.rpc("arm_stock_snapshot",{
    p_workspace_id:workspaceId,p_partnumbers:s
   })))
  ]);
  if(rv.error||holds.error||snapshots.some(s=>s.error)){
   setError(rv.error?.message||holds.error?.message||snapshots.find(s=>s.error)?.error?.message||
    "No se pudo consultar el stock de Supabase.");
  }else{
   setReviews((rv.data||[]) as CommercialReview[]);
   setPositions(snapshots.flatMap(s=>(s.data||[]) as StockPosition[]));
   setReservations((holds.data||[]) as Reservation[]);
  }
  setLoading(false);
 },[workspaceId,products]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{const t=setInterval(()=>setClock(Date.now()),60000);return ()=>clearInterval(t);},[]);
 const prices=useMemo(()=>new Map(reviews.map(x=>[x.partnumber,x])),[reviews]);
 const stocks=useMemo(()=>new Map(positions.map(x=>[x.partnumber,x])),[positions]);
 const availableCount=products.filter(p=>stockValid(stocks.get(p.partnumber),clock)).length;
 const pricedCount=products.filter(p=>priceValue(prices.get(p.partnumber),clock)!==null).length;
 const selected=products.filter(p=>{
  if(!(p.partnumber+" "+p.title+" "+p.brand).toLocaleLowerCase("es").includes(filter.toLocaleLowerCase("es")))return false;
  const s=stocks.get(p.partnumber);
  return sourceFilter==="all"||
   (sourceFilter==="approved"&&stockValid(s,clock))||
   (sourceFilter==="review"&&!stockValid(s,clock));
 });

 async function reviewPrice(pn:string,action:"approve"|"revoke"){
  if(!supabase||!isAdmin||busy)return;
  const amount=Number(priceInput.trim().replace(",","."));
  if(action==="approve"&&(!/^[0-9]{1,6}(?:[.,][0-9]{1,2})?$/.test(priceInput.trim())||
    !(amount>0)||priceSource.trim().length<8||priceNote.trim().length<10)){
   setNotice("Completa importe, fuente y justificación verificable.");return;
  }
  if(action==="revoke"&&priceNote.trim().length<10){setNotice("Escribe el motivo de revocación.");return;}
  if(action==="revoke"&&!window.confirm("¿Revocar el precio de este SKU?"))return;
  setBusy(true);setNotice("");
  try{
   const {data,error:failure}=await supabase.rpc("arm_record_direct_price",{
    p_workspace_id:workspaceId,p_partnumber:pn,p_action:action,
    p_price_pen:action==="approve"?amount:null,
    p_source_ref:action==="approve"?priceSource.trim():null,p_note:priceNote.trim()
   });
   if(failure||!data||data.partnumber!==pn||data.action!==action)throw failure||Error("Sin confirmación del CRM");
   await load();setPriceEditor(null);setNotice(action==="approve"?
    "Precio registrado y auditado en Supabase por seis horas. No crea un pedido.":
    "Precio revocado en Supabase.");
  }catch(e){setNotice("Error de revisión: "+(e instanceof Error?e.message:"Datos no autorizados"));}
  finally{setBusy(false);}
 }
 async function reviewStock(pn:string,action:"approve"|"suspend"){
  if(!supabase||!isAdmin||busy)return;
  const count=Number(units);
  if(action==="approve"&&(!/^\d{1,6}$/.test(units)||count>100000||
    stockSource.trim().length<8||stockNote.trim().length<10)){
   setNotice("Ingresa unidades enteras, origen del conteo y motivo comprobable.");return;
  }
  if(action==="suspend"&&stockNote.trim().length<10){
   setNotice("Indica el motivo de suspensión.");return;
  }
  if(action==="suspend"&&!window.confirm("¿Suspender la disponibilidad del SKU en Supabase?"))return;
  if(action==="approve"&&!window.confirm(
   "Confirma que esas unidades están libres para este piloto en Supabase. No se consultarán otros sistemas."))return;
  setBusy(true);setNotice("");
  try{
   const {data,error:failure}=await supabase.rpc("arm_manage_stock",{
    p_workspace_id:workspaceId,p_partnumber:pn,p_action:action,
    p_on_hand:action==="approve"?count:null,
    p_source_ref:action==="approve"?stockSource.trim():null,
    p_note:stockNote.trim()
   });
   if(failure||!data||data.partnumber!==pn)throw failure||Error("Sin confirmación del CRM");
   await load();setStockEditor(null);setNotice(action==="approve"?
    "Inventario aprobado por una hora, exclusivamente en Supabase. La operación no crea una venta.":
    "Inventario suspendido y auditado.");
  }catch(e){setNotice("Error de inventario: "+(e instanceof Error?e.message:"No autorizado"));}
  finally{setBusy(false);}
 }
 async function hold(pn:string,action:"reserve"|"release",id?:string){
  if(!supabase||!isAdmin||busy)return;
  const count=Number(holdQty);
  if(action==="reserve"&&(!/^\d{1,3}$/.test(holdQty)||count<1||count>100)){
   setNotice("Cantidad de reserva entre 1 y 100 unidades.");return;
  }
  if(!window.confirm(action==="reserve"?
    "¿Crear una reserva interna provisional? No es venta, pedido ni pago.":
    "¿Liberar esta reserva provisional?"))return;
  const request=action==="reserve"?
   pendingHold.current?.partnumber===pn&&pendingHold.current.quantity===count?
    pendingHold.current:{partnumber:pn,quantity:count,key:crypto.randomUUID()}:null;
  if(request)pendingHold.current=request;
  setBusy(true);setNotice("");
  try{
   const {data,error:failure}=action==="reserve"?
    await supabase.rpc("arm_hold_stock",{
     p_workspace_id:workspaceId,p_partnumber:pn,p_quantity:count,
     p_idempotency_key:request?.key,p_ttl_minutes:15
    }):
    await supabase.rpc("arm_release_stock",{p_workspace_id:workspaceId,p_reservation_id:id});
   if(failure||!data||!["held","released"].includes(data.status))throw failure||Error("Reserva no confirmada");
   await load();pendingHold.current=null;setNotice(action==="reserve"?
    "Reserva interna registrada y auditada. Vence automáticamente y no constituye pedido.":
    "Reserva liberada en Supabase.");
  }catch(e){setNotice("No se completó la reserva: "+(e instanceof Error?e.message:"Error"));}
  finally{setBusy(false);}
 }
 return <section className="panel">
  <div className="panel-head">
   <div><h2>Catálogo comercial · Supabase</h2><p>Productos, precios, stock y reservas gestionados en el CRM.</p></div>
   <button className="secondary-button" disabled={loading} onClick={()=>void load()}>
    <RefreshCw size={14}/>{loading?"Consultando…":"Actualizar vista"}</button>
  </div>
  <div className="catalog-summary">
   <span><Database size={16}/> <strong>{products.length}</strong> productos</span>
   <span><Database size={16}/> <strong>{pricedCount}</strong> precios autorizados</span>
   <span><Package size={16}/> <strong>{availableCount}</strong> SKUs con disponibilidad interna</span>
   <span>Origen: <strong>Supabase</strong></span>
  </div>
  <p className="catalog-disclaimer">
   <AlertTriangle size={14}/> El stock se registra manualmente para el piloto y caduca en 60 minutos.
   No se sincronizan otras tiendas ni marketplaces. Una reserva provisional no es pedido, pago ni garantía de entrega.
  </p>
  {error&&<div role="alert" className="auth-error">{error}</div>}
  {notice&&<div role="status" className="notice">{notice}</div>}
  <div className="catalog-filter-row">
   <label className="search-box"><Search size={15}/><input aria-label="Buscar productos"
     value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Part number, marca o modelo"/></label>
   <select value={sourceFilter} aria-label="Filtrar stock Supabase" onChange={e=>setSourceFilter(e.target.value)}>
    <option value="all">Todos los productos</option>
    <option value="approved">Stock interno vigente</option>
    <option value="review">Pendiente de revisión</option>
   </select>
  </div>
  {!selected.length&&<div className="empty-records">No hay productos para este filtro.</div>}
  <div className="product-grid">{selected.map(p=>{
   const priceReview=prices.get(p.partnumber),price=priceValue(priceReview,clock);
   const stock=stocks.get(p.partnumber),ready=stockValid(stock,clock);
   const active=reservations.filter(r=>r.partnumber===p.partnumber&&
     r.status==="held"&&Date.parse(r.expires_at)>clock);
   return <article className="product" key={p.partnumber}>
    <span className="product-icon"><Package size={24}/></span>
    <div><strong>{p.title}</strong><p>{p.brand} · SKU: {p.partnumber}</p></div>
    <div className="product-meta">
     <span>Precio directo: <strong>{price===null?"Por confirmar":money(price)}</strong></span>
     <span>Disponibilidad para el piloto: <strong>{ready?"Disponible en CRM":"Por confirmar"}</strong></span>
     {p.price!==null&&price===null&&<small>Precio anterior no verificado, excluido de las respuestas de ALEX.</small>}
     {stock&&<small>Stock Supabase: {stock.on_hand} unidades registradas;
       {stock.held_units} en reservas; {stock.available_units} libres (solo vista interna).</small>}
     {stock?.reviewed_at&&<small>Última revisión: {new Date(stock.reviewed_at).toLocaleString("es-PE")}.</small>}
     {stock&&!ready&&<span className="catalog-evidence-state stale">Stock no aprobado o vencido</span>}
     {!stock&&<span className="catalog-evidence-state pending_mapping">Stock pendiente en Supabase</span>}
     {priceReview?.review_state==="revoked"&&<small>Precio revocado.</small>}
     {priceReview?.price_reviewed_at&&price===null&&
       <small>Precio revisado anteriormente: vencido o sin evidencia suficiente.</small>}

     {isAdmin&&<div className="catalog-price-operator">
      <button className="secondary-button" type="button" disabled={busy}
       onClick={()=>{setPriceEditor(priceEditor===p.partnumber?null:p.partnumber);
        setPriceInput(price===null?"":String(price));
        setPriceSource(priceReview?.price_source_ref||"");setPriceNote("");setNotice("");}}>
       {priceEditor===p.partnumber?"Cancelar revisión":"Revisar precio"}
      </button>
      {priceEditor===p.partnumber&&<form className="catalog-price-form"
       onSubmit={e=>{e.preventDefault();void reviewPrice(p.partnumber,"approve");}}>
       <label>Precio directo (S/)
        <input type="number" min="0.01" max="999999.99" step="0.01"
         required value={priceInput} onChange={e=>setPriceInput(e.target.value)}/></label>
       <label>Fuente del precio
        <input required maxLength={320} value={priceSource}
         onChange={e=>setPriceSource(e.target.value)} placeholder="Lista o documento validado"/></label>
       <label>Observación de revisión
        <textarea required maxLength={600} rows={2} value={priceNote}
         onChange={e=>setPriceNote(e.target.value)}/></label>
       <div className="catalog-price-actions">
        <button className="primary-button" disabled={busy} type="submit">Aprobar precio</button>
        {priceReview?.review_state==="approved"&&<button type="button"
         className="secondary-button" disabled={busy}
         onClick={()=>void reviewPrice(p.partnumber,"revoke")}>Revocar</button>}
       </div>
      </form>}
      <button type="button" className="secondary-button" disabled={busy}
       onClick={()=>{setStockEditor(stockEditor===p.partnumber?null:p.partnumber);
        setUnits(stock?String(stock.on_hand):"");setStockSource(stock?.source_ref||"");
        setStockNote("");setNotice("");}}>
       {stockEditor===p.partnumber?"Cancelar inventario":"Registrar stock Supabase"}
      </button>
      {stockEditor===p.partnumber&&<form className="catalog-price-form"
        onSubmit={e=>{e.preventDefault();void reviewStock(p.partnumber,"approve");}}>
       <label>Unidades libres de compromisos externos, verificadas para el piloto
        <input type="number" min="0" max="100000" step="1" required
         value={units} onChange={e=>setUnits(e.target.value)}/></label>
       <label>Fuente del conteo
        <input maxLength={320} required value={stockSource} onChange={e=>setStockSource(e.target.value)}/></label>
       <label>Motivo o referencia de comprobación
        <textarea rows={2} required maxLength={600} value={stockNote}
         onChange={e=>setStockNote(e.target.value)}/></label>
       <small>El stock aprobado vence en una hora. ALEX nunca confirma una operación sin reserva.</small>
       <div className="catalog-price-actions">
        <button className="primary-button" disabled={busy} type="submit">Aprobar inventario</button>
        {stock?.approved&&<button className="secondary-button" type="button" disabled={busy}
         onClick={()=>void reviewStock(p.partnumber,"suspend")}>Suspender</button>}
       </div>
      </form>}
      {ready&&<div className="catalog-price-form">
       <strong>Reservas internas de prueba</strong>
       <label>Unidades
        <input type="number" min="1" max="100" step="1" value={holdQty}
         onChange={e=>setHoldQty(e.target.value)}/></label>
       <button className="secondary-button" disabled={busy} type="button"
        onClick={()=>void hold(p.partnumber,"reserve")}>Crear reserva provisional (15 minutos)</button>
       {active.map(r=><div key={r.id} className="catalog-price-actions">
        <small>{r.quantity} ud. retenidas hasta {new Date(r.expires_at).toLocaleTimeString("es-PE")}</small>
        <button className="secondary-button" disabled={busy} type="button"
          onClick={()=>void hold(p.partnumber,"release",r.id)}>Liberar</button>
       </div>)}
      </div>}
     </div>}
    </div>
   </article>;
  })}</div>
 </section>;
}
