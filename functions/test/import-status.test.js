import{test}from'node:test';import assert from'node:assert/strict';
import{applyImportStatus,importStatusTarget}from'../src/import-status.js';import{readFieldOptions}from'../src/field-options.js';import{memoryStore}from'../src/store.js';
test('explicit enquiry status mapping preserves source meaning and bypasses legacy workflow inference',async()=>{
 const config=await readFieldOptions(memoryStore());
 assert.throws(()=>applyImportStatus({legacyStatus:{unexpected:true}},{statusField:'legacyStatus',statusMap:{}},config),/literal text/);
 const base={name:'Synthetic',legacyStatus:'Sent details on WA'};
 const result=applyImportStatus(base,{statusField:'legacyStatus',statusMap:{}},config);assert.equal(result.row.legacyStatus,'Sent details on WA');assert.equal(result.row.stage,undefined);assert.equal(result.legacyStageMapping,false);
 const remap=applyImportStatus(base,{statusField:'legacyStatus',statusMap:{'Sent details on WA':'Quoted'}},config);assert.equal(remap.row.legacyStatus,'Quoted');assert.equal(base.legacyStatus,'Sent details on WA');
 assert.equal(applyImportStatus(base,{statusMap:{}},config).legacyStageMapping,true);
 assert.equal(applyImportStatus(base,{statusField:'none',statusMap:{}},config).legacyStageMapping,false);
});
test('available targets validate configured values, prevent column overwrite and handle prototype-like statuses literally',async()=>{
 const config=await readFieldOptions(memoryStore());config.customFields=[{id:'cf_state',label:'Enquiry phase',type:'select',options:['Pending','Complete'],deleted:false}];
 assert.throws(()=>applyImportStatus({legacyStatus:'Sent'},{statusField:'cf_state',statusMap:{}},config),/configured value/);
 assert.equal(applyImportStatus({legacyStatus:'Sent'},{statusField:'cf_state',statusMap:{Sent:'Pending'}},config).row.cf_state,'Pending');
 assert.throws(()=>applyImportStatus({legacyStatus:'Sent',cf_state:'Complete'},{statusField:'cf_state',statusMap:{Sent:'Pending'}},config),/already has/);
 assert.equal(applyImportStatus({legacyStatus:'constructor'},{statusField:'legacyStatus',statusMap:{}},config).row.legacyStatus,'constructor');
 config.hiddenFields=['stage'];assert.throws(()=>importStatusTarget('stage',config),/available/);assert.throws(()=>importStatusTarget('name',config),/available/);
});
