import{test}from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{readPack,assess,advance,buildNotebook,queryFiles,optionalQueries,detectorSuffix}from'../scripts/observability-pack.mjs';
import{validateQueries}from'../scripts/validate-observability-pack.mjs';
const pack=await readPack();
test('all detector policies reject missing inputs, debounce breaches and recover only on eligible healthy data',()=>{
 for(const rule of pack.rules){
  const bad={value:rule.threshold+1,observations:rule.minimumVolume??1},good={value:rule.threshold,observations:rule.minimumVolume??1};
  assert.equal(assess(rule,bad),'breach');assert.equal(assess(rule,good),'healthy');
  assert.equal(assess(rule,{...bad,value:NaN}),'unknown');assert.equal(assess(rule,{...bad,value:null}),'unknown');assert.equal(assess(rule,undefined),'unknown');
  if(rule.minimumVolume!==null)assert.equal(assess(rule,{...bad,observations:rule.minimumVolume-1}),'unknown');
  let state=advance(rule,undefined,bad);state=advance(rule,state,bad);assert.equal(state.open,false);
  state=advance(rule,state,undefined);assert.equal(state.breaches,0);
  for(let n=0;n<rule.violatingEvaluations;n++)state=advance(rule,state,bad);assert.equal(state.open,true);
  state=advance(rule,state,undefined);assert.equal(state.open,true);assert.equal(state.outcome,'unknown');
  for(let n=0;n<rule.recoveryEvaluations-1;n++)state=advance(rule,state,good);assert.equal(state.open,true);
  state=advance(rule,state,good);assert.equal(state.open,false);
 }
});
test('rates require full minimum volumes, threshold boundaries and null idle values',()=>{
 const http=pack.rules.find(r=>r.id==='http-server-errors'),ai=pack.rules.find(r=>r.id==='gemini-failures');
 assert.equal(assess(http,{value:100,observations:19}),'unknown');assert.equal(assess(http,{value:5,observations:20}),'healthy');assert.equal(assess(http,{value:10,observations:20}),'breach');
 assert.equal(assess(ai,{value:30,observations:9}),'unknown');assert.equal(assess(ai,{value:20,observations:10}),'healthy');assert.equal(assess(ai,{value:30,observations:10}),'breach');
 for(const r of [http,ai])assert.equal(assess(r,{value:null,observations:0}),'unknown');
});
test('offline notebook is deterministic, bounded and generated from production-only sources without tenant IDs or notifications',async()=>{
 const actual=JSON.parse(await readFile('observability/salesdrone-runtime.notebook.json','utf8')),expected=await buildNotebook();assert.deepEqual(actual,expected);assert.equal(actual.type,'notebook');assert.ok(!actual.id);
 for(const section of actual.content.sections.filter(s=>s.type==='dql')){
  assert.equal(section.showInput,true);assert.equal(section.state.visualizationSettings.autoSelectVisualization,true);assert.equal(section.state.querySettings.enableSampling,false);
  const q=section.state.input.value;assert.ok(q.includes('production')||q.includes('url.domain'));assert.ok(!q.includes('percentile(salesdrone.http.duration,'));
 }
 const serialized=JSON.stringify(actual);assert.ok(!serialized.includes('notificationId'));assert.ok(!serialized.includes('Api-Token'));
 for(const r of pack.rules){assert.ok(actual.content.sections.some(s=>s.state?.input.value.endsWith(detectorSuffix(r))));assert.ok(r.windowMinutes>0);assert.ok(r.violatingEvaluations>=3);}
 assert.ok(optionalQueries.has('http-latency-p95-buckets'));
});
test('query verification distinguishes observed data, no traffic, tenant prerequisites and required failures',async()=>{
 let n=0;const report=await validateQueries(async q=>{assert.ok(q.length>10);n++;return{records:[],warnings:false};});
 assert.equal(n,queryFiles.length);assert.equal(report.valid,true);assert.equal(report.results.filter(r=>r.status==='requires-tenant-setup-or-traffic').length,2);assert.ok(report.results.filter(r=>!r.optional).every(r=>r.status==='valid-no-data'));
 const failed=await validateQueries(async()=>{throw Error('PRIVATE VENDOR ERROR');});assert.equal(failed.valid,false);assert.ok(!JSON.stringify(failed).includes('PRIVATE'));assert.equal(failed.results.filter(r=>r.status==='query-failed').length,queryFiles.length);
 const warnings=await validateQueries(async()=>({records:[],warnings:true}));assert.equal(warnings.valid,false);
 const seen=await validateQueries(async()=>({records:[{safe:true}]}));assert.ok(seen.results.every(r=>r.status==='data-visible'));assert.ok(!JSON.stringify(seen).includes('safe'));
});
