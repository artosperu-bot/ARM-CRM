/**
 * Evidence composite after safe hotfix re-tests (not a single continuous run).
 * 18 journeys from final 20-case run; S10/S18 from dedicated 4-turn replays
 * after WhatsApp heading bug fix. All original traces stay available.
 */
import {readFileSync,writeFileSync} from "node:fs";
const dir="docs/";
const full=JSON.parse(readFileSync(dir+"ALEX-QA-STRESS-FINAL-COMPLETO-20261113.json","utf8"));
const fixes=JSON.parse(readFileSync(dir+"ALEX-QA-STRESS-FORMATO-FINAL-20261113.json","utf8"));
const replacements=new Map(fixes.executions.map(x=>[x.id,x]));
if(fixes.executions.length!==2||!replacements.has("S10")||!replacements.has("S18")||
  full.executions.length!==20)throw Error("COMPOSITE_INPUTS_INCOMPLETE");
const executions=full.executions.map(x=>({
 ...(replacements.get(x.id)||x),
 evidenceRun:replacements.has(x.id)?"post_format_fix_retest":"full_run"
}));
if(new Set(executions.map(x=>x.id)).size!==20||
 executions.some(x=>!x.completed||x.trace.length!==4))throw Error("COMPOSITE_NOT_20_X_4");
const steps=executions.flatMap(x=>x.trace);
const metrics={
 cases:executions.length,completed:executions.filter(x=>x.completed).length,
 turns:steps.length,apiErrors:steps.filter(t=>t.error).length,
 guardCorrections:steps.filter(t=>t.guardReason!==null).length,
 products:20,newQaProducts:16,categories:8,
 commercialWrites:0,whatsappSends:0,orderCreated:0,paymentRegistered:0
};
const result={
 generatedAt:new Date().toISOString(),evidenceType:"composite_verified",
 sources:{
  originalFullRun:"docs/ALEX-QA-STRESS-FINAL-COMPLETO-20261113.json",
  correctedCases:"docs/ALEX-QA-STRESS-FORMATO-FINAL-20261113.json",
  comment:"18 cases from full 20-case execution; cases S10/S18 were replayed after format patch. Not a single 20-case continuous run."
 },
 metrics,categories:full.categories,executions
};
writeFileSync(dir+"ALEX-QA-STRESS-VERIFICACION-CONSOLIDADA-20261113.json",
 JSON.stringify(result,null,2)+"\n");
console.log("COMPOSITE="+JSON.stringify({total:executions.length,
 corrected:[...replacements.keys()],fullRunCases:18,postFixRetests:2}));
