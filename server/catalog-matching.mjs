/**
 * Product-agnostic catalogue matching. Reuses rows supplied by CRM/ERP:
 * no fixed manufacturer, model, or sector definitions.
 * Ambiguous matches remain unverified rather than choosing a product.
 */
const clean=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/([0-9])([a-z])/gu,"$1 $2").replace(/([a-z])([0-9])/gu,"$1 $2").replace(/[^a-z0-9]+/gu," ").replace(/\s+/gu," ").trim();
const ignore=new Set(["para","con","sin","del","por","una","uno","este","marca","modelo","color","version","pro","kit","producto","gb","ram","de","la","el","las","los","and","the"]);
const words=s=>clean(s).split(" ").filter(x=>(x.length>=3||/^\d{2,}$/u.test(x))&&!ignore.has(x)&&!/^\d$/u.test(x));
export function matchCustomerProduct(message,catalog=[]){
 const input=clean(message), tokens=new Set(words(input));
 if(!input||!Array.isArray(catalog)||!catalog.length)return null;
 const candidates=[];
 for(const row of catalog){
  const name=String(row?.titulo||row?.title||"").trim();
  const partnumber=String(row?.partnumber||"").trim();
  const brand=String(row?.marca||row?.brand||"").trim();
  if(!name)continue;
  const pn=clean(partnumber),title=clean(name);
  let strength=0;
  if(pn.length>=5&&input.includes(pn))strength=100;
  else if(title.length>=6&&input.includes(title))strength=90;
  else{
    const ts=[...new Set(words(name))], shared=ts.filter(x=>tokens.has(x)).length;
    if(ts.length>=2&&shared>=2&&shared/ts.length>=0.5)strength=shared/ts.length;
  }
  if(strength>0)candidates.push({name,partnumber,brand,strength});
 }
 candidates.sort((a,b)=>b.strength-a.strength);
 // If two catalogue items fit equally, request clarification in conversation.
 if(!candidates.length||candidates[0].strength===candidates[1]?.strength)return null;
 const {name,partnumber,brand}=candidates[0];
 return {name,partnumber,brand};
}
const countWords={un:1,una:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10};
const baseline=["producto","unidad","equipo","licencia","servicio","suscripcion","laptop","pc","computadora","monitor","impresora","router","telefono","celular","tablet","cargador","silla","camara","bateria","accesorio","teclado","mouse","disco","memoria","proyector","software","adaptador","drone","dron","cartucho","toner","tinta","repuesto","servidor","audifono","parlante"];
function singular(x){return x.replace(/(?:es|s)$/u,"");}
export function quantityForAnyCatalogItem(message,catalog=[]){
 const text=clean(message),valid=new Set(baseline.map(singular));
 for(const row of Array.isArray(catalog)?catalog:[]){
  for(const token of words(row?.titulo||row?.title||""))
    if(token.length>=4)valid.add(singular(token));
 }
 const found=[];
 for(const m of text.matchAll(/\b(\d{1,3}|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+([a-z][a-z0-9]{2,23})\b/gu)){
  const count=Object.hasOwn(countWords,m[1])?countWords[m[1]]:Number(m[1]);
  if(Number.isInteger(count)&&count>0&&count<=999&&valid.has(singular(m[2])))found.push({count,index:m.index});
 }
 return found.at(-1)?.count??null;
}
