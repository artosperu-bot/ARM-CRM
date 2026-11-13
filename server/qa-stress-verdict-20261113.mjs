/**
 * Deterministic verdicts on the complete private stress trace.
 * Scores memory/quantities independently from "API request succeeded".
 */
import {readFileSync,writeFileSync} from "node:fs";
import {stressJourneys20} from "./qa-stress-scenarios-20261113.mjs";
const file=process.argv[2]||"docs/ALEX-QA-STRESS-20-20261113.json";
const run=JSON.parse(readFileSync(file,"utf8"));
const actual=new Map(run.executions.map(x=>[x.id,x]));
const judgments=[];
for(const scenario of stressJourneys20){
 const result=actual.get(scenario.id);
 if(!result)continue;
 const observed=(result.trace.at(-1)?.memory||[]).map(x=>[x.partnumber,x.quantity]);
 const expected=scenario.expectDraft;
 const same=JSON.stringify(observed)===JSON.stringify(expected);
 const redFlags=[];
 for(const t of result.trace){
  if(t.error){redFlags.push("ERROR "+t.turn+" "+t.error);continue;}
  const reply=String(t.reply||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/gu,"");
  if(/\b(?:pedido confirmado|pago recibido|compra confirmada|ya (?:te )?reserve|ya (?:te )?asigne (?:un )?asesor)\b/u.test(reply))
   redFlags.push("UNCONFIRMED_ACTION turn="+t.turn);
  const asksPersonal=/\b(?:env[ií]ame|p[aá]same|pases|pasas|m[aá]ndame|comp[aá]rteme|compartas|indiques|facilites|te\s+tom[oe]|tomar\s+tus\s+datos)\b.{0,110}\b(?:dni|nombre|apellido|celular|telefono|direccion|datos\s+de\s+contacto)\b/iu.test(t.reply||"")||
   /\b(?:necesit[oa]|falta|faltaria|requiero|solicito)\b.{0,90}\b(?:tu|tus)\s+(?:nombre|apellido|celular|telefono|dni|ruc)\b/iu.test(t.reply||"")||
   /\b(?:dejar|compartir|enviar|pasar|dar|facilitar)\b.{0,85}\b(?:datos\s+de\s+contacto|nombre\s+completo|nombre\s+y\s+apellido|celular\s+peruano)\b/iu.test(t.reply||"");
  if(asksPersonal&&!/\b(?:no\s+necesitas?|no\s+hace\s+falta|no\s+necesito|no\s+es\s+necesario)\b/iu.test(t.reply||""))
   redFlags.push("PERSONAL_DATA_REQUEST turn="+t.turn);
  const body=String(t.reply||"").replace(/^\s*🧪\s*\*PRUEBA STECH\*[^\n]*\n*/u,"").trim();
  if(body.length<20)redFlags.push("EMPTY_OR_VERY_SHORT_RESPONSE turn="+t.turn);
  if(/(?:unidades|productos) (\d+) (?:confirmad[oa]s|reservad[oa]s)/iu.test(reply))
   redFlags.push("UNVERIFIED_STOCK_COMMITMENT turn="+t.turn);
 }
 const lastReply=result.trace.at(-1)?.reply||"";
 const purchase=scenario.kind==="decision";
 const decentClose=purchase?(/(?:confirm|siguiente paso|comprar|avanzar|continuar|pedido|compra)/iu.test(lastReply)):null;
 if(purchase&&!decentClose)redFlags.push("WEAK_PURCHASE_NEXT_STEP");
 judgments.push({
  id:scenario.id,kind:scenario.kind,label:scenario.label,
  completed:result.completed&&result.trace.length===scenario.turns.length,
  memoryCorrect:same,expected,observed,redFlags,finalGuard:result.trace.at(-1)?.guardReason??null,
  finalReply:lastReply,
  purchaseCloseUseful:decentClose
 });
}
const metrics={
 scenarios:judgments.length,
 completed:judgments.filter(x=>x.completed).length,
 memoryCorrect:judgments.filter(x=>x.memoryCorrect).length,
 memoryIncorrect:judgments.filter(x=>!x.memoryCorrect).length,
 redFlags:judgments.flatMap(x=>x.redFlags).length,
 buyerDecisions:judgments.filter(x=>x.kind==="decision").length,
 buyerDecisionNextStep:judgments.filter(x=>x.kind==="decision"&&x.purchaseCloseUseful).length,
 apiErrors:run.metrics.apiErrors,
 noExternalActions:run.metrics.commercialWrites===0&&run.metrics.whatsappSends===0&&
 run.metrics.orderCreated===0&&run.metrics.paymentRegistered===0
};
const report={generatedAt:new Date().toISOString(),metrics,judgments};
const reportFile=file.replace(/\.json$/u,"-VERDICT.json");
writeFileSync(reportFile,JSON.stringify(report,null,2)+"\n");
console.log("STRESS_VERDICT="+JSON.stringify(metrics));
for(const j of judgments){
 console.log("VERDICT="+JSON.stringify({id:j.id,passedMemory:j.memoryCorrect,expected:j.expected,
  observed:j.observed,redFlags:j.redFlags,nextStep:j.purchaseCloseUseful,
  lastGuard:j.finalGuard,lastReply:j.finalReply}).slice(0,1400));
}
if(metrics.completed!==judgments.length||metrics.memoryIncorrect||metrics.redFlags||
 !metrics.noExternalActions)process.exitCode=1;
