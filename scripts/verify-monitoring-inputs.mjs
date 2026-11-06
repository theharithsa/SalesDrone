// Explicit synthetic dependency responses and health snapshots. No production DB,
// provider request, tenant configuration, alert creation or notification routing.
import {cloud} from './cloud-access.mjs';
import {createTelemetry} from '../functions/src/telemetry.js';
import {geminiRequest} from '../functions/src/dependency-observability.js';
import {DEFAULT_GEMINI_MODEL} from '../functions/src/model-config.js';
import {APP_VERSION,BUILD_COMMIT} from '../functions/src/version.js';
const secret=await cloud('https://secretmanager.googleapis.com/v1/projects/sales-drone-avinya/secrets/DYNATRACE_API_TOKEN/versions/latest:access');
const key=Buffer.from(secret.payload.data,'base64').toString();
const t=createTelemetry({tenant:'https://indiacs.live.dynatrace.com',key,service:'salesdrone-validation',environment:'verification'});
const traceIds=[];
try{
 for(const phase of ['failure','recovery'])await t.worker('validation',async()=>{
  traceIds.push(t.capture().traceparent?.split('-')[1]);
  const failed=phase==='failure';
  t.queueHealth('reminders',failed?2:0,failed?new Date(Date.now()-600000).toISOString():undefined);
  t.workItem('reminders','processed',new Date(Date.now()-(failed?600000:0)).toISOString());
  t.outboxHealth({Pending:0,Sending:0,Rejected:failed?1:0},0);
  await t.span('gemini.synthetic',()=>geminiRequest(async()=>failed?new Response('',{status:503}):Response.json({usageMetadata:{promptTokenCount:7,candidatesTokenCount:2},candidates:[{finishReason:'STOP'}]}),`https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent`,{},t));
  t.log('instrumentation.validation',{outcome:phase});
  await t.flush();return {processed:1};
 });
 await t.flush();
 console.log(JSON.stringify({synthetic:true,version:APP_VERSION,commit:BUILD_COMMIT,environment:'verification',service:'salesdrone-validation',phases:['failure','recovery'],traceIds,exportHealth:t.diagnostics(),boundary:'Synthetic OTLP signal transport; not a real provider outage, production job, installed detector or notification test'}));
}finally{await t.shutdown();}
