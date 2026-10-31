import {test} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {createApp} from '../src/app.js';
import {memoryStore,documentKey} from '../src/store.js';
import {path} from '../src/policy.js';
import {PRESETS} from '../src/contracts.js';
import {readFieldOptions,FIELD_SETTINGS_PATH} from '../src/field-options.js';
const row=(id,source='Other')=>({id,name:'Synthetic',stage:'New',source,customFields:{cf_product:'Retail'},assignedToUid:'sdr',archived:false,version:1});
async function fixture(seed={}){
 const store=memoryStore(seed),queries=[],base=store.query;store.query=async(p,o)=>{const result=await base(p,o);if(p===path('leads'))queries.push({options:o,count:result.length});return result};
 await store.set(path('members','sdr'),{uid:'sdr',id:'sdr',email:'sdr@example.test',role:'SDR',scope:'assigned',active:true,version:1,capabilities:PRESETS.SDR});
 const config=await readFieldOptions(store);await store.set(FIELD_SETTINGS_PATH,{...config,customFields:[{id:'cf_product',label:'Product',type:'select',options:['Retail','Trade'],required:false,deleted:false},{id:'cf_notes',label:'Details',type:'text',options:[],required:false,deleted:false}]});
 const app=createApp({store,cursorSecret:'synthetic-stable-key',verifyToken:async uid=>({uid,email:uid==='admin'?'spraghav@gmail.com':'sdr@example.test',email_verified:true,firebase:{sign_in_provider:'google.com'}})});
 await request(app).get('/api/v1/me').set('Authorization','Bearer admin').expect(200);
 const call=(filters,extra={},who='admin')=>request(app).get('/api/v1/leads').set('Authorization','Bearer '+who).query({filters:JSON.stringify(filters),...extra});return {store,queries,call};
}
test('Exact match pushes every eligible equality into the query beyond 1000 rows while enforcing assigned scope',async()=>{
 const seed={};for(let i=0;i<1105;i++){const id=String(i).padStart(4,'0');seed[path('leads',id)]=row(id)}
 seed[path('leads','0001')]=row('0001','Website');seed[path('leads','9999')]={...row('9999','Website'),assignedToUid:'other'};
 const f=await fixture(seed),filters=[{field:'source',op:'exact',value:'Website'},{field:'stage',op:'exact',value:'New'},{field:'cf_product',op:'exact',value:'Retail'}];
 const response=(await f.call(filters,{},'sdr').expect(200)).body;assert.deepEqual(response.items.map(l=>l.id),['0001']);assert.equal(response.scanLimited,false);assert.equal(f.queries.reduce((n,q)=>n+q.count,0),1);
 assert.ok(f.queries[0].options.filters.some(([k,o,v])=>k==='customFields.cf_product'&&o==='=='&&v==='Retail'));assert.equal(f.queries[0].options.order,'__name__');assert.ok(f.queries[0].options.filters.some(([k,o,v])=>k==='assignedToUid'&&v==='sdr'));
});
test('Equals keeps existing case/Unicode/space matching; Exact compares saved text literally',async()=>{
 const f=await fixture({[path('leads','a')]:row('a','Website'),[path('leads','b')]:row('b',' website '),[path('leads','c')]:row('c','Ｗｅｂｓｉｔｅ')});
 assert.equal((await f.call([{field:'source',op:'equals',value:'WEBSITE'}]).expect(200)).body.items.length,3);
 assert.deepEqual((await f.call([{field:'source',op:'exact',value:'Website'}]).expect(200)).body.items.map(l=>l.id),['a']);
 assert.deepEqual((await f.call([{field:'source',op:'exact',value:' website '}]).expect(200)).body.items.map(l=>l.id),['b']);
 assert.deepEqual((await f.call([{field:'source',op:'exact',value:'Ｗｅｂｓｉｔｅ'}]).expect(200)).body.items.map(l=>l.id),['c']);
 await f.call([{field:'name',op:'exact',value:'Synthetic'}]).expect(400);await f.call([{field:'cf_notes',op:'exact',value:'Synthetic'}]).expect(400);
 const none=(await f.call([{field:'source',op:'exact',value:'Website'},{field:'source',op:'exact',value:'Referral'}]).expect(200)).body;assert.equal(none.items.length,0);assert.equal(none.nextCursor,null);
});
test('Exact cursors use actual document keys, keep AND residuals and reject changed operator/member context',async()=>{
 const f=await fixture({[path('leads','a')]:row('different-a','Website'),[path('leads','b')]:row('different-b','Website'),[path('leads','c')]:{...row('different-c','Website'),company:'Other'}});const filters=[{field:'source',op:'exact',value:'Website'},{field:'company',op:'empty',value:''}];
 const first=(await f.call(filters,{limit:1}).expect(200)).body;assert.equal(first.items[0].id,'different-b');const second=(await f.call(filters,{limit:1,cursor:first.nextCursor}).expect(200)).body;assert.equal(second.items[0].id,'different-a');
 await f.call([{field:'source',op:'equals',value:'Website'}],{cursor:first.nextCursor}).expect(400);await f.call(filters,{cursor:first.nextCursor},'sdr').expect(400);
 const records=await f.store.query(path('leads'),{order:'__name__',direction:'desc',limit:1});assert.equal(documentKey(records[0]),'c');assert.deepEqual(Object.keys(records[0]),Object.keys(row('different-c')).concat('company'));
 assert.ok(!JSON.stringify(first).includes('document-key'));
});
