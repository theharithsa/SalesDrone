import{test}from'node:test';import assert from'node:assert/strict';
import{unmatchedImportFields,resolveImportFields}from'../apps/web/src/lib/import-fields.ts';
import{defaultFieldOptions}from'../apps/web/src/lib/field-options.ts';
test('every populated unmapped column is proposed; blank/comment/mapped columns are excluded',()=>{
 const result=unmatchedImportFields(['Name','Product','Product','','Notes','Empty'],[['Ada','0012','Blue','005','memo','']],{name:'0'},[4],defaultFieldOptions);
 assert.deepEqual(result,[{index:1,label:'Product (column 2)'},{index:2,label:'Product (column 3)'},{index:3,label:'Column 4'}]);
});
test('field setup reuses IDs across retries and normalized headers; prevents destructive duplicate mappings and limits',()=>{
 const first=resolveImportFields(defaultFieldOptions,[{index:2,label:'Product'}],()=> 'cf_product');assert.equal(first.created,1);assert.equal(first.fields[0].type,'text');
 const config={...defaultFieldOptions,customFields:first.fields};
 const again=resolveImportFields(config,[{index:2,label:'ＰＲＯＤＵＣＴ'}],()=>{throw Error('Must reuse')});assert.equal(again.created,0);assert.equal(again.mapping.cf_product,'2');
 assert.throws(()=>resolveImportFields(config,[{index:3,label:'Product'}],()=> 'cf_new',{cf_product:'2'}),/already mapped/);
 assert.throws(()=>resolveImportFields(config,[{index:2,label:'Customer name'}],()=> 'cf_new'),/standard fields/);
 assert.throws(()=>resolveImportFields({...config,customFields:Array.from({length:30},(_,i)=>({...first.fields[0],id:'cf_'+i,label:'Field '+i}))},[{index:2,label:'Additional'}],()=> 'cf_extra'),/30 active/);
});
