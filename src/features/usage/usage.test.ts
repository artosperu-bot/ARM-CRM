import { describe,expect,it } from "vitest";
import { groupSessions,modelTotals,sumUsage,type UsageEvent } from "./usage";
const e=(id:number,session_id:string,input_tokens:number,output_tokens:number,cached_input_tokens:number,cost_usd:number|null):UsageEvent=>({
 id,session_id,input_tokens,output_tokens,cached_input_tokens,cost_usd,message_id:null,
 model:"model-a",node:null,cost_source:cost_usd===null?"unavailable":"provider",
 occurred_at:"2026-08-31T12:00:00Z",source:"legacy_ia_metricas_tokens"
});
describe("contabilidad del uso real de modelos",()=>{
 const events=[e(1,"a",100,20,30,null),e(2,"a",60,10,10,null),e(3,"b",20,5,0,0.01)];
 it("no suma tokens cacheados por segunda vez",()=>{
  const x=sumUsage(events);expect(x.input).toBe(180);expect(x.output).toBe(35);expect(x.cached).toBe(40);
  expect(x.sessions).toBe(2);expect(x.costKnownCalls).toBe(1);
 });
 it("agrupa por conversación y conserva costo desconocido",()=>{
  const s=groupSessions(events);expect(s.find(x=>x.sessionId==="a")?.calls).toBe(2);
  expect(s.find(x=>x.sessionId==="a")?.costKnownCalls).toBe(0);
 });
 it("cuenta todos los modelos y llamadas",()=>{
  expect(modelTotals(events)[0].calls).toBe(3);
 });
});
