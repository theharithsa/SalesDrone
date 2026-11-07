import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/app.js';
import {memoryStore} from '../src/store.js';
import {observableStore} from '../src/observable-store.js';
import {CAPABILITIES} from '../src/contracts.js';
import {path} from '../src/policy.js';

test('actual note/follow-up save and administrative task completion export persisted domain facts without private text',async()=>{
 const uid='synthetic-admin',base=memoryStore({[path('members',uid)]:{id:uid,uid,role:'Admin',scope:'all',active:true,version:1,capabilities:CAPABILITIES}}),store=observableStore(base);
 const app=createApp({store,now:()=> '2026-11-06T08:00:00.000Z',verifyToken:async()=>({uid,email:'admin@example.invalid',email_verified:true,firebase:{sign_in_provider:'google.com'}})});
 const call=(method,url,body)=>{const r=request(app)[method]('/api/v1'+url).set('Authorization','Bearer '+uid).set('Idempotency-Key',randomUUID());return body?r.send(body):r;};
 const lead=(await call('post','/leads',{name:'Synthetic person',phone:'+12025550123',enquiryDate:'2026-11-06'}).expect(200)).body;
 const first=(await call('post','/leads/'+lead.id+'/activities',{type:'note',expectedVersion:lead.version,notes:'PRIVATE MANUAL NOTE',followUp:{title:'PRIVATE TASK TITLE',kind:'administrative',dueAt:'2026-11-07T08:00:00.000Z',timezone:'Asia/Kolkata'}}).expect(200)).body;
 const tasks=await base.query(path('tasks'),{limit:20});assert.equal(tasks.length,1);assert.equal(tasks[0].kind,'administrative');
 await call('patch','/tasks/'+tasks[0].id,{expectedVersion:tasks[0].version,state:'Completed',comment:'Synthetic private task comment'}).expect(200);
 const current=await base.get(path('leads',lead.id));
 const second=(await call('post','/leads/'+lead.id+'/activities',{type:'note',expectedVersion:current.version,notes:'PRIVATE ORDINARY NOTE'}).expect(200)).body;
 const events=(await base.query(path('telemetryOutbox'),{limit:200})).flatMap(r=>[r.event,...(r.additionalEvents||[])]);
 const logged=events.filter(e=>e.type.endsWith('activities.logged'));
 assert.equal(logged.length,2);assert.equal(logged.filter(e=>e.data.has_follow_up).length,1);
 assert.equal(first.activity.autoReminder.status,'Manual');assert.notEqual(second.activity.autoReminder.status,'Manual');
 const completed=events.find(e=>e.type.endsWith('tasks.completed'));assert.equal(completed.data['task.kind'],'administrative');
 assert.ok(!JSON.stringify(events).includes('PRIVATE'));assert.ok(events.every(e=>e.data['event.authority']==='server-confirmed'));
});

test('due-work aggregate counts have their own status/time index, independent of the id-ordered drain query',()=>{
 const indexes=JSON.parse(readFileSync(new URL('../../firestore.indexes.json',import.meta.url))).indexes;
 for(const collectionGroup of ['reminderDeliveries','noteAnalyses']) assert.ok(indexes.some(i=>i.collectionGroup===collectionGroup&&i.queryScope==='COLLECTION'&&JSON.stringify(i.fields)===JSON.stringify([{fieldPath:'status',order:'ASCENDING'},{fieldPath:'nextAttemptAt',order:'ASCENDING'}])),collectionGroup+' aggregate count index');
});
