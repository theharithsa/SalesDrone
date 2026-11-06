// Synthetic, memory-only business writes. Never targets the production database.
import {cloud} from './cloud-access.mjs';
import {createTelemetry} from '../functions/src/telemetry.js';
import {observableStore} from '../functions/src/observable-store.js';
import {memoryStore} from '../functions/src/store.js';
import {deliverTelemetry} from '../functions/src/telemetry-outbox.js';
import {path} from '../functions/src/policy.js';
import {APP_VERSION,BUILD_COMMIT} from '../functions/src/version.js';
const tenant='https://indiacs.live.dynatrace.com';
const secret=await cloud('https://secretmanager.googleapis.com/v1/projects/sales-drone-avinya/secrets/DYNATRACE_API_TOKEN/versions/latest:access');
const key=Buffer.from(secret.payload.data,'base64').toString();
const t=createTelemetry({tenant,key,service:'salesdrone-validation',environment:'verification'});
const base=memoryStore({[path('leads','fixture')]:{id:'fixture',stage:'New',version:1}}),store=observableStore(base,()=>t);
try{
 await t.worker('validation',async()=>{
  await store.run(async tx=>{const lead=await tx.get(path('leads','fixture'));tx.set(path('leads','fixture'),{...lead,stage:'Qualified',version:2});});
  const rows=await base.query(path('telemetryOutbox'),{limit:20});
  const tag=event=>({...event,source:'com.avinyatech.salesdrone.validation',data:{...event.data,'event.provider':'com.avinyatech.salesdrone.validation','event.authority':'synthetic-verification','validation.synthetic':true}});
  await base.run(async tx=>{for(const row of rows)tx.set(path('telemetryOutbox',row.id),{...row,event:tag(row.event),...(row.additionalEvents?{additionalEvents:row.additionalEvents.map(tag)}:{})});});
  const result=await deliverTelemetry({store:base,tenant,key,telemetry:t});
  const receipts=await base.query(path('telemetryOutbox'),{limit:20});
  if(receipts.some(r=>r.status!=='Delivered'))throw Error('Synthetic journey ingestion incomplete');
  await t.flush();
  console.log(JSON.stringify({synthetic:true,version:APP_VERSION,commit:BUILD_COMMIT,service:'salesdrone-validation',environment:'verification',events:receipts.flatMap(r=>[r.event,...(r.additionalEvents||[])]).map(e=>({id:e.id,type:e.type})),result,tenantSearchability:'not established by HTTP acceptance'}));
  return {processed:receipts.length};
 });
 await t.flush();
}finally{await t.shutdown();}
