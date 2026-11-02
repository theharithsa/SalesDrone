import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCursorCodec} from '../src/cursors.js';
test('mixed-visibility task cursors encrypt private scan positions and bind identity/filter context',()=>{
 const c=createCursorCodec('synthetic-only-cursor-key'),after=['2030-01-02T10:00:00Z','private-task-marker'];
 const a=c.seal(after,'member:filters'),b=c.seal(after,'member:filters');assert.notEqual(a,b);assert.deepEqual(c.open(a,'member:filters'),after);
 assert.ok(!Buffer.from(a.split('.')[2],'base64url').includes(Buffer.from('private-task-marker')));
 assert.throws(()=>c.open(a,'other-member:filters'),e=>e.code==='CURSOR');
 const parts=a.split('.'),bytes=Buffer.from(parts[2],'base64url');bytes[0]^=1;parts[2]=bytes.toString('base64url');assert.throws(()=>c.open(parts.join('.'),'member:filters'),e=>e.code==='CURSOR');
});
test('opaque task continuation does not change legacy signed cursor contracts',()=>{
 const c=createCursorCodec('synthetic-only-key'),legacy=c.encode(['document-id'],'legacy');assert.deepEqual(c.decode(legacy,'legacy'),['document-id']);
 assert.throws(()=>c.open(legacy,'legacy'),e=>e.code==='CURSOR');assert.throws(()=>c.decode(c.seal(['id'],'legacy'),'legacy'),e=>e.code==='CURSOR');
});
