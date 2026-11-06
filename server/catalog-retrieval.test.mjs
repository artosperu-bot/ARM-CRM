import {describe,it,expect} from "vitest";
import {catalogQueries,reviewedProductFacts,retrieveSalesCatalog} from "./catalog-retrieval.mjs";
import {enrichCatalog} from "./product-knowledge.mjs";
const workspace="workspace-private";
function row(partnumber,rank=10,overrides={}){
 return {id:partnumber,workspace_id:workspace,partnumber,title:partnumber,brand:"MARCA QA",
    attributes:{},verified_at:null,price_pen:null,stock_erp:100,category_path:["categoria"],
    family_key:null,variant_options:{},search_rank:rank,...overrides};
}
function fakeDb(results,facts=[]){
 const calls=[];
 return {calls,
  client:{
   async rpc(name,params){
    calls.push({kind:"rpc",name,params});
    return {data:typeof results==="function"?results(params):results,error:null};
   },
   from(table){
    const q={
     eq(){return q},in(){return q},select(){return q},
     async limit(n){calls.push({kind:"facts",table,limit:n});return {data:facts,error:null};}
    };return q;
   }
  }
 };
}
describe("catalog queries: future products without category-specific code",()=>{
 it("chooses most recent useful product inquiry, not greetings or price-only followup",()=>{
  const queries=catalogQueries(["Me interesa la impresora Epson EcoTank L1250","¿Cuánto cuesta?"]);
  expect(queries[0]).toMatch(/impresora.*epson.*ecotank.*l1250/u);
  expect(queries).toHaveLength(1);
 });
 it("extracts a never-before-seen model from customer's question",()=>{
  expect(catalogQueries(["¿Tienen equipos Schneider Magelis XBTGT2230?"])[0])
     .toContain("schneider magelis xbtgt2230");
 });
 it("keeps actual PN search tokens but never copies budget into search",()=>{
  expect(catalogQueries(["Presupuesto S/ 2500 para un cargador Anker 737"])[0])
     .toContain("anker 737");
  expect(catalogQueries(["Presupuesto S/ 2500 para un cargador Anker 737"])[0])
     .not.toContain("2500");
 });
 it("avoids product lookup when customer cancels or says goodbye",()=>{
  expect(catalogQueries(["Quiero una laptop","Gracias por todo"])).toEqual([]);
  expect(catalogQueries(["Quiero un celular","Stop"])).toEqual([]);
 });
});
describe("bounded SKU retrieval with workspace isolation",()=>{
 it("returns only the highest ranked products, even when thousands exist elsewhere",async()=>{
  const db=fakeDb(()=>Array.from({length:25},(_,i)=>row("SKU-"+i,25-i)));
  const result=await retrieveSalesCatalog(db.client,workspace,["Busco una impresora",{text:"ignored"},"La impresora económica"],{limit:6});
  expect(result.products.length).toBeLessThanOrEqual(6);
  expect(db.calls.filter(x=>x.kind==="rpc").every(x=>x.params.p_workspace_id===workspace)).toBe(true);
  expect(db.calls.filter(x=>x.kind==="rpc").length).toBeLessThanOrEqual(2);
 });
 it("does not return products from another workspace, even from a bad backend result",async()=>{
  const db=fakeDb([row("OWN",10),row("OTHER",999,{workspace_id:"other-workspace"})]);
  const result=await retrieveSalesCatalog(db.client,workspace,["busco un router"]);
  expect(result.products.map(x=>x.partnumber)).toEqual(["OWN"]);
 });
 it("preserves exact variants and avoids mixing equivalent-looking SKUs",async()=>{
  const db=fakeDb([row("T14-16-512",90),row("T14-32-1TB",80)]);
  const result=await retrieveSalesCatalog(db.client,workspace,["Lenovo ThinkPad T14 32 GB"]);
  expect(result.products.map(x=>x.partnumber)).toEqual(["T14-16-512","T14-32-1TB"]);
 });
 it("no query means no arbitrary first 25 products",async()=>{
  const db=fakeDb([row("SKU")]);
  const result=await retrieveSalesCatalog(db.client,workspace,["Hola"]);
  expect(result.products).toEqual([]);
  expect(db.calls).toEqual([]);
 });
 it("fails closed when Supabase search cannot execute",async()=>{
  await expect(retrieveSalesCatalog({rpc:async()=>({data:null,error:{code:"42501"}})},
    workspace,["Busco impresora"])).rejects.toThrow("ARM_CATALOG_SEARCH_FAILED");
 });
});
describe("product facts: evidence and freshness",()=>{
 it("excludes pending/rejected/expired and unreviewed sources",()=>{
  const base={partnumber:"SKU",fact_key:"garantia",fact_value:"12 meses",source_type:"manufacturer",
    source_url:"https://manufacturer.example/support",review_status:"verified",reviewed_at:"2026-11-01T00:00:00Z",expires_at:null};
  const result=reviewedProductFacts([
   base,
   {...base,fact_key:"compatible",review_status:"pending"},
   {...base,fact_key:"vencida",expires_at:"2026-11-04T00:00:00Z"},
   {...base,fact_key:"sin_fuente",source_url:null},
   {...base,fact_key:"rechazada",review_status:"rejected"}
  ],{now:Date.parse("2026-11-05T21:00:00Z")});
  expect(Object.keys(result.SKU)).toEqual(["garantia"]);
 });
 it("uses reviewed facts for any product with category and variant, without changing stock",()=>{
  const output=enrichCatalog([{title:"Router Wi-Fi 7",brand:"FABRICANTE",partnumber:"ROUTER-7",
     price_pen:null,stock_erp:50,verified_at:null,category_path:["redes","routers"],
     family_key:"router-wifi7",variant_options:{ports:4},attributes:{}}],
    false,[],{factsByPn:{"ROUTER-7":{wifi_standard:{value:"Wi-Fi 7",source_type:"manufacturer"}}}});
  expect(output[0].especificaciones_fabricante.wifi_standard.value).toBe("Wi-Fi 7");
  expect(output[0].variante.ports).toBe(4);
  expect(output[0].precio_soles).toBe(null);
  expect(output[0].disponibilidad).toBe("por confirmar");
 });
});
