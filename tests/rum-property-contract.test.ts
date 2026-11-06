import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('RUM declaration keys match the emitted valid short-string property vocabulary',async()=>{
 const contract=JSON.parse(await readFile(new URL('../observability/rum-properties.json',import.meta.url),'utf8'));
 const source=await readFile(new URL('../apps/web/src/lib/rum.ts',import.meta.url),'utf8');
 assert.equal(contract.storage,'user action only');assert.equal(contract.properties.length,6);
 for(const {key} of contract.properties){assert.match(key,/^[a-z][a-z0-9_]*$/);assert.ok(source.includes("'"+key+"'"));}
 assert.equal(new Set(contract.properties.map(p=>p.key)).size,6);
});
