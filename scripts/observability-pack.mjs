import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../observability/',import.meta.url);
export const queryFiles=['http-error-rate','runtime-latency','http-detector','rejected-outbox','export-failures','reminder-due-age','gemini-failure-rate','queue-backlog','outbox-health','database-latency','gemini-latency','deployment-overlay','journey-errors','rum-native-requests','http-latency-p95-buckets','worker-lag-p95-buckets'];
export const optionalQueries=new Set(['http-latency-p95-buckets','worker-lag-p95-buckets']);
export async function readPack(){return JSON.parse(await readFile(new URL('detections.json',root),'utf8'));}
export function assess(rule,sample){
 if(!sample||!Number.isFinite(sample.value)||sample.value<0)return 'unknown';
 if(rule.minimumVolume!==null&&(!Number.isFinite(sample.observations)||sample.observations<rule.minimumVolume))return 'unknown';
 return sample.value>rule.threshold?'breach':'healthy';
}
// Offline policy rehearsal, not an alert service. Missing input never resolves an incident.
export function advance(rule,state={open:false,breaches:0,healthy:0},sample){
 const outcome=assess(rule,sample);
 if(outcome==='unknown')return {open:state.open,breaches:0,healthy:0,outcome};
 const breaches=outcome==='breach'?state.breaches+1:0,healthy=outcome==='healthy'?state.healthy+1:0;
 return {open:breaches>=rule.violatingEvaluations?true:healthy>=rule.recoveryEvaluations?false:state.open,breaches,healthy,outcome};
}
export function detectorSuffix(rule){return `\n| fieldsAdd eligible = isNotNull(value) and value>=0${rule.minimumVolume===null?'':` and observations>=${rule.minimumVolume}`}\n| fieldsAdd breach = if(eligible,value>${rule.threshold},else:null)\n`;}
export async function buildNotebook(){
 const pack=await readPack(),sections=[{id:'intro',type:'markdown',markdown:'# SalesDrone — release and runtime investigation\nProduction-only telemetry. Detector inputs are lookback summaries, not installed alerts. Review thresholds and use the operator guide. Runtime latency is a mean; optional histogram p95 requires tenant bucket ingestion. No tenant resource IDs or notification destinations are included.\n\nDeployment and runtime sections use explicit documented lookbacks; change them together when investigating a release.'}];
 for(const name of queryFiles.filter(n=>n!=='worker-lag-p95-buckets')){
  let value=await readFile(new URL(`queries/${name}.dql`,root),'utf8');const rule=pack.rules.find(r=>r.query===`queries/${name}.dql`);if(rule)value+=detectorSuffix(rule);
  sections.push({id:createHash('sha256').update(name).digest('hex').slice(0,32),type:'dql',title:name.replaceAll('-',' '),showTitle:true,showInput:true,state:{input:{value},visualization:'table',visualizationSettings:{autoSelectVisualization:true,chartSettings:{}},querySettings:{maxResultRecords:1000,defaultScanLimitGbytes:1,maxResultMegaBytes:1,enableSampling:false}}});
 }
 return {name:'SalesDrone — release and runtime investigation',type:'notebook',content:{version:'7',defaultTimeframe:{from:'now()-2h',to:'now()'},sections}};
}
if(process.argv[1]&&import.meta.url===new URL(process.argv[1],'file:').href){
 const expected=JSON.stringify(await buildNotebook(),null,2)+'\n',target=new URL('salesdrone-runtime.notebook.json',root);
 if(process.argv.includes('--check')){if(await readFile(target,'utf8')!==expected)throw Error('Regenerate the offline observability notebook');console.log('Offline notebook matches reviewed query sources.');}
 else{await writeFile(target,expected);console.log('Generated offline notebook; no tenant resources created.');}
}
