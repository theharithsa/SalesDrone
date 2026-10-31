import{test}from'node:test';import assert from'node:assert/strict';import request from'supertest';
import{dashboardGrouping,dashboardFields}from'../src/dashboard-grouping.js';import{readFieldOptions,FIELD_SETTINGS_PATH}from'../src/field-options.js';import{memoryStore}from'../src/store.js';import{path}from'../src/policy.js';import{createApp}from'../src/app.js';import{PRESETS}from'../src/contracts.js';
test('hidden-stage fallback, stable normalized groups and distinct empty buckets preserve counts',async()=>{
 const config=await readFieldOptions(memoryStore());config.hiddenFields=['stage'];
 const g=dashboardGrouping([{legacyStatus:'Quoted'},{legacyStatus:' quoted '},{legacyStatus:''},{legacyStatus:'Not recorded'}],config);
 assert.equal(g.field,'legacyStatus');assert.equal(g.groups.find(g=>g.label==='Quoted').value,2);assert.equal(g.groups.find(g=>g.empty).value,1);assert.equal(g.groups.find(g=>g.key==='v:not recorded').value,1);
 const stage=dashboardGrouping([{stage:'Qualified'},{stage:'New'}],config,'stage');assert.equal(stage.unavailable,false);assert.equal(stage.field,'stage');assert.equal(stage.groups.find(g=>g.label==='Qualified').value,1);assert.ok(stage.availableFields.some(f=>f.field==='stage'));assert.ok(!dashboardFields(config).some(f=>f.field==='stage'),'hidden stages stay excluded from import destinations');
 config.hiddenFields=['stage','legacyStatus','source','zone','location'];assert.equal(dashboardGrouping([],config).field,null);
});
test('custom text/select grouping caps display groups without losing totals',async()=>{
 const config=await readFieldOptions(memoryStore());config.customFields=[{id:'cf_product',label:'Product',type:'text',deleted:false,options:[]}];
 const g=dashboardGrouping(Array.from({length:100},(_,i)=>({customFields:{cf_product:'Item '+i}})),config,'cf_product');assert.equal(g.groups.length,21);assert.equal(g.groups.reduce((n,g)=>n+g.value,0),100);assert.equal(g.groups.find(g=>g.aggregate).value,80);
});
test('personal chart selection persists with partial PATCH, preserves older clients and emits safe audit metadata',async()=>{
 const store=memoryStore(),app=createApp({store,cursorSecret:'synthetic-stable-key',verifyToken:async uid=>({uid,email:uid==='admin'?'spraghav@gmail.com':'member@example.test',email_verified:true,firebase:{sign_in_provider:'google.com'}})});
 const auth=(r,who='admin')=>r.set('Authorization','Bearer '+who);
 await auth(request(app).get('/api/v1/me')).expect(200);
 await store.set(path('members','member'),{id:'member',uid:'member',email:'member@example.test',role:'SDR',scope:'assigned',active:true,version:1,capabilities:PRESETS.SDR});
 await store.set(path('leads','mine'),{id:'mine',name:'Synthetic',legacyStatus:'Quoted',stage:'New',archived:false,assignedToUid:'member'});
 await store.set(path('leads','other'),{id:'other',name:'Excluded',legacyStatus:'Private',stage:'New',archived:false,assignedToUid:'admin'});
 await auth(request(app).patch('/api/v1/me'),'member').send({dashboardField:'legacyStatus'}).expect(200);
 await auth(request(app).patch('/api/v1/me'),'member').send({timezone:'UTC',appearance:'dark'}).expect(200);
 const response=(await auth(request(app).get('/api/v1/dashboard'),'member').expect(200)).body;assert.equal(response.visualization.requested,'legacyStatus');assert.equal(response.visualization.groups.reduce((n,g)=>n+g.value,0),1);assert.ok(!JSON.stringify(response.visualization).includes('Private'));
 assert.equal((await store.get('users/member')).dashboardField,'legacyStatus');assert.equal((await store.get('users/admin'))?.dashboardField,undefined);
 await auth(request(app).patch('/api/v1/me'),'member').send({dashboardField:'name'}).expect(400);
 const config=await readFieldOptions(store);await store.set(FIELD_SETTINGS_PATH,{...config,hiddenFields:['stage']});await auth(request(app).patch('/api/v1/me'),'member').send({dashboardField:'stage'}).expect(200);const stageResponse=(await auth(request(app).get('/api/v1/dashboard'),'member').expect(200)).body;assert.equal(stageResponse.visualization.field,'stage');assert.equal(stageResponse.visualization.groups.reduce((n,g)=>n+g.value,0),1);
 await request(app).patch('/api/v1/me').send({dashboardField:'legacyStatus'}).expect(401);
 const audits=await store.query(path('auditEvents'),{limit:100});assert.ok(audits.some(a=>a.settingsChanges?.some(s=>s.section==='dashboard.visualization')));
});

test('importing status with a hidden stage retains text without mapping or overwriting workflow',async()=>{
 const {previewRows}=await import('../src/imports.js');
 const row={name:'Synthetic',phone:'+12025550100',enquiryDate:'2026-10-31',legacyStatus:'Awaiting drawings'};
 assert.equal(previewRows({rows:[row],dateOrder:'DMY',statusMap:{}},['New'])[0].row,null);
 const preview=previewRows({rows:[row],dateOrder:'DMY',statusMap:{'Awaiting drawings':'Qualified'}},['New','Qualified'],{stageHidden:true})[0];assert.equal(preview.row.legacyStatus,'Awaiting drawings');assert.equal(preview.row.stage,'New');
 const explicit=previewRows({rows:[{...row,stage:'Qualified'}],dateOrder:'DMY',statusMap:{}},['New','Qualified'],{stageHidden:true})[0];assert.equal(explicit.row.stage,'Qualified');
});
