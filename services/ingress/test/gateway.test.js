import {checkIngress} from '../../../scripts/ingress-checks.mjs';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { gzipSync } from 'node:zlib';
import { once } from 'node:events';
import { createGateway, JSON_LIMIT } from '../src/gateway.js';

async function fixture(t, handler) {
  const calls = []; const logs = [];
  const upstream = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    calls.push({ url: req.url, headers: req.headers, body: Buffer.concat(chunks) });
    if (handler) return handler(req, res);
    res.setHeader('Content-Type', 'application/json'); res.end('{"ok":true}');
  }).listen(0, '127.0.0.1'); await once(upstream, 'listening');
  const gateway = createGateway({ upstream: `http://127.0.0.1:${upstream.address().port}`, allowLocalTest: true, version: '2.6.1', commit: 'synthetic', log: x => logs.push(x), timeoutMs: 1000 }).listen(0, '127.0.0.1'); await once(gateway, 'listening');
  t.after(() => { gateway.closeAllConnections(); gateway.close(); upstream.closeAllConnections(); upstream.close(); });
  return { calls, logs, url: `http://127.0.0.1:${gateway.address().port}` };
}

test('malformed, primitive and invalid compressed JSON never reach backend', async t => {
  const f = await fixture(t);
  for (const body of ['{', 'null', '42', '"private"', '[1,]']) {
    const r = await fetch(f.url + '/api/v1/leads', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    assert.equal(r.status, 400); const j = await r.json(); assert.equal(j.error.code, 'BAD_JSON'); assert.match(j.error.requestId, /^[a-f0-9-]{36}$/); assert.equal(r.headers.get('x-app-version'), '2.6.1'); assert.equal(r.headers.get('cache-control'), 'no-store');
  }
  const r = await fetch(f.url + '/api/v1/leads', { method: 'POST', headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' }, body: 'invalid' });
  assert.equal(r.status, 400); assert.equal(f.calls.length, 0);
});
test('compressed expansion is bounded before managed parser', async t => {
  const f = await fixture(t);
  const r = await fetch(f.url + '/api/v1/leads', { method: 'POST', headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' }, body: gzipSync(JSON.stringify({ text: 'a'.repeat(JSON_LIMIT) })) });
  assert.equal(r.status, 413); assert.equal((await r.json()).error.code, 'PAYLOAD_TOO_LARGE'); assert.equal(f.calls.length, 0);
});
test('valid compressed JSON preserves original bytes and authenticated headers', async t => {
  const f = await fixture(t); const bytes = gzipSync('{"value":"synthetic"}');
  const r = await fetch(f.url + '/api/v1/leads?example=private', { method: 'POST', headers: { 'content-type': 'application/json', 'content-encoding': 'gzip', authorization: 'Bearer synthetic', 'x-firebase-appcheck': 'synthetic', 'idempotency-key': 'synthetic', 'x-serverless-authorization': 'spoofed' }, body: bytes });
  assert.equal(r.status, 200); assert.deepEqual(f.calls[0].body, bytes); assert.equal(f.calls[0].headers.authorization, 'Bearer synthetic'); assert.equal(f.calls[0].headers['x-firebase-appcheck'], 'synthetic'); assert.equal(f.calls[0].headers['x-serverless-authorization'], undefined); assert.ok(f.logs.every(x => !x.includes('private') && !x.includes('Bearer')));
});
test('binary attachments and backend denials retain bytes and response contract', async t => {
  const f = await fixture(t, (req, res) => { res.statusCode = 403; res.setHeader('Content-Type', 'application/json'); res.end('{"error":{"code":"FORBIDDEN"}}'); });
  const bytes = Buffer.from([0, 255, 5, 128]);
  const r = await fetch(f.url + '/api/v1/leads/synthetic/attachments', { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: bytes });
  assert.equal(r.status, 403); assert.deepEqual(f.calls[0].body, bytes); assert.equal((await r.json()).error.code, 'FORBIDDEN');
});
test('unavailable upstream returns a safe envelope without transport details', async t => {
  const f = await fixture(t, (req) => req.socket.destroy());
  const r = await fetch(f.url + '/api/v1/leads'); assert.equal(r.status, 502); assert.equal((await r.json()).error.code, 'UPSTREAM_UNAVAILABLE');
});
test('fixed origin rejects unsafe configuration and non-api routes', async t => {
  assert.throws(() => createGateway({ upstream: 'http://example.com' }));
  assert.throws(() => createGateway({ upstream: 'https://example.com/?target=private' }));
  const f = await fixture(t); const r = await fetch(f.url + '/other'); assert.equal(r.status, 404); assert.equal(f.calls.length, 0);
  const health = await fetch(f.url + '/healthz'); assert.deepEqual(await health.json(), { version: '2.6.1', commit: 'synthetic' });
});

test('plain oversized requests and unsupported encodings fail without forwarding', async t=>{
 const f=await fixture(t);
 const r=await fetch(f.url+'/api/v1/leads',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({value:'a'.repeat(JSON_LIMIT)})});assert.equal(r.status,413);assert.equal((await r.json()).error.code,'PAYLOAD_TOO_LARGE');
 const invalid=await fetch(f.url+'/api/v1/leads',{method:'POST',headers:{'content-type':'application/json','content-encoding':'synthetic'},body:'{}'});assert.equal(invalid.status,415);assert.equal(f.calls.length,0);
});
test('slow upstream is bounded and does not expose internal socket errors',async t=>{
 const f=await fixture(t,()=>{});const r=await fetch(f.url+'/api/v1/leads');assert.equal(r.status,504);assert.equal((await r.json()).error.code,'REQUEST_TIMEOUT');
});

test('an incomplete request body gets a bounded safe timeout without reaching backend',async t=>{
 const f=await fixture(t);
 const result=await new Promise((resolve,reject)=>{
  const req=http.request(f.url+'/api/v1/leads',{method:'POST',headers:{'content-type':'application/json','content-length':'100'}},async res=>{const chunks=[];for await(const c of res)chunks.push(c);resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks).toString())});});
  req.on('error',reject);t.after(()=>req.destroy());req.write('{');
 });
 assert.equal(result.status,504);assert.equal(result.body.error.code,'REQUEST_TIMEOUT');assert.equal(f.calls.length,0);
});

test('production probes exercise real ingress denial/parser boundaries without authenticated writes',async t=>{
 const f=await fixture(t,(_req,res)=>{const requestId=randomUUID();res.statusCode=401;res.setHeader('X-Request-Id',requestId);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:{code:'UNAUTHENTICATED',requestId}}));});
 const results=await checkIngress(f.url,{version:'2.6.1'});assert.equal(results.length,5);assert.ok(results.every(r=>r.status==='passed'));assert.equal(f.calls.length,2);assert.ok(f.calls.every(call=>!call.headers.authorization));
});
