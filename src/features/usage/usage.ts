export type UsageEvent = {
 id:number; session_id:string; message_id:string|null; model:string; node:string|null;
 input_tokens:number; output_tokens:number; cached_input_tokens:number;
 cost_usd:number|null; cost_source:"unavailable"|"provider"|"rate_card_estimate";
 occurred_at:string; source:string;
};
export type UsageSession = {
 sessionId:string; calls:number; input:number; output:number; cached:number;
 measuredCost:number; costKnownCalls:number; models:string[]; lastSeen:string; firstSeen:string;
};
export const fmtTokens = (n:number) => new Intl.NumberFormat("es-PE").format(n);
export function sumUsage(events:UsageEvent[]){
 const sum=(field:"input_tokens"|"output_tokens"|"cached_input_tokens")=>events.reduce((v,e)=>v+e[field],0);
 return {
  calls:events.length,input:sum("input_tokens"),output:sum("output_tokens"),cached:sum("cached_input_tokens"),
  sessions:new Set(events.map(e=>e.session_id)).size,
  measuredCost:events.reduce((v,e)=>v+(e.cost_usd ?? 0),0), costKnownCalls:events.filter(e=>e.cost_usd!==null).length
 };
}
export function groupSessions(events:UsageEvent[]):UsageSession[]{
 const m=new Map<string,UsageSession>();
 for(const e of events){
  const prev=m.get(e.session_id)??{sessionId:e.session_id,calls:0,input:0,output:0,cached:0,measuredCost:0,costKnownCalls:0,models:[],lastSeen:e.occurred_at,firstSeen:e.occurred_at};
  prev.calls++;prev.input+=e.input_tokens;prev.output+=e.output_tokens;prev.cached+=e.cached_input_tokens;
  if(e.cost_usd!==null){prev.measuredCost+=e.cost_usd;prev.costKnownCalls++;}
  if(!prev.models.includes(e.model))prev.models.push(e.model);
  if(e.occurred_at>prev.lastSeen)prev.lastSeen=e.occurred_at;
  if(e.occurred_at<prev.firstSeen)prev.firstSeen=e.occurred_at;
  m.set(e.session_id,prev);
 }
 return [...m.values()].sort((a,b)=>b.lastSeen.localeCompare(a.lastSeen));
}
export function modelTotals(events:UsageEvent[]){
 const groups=new Map<string,{model:string;input:number;output:number;cached:number;calls:number}>();
 for(const e of events){
  const row=groups.get(e.model)??{model:e.model,input:0,output:0,cached:0,calls:0};
  row.input+=e.input_tokens;row.output+=e.output_tokens;row.cached+=e.cached_input_tokens;row.calls++;
  groups.set(e.model,row);
 }
 return [...groups.values()].sort((a,b)=>(b.input+b.output)-(a.input+a.output));
}
