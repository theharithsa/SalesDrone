import {test} from 'node:test';
import assert from 'node:assert/strict';
import {errorType,safeLogFields,collectionName} from '../src/observability-contract.js';
import {semanticChanges} from '../src/business-observability.js';
import {observableStore} from '../src/observable-store.js';
import {memoryStore} from '../src/store.js';
import {path} from '../src/policy.js';
import {observeQueue} from '../src/worker-observability.js';
test('known vendor errors have finite causes; unknown codes and values cannot become log content',()=>{
 for(const [error,expected] of [[{code:10},'GRPC_ABORTED'],[{code:4},'GRPC_DEADLINE_EXCEEDED'],[{code:'messaging/registration-token-not-registered'},'FCM_TOKEN_NOT_REGISTERED'],[{code:'auth/user-not-found'},'AUTH_USER_NOT_FOUND'],[{name:'TimeoutError',code:23},'DEPENDENCY_TIMEOUT'],[{name:'AbortError'},'DEPENDENCY_ABORTED'],[{name:'ZodError'},'SCHEMA_INVALID'],[{code:'PRIVATE_CONTACT'},'INTERNAL']])assert.equal(errorType(error),expected);
 const result=safeLogFields({'error.type':'PRIVATE_CONTACT',body:'PRIVATE',phone:'PRIVATE',stack:'PRIVATE','changed.fields':['name','customFields'],'operation.stage':'PRIVATE'});
 assert.equal(result.dropped,4);assert.ok(!JSON.stringify(result).includes('PRIVATE'));assert.equal(collectionName('users/private/devices/123'),'devices');assert.equal(collectionName('workspaces/avinyatech/private'),'other');
});
test('semantic events preserve current transitions but pseudonymize custom options and entities',()=>{
 const result=semanticChanges('leads',{id:'PRIVATE_ID',stage:'PRIVATE_OLD'},{id:'PRIVATE_ID',stage:'PRIVATE_NEW',source:'PRIVATE_SOURCE',archived:false,doNotContact:false,version:2});
 assert.equal(result.length,1);assert.equal(result[0].type,'leads.stage_changed');assert.ok(!JSON.stringify(result).includes('PRIVATE'));assert.match(result[0]['stage.to'],/^stage:[a-f0-9]{64}$/);
 assert.equal(semanticChanges('leads',{archived:true},{archived:false})[0].type,'leads.restored');
});
test('audit and semantic events are durable without SDK and discarded on rollback; async links preserve source',async()=>{
 const base=memoryStore(),store=observableStore(base);
 await store.run(async tx=>{tx.set(path('auditEvents','test'),{id:'test',actorUid:'PRIVATE',action:'edit-lead',requestId:'synthetic'});tx.set(path('activities','test'),{id:'test',type:'note',leadId:'PRIVATE',notes:'PRIVATE'});});
 const events=await base.query(path('telemetryOutbox'),{limit:20});assert.ok(events.some(e=>e.event.type.endsWith('activities.logged')));assert.ok(events.some(e=>e.event.type.endsWith('audit.operation.committed')));assert.ok(!JSON.stringify(events).includes('PRIVATE'));
 await assert.rejects(store.run(async tx=>{tx.set(path('auditEvents','rollback'),{id:'rollback'});throw Error('abort');}));assert.equal((await base.query(path('telemetryOutbox'),{limit:20})).length,events.length);
 const parent='00-'+ '1'.repeat(32)+'-'+ '2'.repeat(16)+'-01',links=[];
 const traced=observableStore(base,()=>({capture:()=>({traceparent:parent}),span:async(_name,fn)=>fn({addLink:link=>links.push(link)})}));
 await traced.run(async tx=>tx.set(path('noteAnalyses','async'),{id:'async',status:'Pending'}));
 await traced.run(async tx=>tx.get(path('noteAnalyses','async')));
 assert.equal(links[0].context.traceId,'1'.repeat(32));
});
test('queue health uses a full due-count rather than bounded drain length and never exports jobs',async()=>{
 const store=memoryStore();await store.run(async tx=>{for(let i=0;i<8;i++)tx.set(path('noteAnalyses',String(i)),{id:String(i),status:'Pending',nextAttemptAt:'2026-01-01T00:00:00Z',notes:'PRIVATE'});});
 const observations=[];await observeQueue(store,{queueHealth:(...v)=>observations.push(v),log:()=>assert.fail('unexpected failure')},'analysis','2026-01-02T00:00:00Z');assert.deepEqual(observations,[['analysis',8,'2026-01-01T00:00:00Z']]);
});
test('transaction retry retains one final semantic outcome and records actual attempt count',async()=>{
 const base=memoryStore({[path('leads','lead')]:{id:'lead',stage:'New',version:1}}),attributes={};
 const retry={...base,run:async fn=>{await assert.rejects(base.run(async tx=>{await fn(tx);throw Error('synthetic contention');}));return base.run(fn);}};
 const t={span:async(_name,fn)=>fn({setAttribute:(key,value)=>attributes[key]=value}),capture:()=>({traceparent:null})};
 const store=observableStore(retry,()=>t);
 await store.run(async tx=>{const v=await tx.get(path('leads','lead'));tx.set(path('leads','lead'),{...v,stage:'Qualified',version:2});});
 const events=await base.query(path('telemetryOutbox'),{limit:20});assert.equal(events.filter(e=>e.event.type.endsWith('leads.stage_changed')).length,1);assert.equal(attributes['db.transaction.attempts'],2);assert.equal((await base.get(path('leads','lead'))).version,2);
});
test('large reassignment telemetry stays below Firestore write limits without dropping semantic events',async()=>{
 const seed={};for(let i=0;i<25;i++)seed[path('leads','lead'+i)]={id:'lead'+i,stage:'New',assignedToUid:null,name:'PRIVATE'};
 for(let i=0;i<200;i++)seed[path('tasks','task'+i)]={id:'task'+i,leadId:'lead'+(i%25),state:'Pending',kind:'outreach',title:'PRIVATE'};
 const base=memoryStore(seed);let writes=0;
 const bounded={...base,run:fn=>base.run(tx=>fn({...tx,set:(p,v)=>{assert.ok(++writes<=500,'Firestore physical write limit');tx.set(p,v);}}))};
 const store=observableStore(bounded);
 await store.run(async tx=>{
  for(let i=0;i<25;i++){const p=path('leads','lead'+i),l=await tx.get(p);tx.set(p,{...l,stage:'Qualified',assignedToUid:'PRIVATE'});tx.set(path('activities','change'+i),{id:'change'+i,type:'change',notes:'PRIVATE'});tx.set(path('leadTransitions','transition'+i),{id:'transition'+i});tx.set('users/synthetic/notifications/notification'+i,{id:'notification'+i});}
  for(let i=0;i<200;i++){const p=path('tasks','task'+i),t=await tx.get(p);tx.set(p,{...t,state:'Cancelled'});}
 });
 const records=await base.query(path('telemetryOutbox'),{limit:500}),events=records.flatMap(r=>[r.event,...(r.additionalEvents||[])]);
 assert.ok(writes<400);assert.ok(records.length<50);assert.equal(events.filter(e=>e.type.endsWith('tasks.cancelled')).length,200);assert.equal(events.filter(e=>e.type.endsWith('leads.stage_changed')).length,25);assert.equal(new Set(events.map(e=>e.id)).size,events.length);assert.ok(records.every(r=>(r.additionalEvents?.length||0)<=9));assert.ok(records.some(r=>r.status==='PendingBatch'));assert.ok(!JSON.stringify(records).includes('PRIVATE'));
});
test('grouped outbox delivery checkpoints each accepted event and resumes without resending acknowledged entries',async()=>{
 const {deliverTelemetry}=await import('../src/telemetry-outbox.js');
 const event=id=>({specversion:'1.0',id,source:'com.avinyatech.salesdrone.validation',type:'com.avinyatech.salesdrone.validation',data:{'validation.synthetic':true}});
 let now='2026-11-06T00:00:00Z',fail=true;const seen=[];
 const store=memoryStore({[path('telemetryOutbox','one')]:{id:'one',status:'PendingBatch',attemptCount:0,nextAttemptAt:now,event:event('one'),additionalEvents:[event('two'),event('three')]}});
 const options={store,tenant:'https://fixture.live.dynatrace.com',key:'synthetic',now:()=>now,fetchImpl:async(_url,o)=>{const e=JSON.parse(o.body);seen.push(e.id);return {status:fail&&e.id==='two'?503:202};}};
 assert.equal((await store.query(path('telemetryOutbox'),{filters:[['status','==','Pending']]})).length,0,'old consumers do not claim grouped records');
 assert.equal((await deliverTelemetry(options)).retried,1);assert.equal((await store.get(path('telemetryOutbox','one'))).nextEvent,1);
 fail=false;now='2026-11-06T00:01:00Z';assert.equal((await deliverTelemetry(options)).delivered,1);
 const record=await store.get(path('telemetryOutbox','one'));assert.equal(record.status,'Delivered');assert.equal(record.nextEvent,3);assert.deepEqual(seen,['one','two','two','three']);
});
