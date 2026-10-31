import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import protobuf from 'protobufjs';
import { createTelemetry } from '../../../functions/src/telemetry.js';
import { createGateway } from '../src/gateway.js';
const attributes=values=>Object.fromEntries(values.map(x=>{const key=Object.keys(x.value).find(k=>['stringValue','intValue','doubleValue','boolValue'].includes(k));return [x.key,x.value[key]];}));
test('decoded ingress export retains parser categories, real forwarding context and no private transport values',async()=>{
 const schema=protobuf.parse(await readFile(new URL('../../../functions/test/fixtures/otlp-subset.proto',import.meta.url),'utf8')).root;
 const received=[],parents=[],outcomes=[];
 let resolveForward;const forwarded=new Promise(resolve=>{resolveForward=resolve;});
 const deadline=setTimeout(()=>resolveForward(false),5000);
 const receiver=http.createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);const name=req.url.endsWith('traces')?'ExportTraceServiceRequest':req.url.endsWith('logs')?'ExportLogsServiceRequest':'ExportMetricsServiceRequest';const data=schema.lookupType('wire.'+name).decode(Buffer.concat(chunks));received.push({name,data});if(name==='ExportTraceServiceRequest'&&data.resourceSpans.some(r=>r.scopeSpans.some(s=>s.spans.some(span=>span.name==='api.forward'))))resolveForward(true);res.setHeader('Content-Type','application/x-protobuf');res.end();}).listen(0,'127.0.0.1');await once(receiver,'listening');
 const backend=http.createServer((req,res)=>{parents.push(req.headers.traceparent);req.resume();res.end('{"ok":true}');}).listen(0,'127.0.0.1');await once(backend,'listening');
 const telemetry=createTelemetry({tenant:`http://127.0.0.1:${receiver.address().port}`,key:'synthetic',service:'salesdrone-ingress-test',allowLocalTest:true});
 const gateway=createGateway({upstream:`http://127.0.0.1:${backend.address().port}`,allowLocalTest:true,version:'2.6.1',commit:'synthetic',telemetry,log:x=>outcomes.push(x)}).listen(0,'127.0.0.1');await once(gateway,'listening');
 try{
  const url=`http://127.0.0.1:${gateway.address().port}/api/v1/leads?private=PRIVATE_QUERY`;
  let response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer PRIVATE_AUTH'},body:'{PRIVATE_BODY'});assert.equal(response.status,400);await response.text();await telemetry.flush();
  response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer PRIVATE_AUTH'},body:'{}'});assert.equal(response.status,200);await response.text();assert.equal(await forwarded,true);clearTimeout(deadline);await telemetry.flush();
  const spans=received.filter(x=>x.name==='ExportTraceServiceRequest').flatMap(x=>x.data.resourceSpans.flatMap(r=>r.scopeSpans.flatMap(s=>s.spans)));
  const rejected=spans.find(s=>attributes(s.attributes)['error.type']==='BAD_JSON');assert.ok(rejected);assert.equal(rejected.name,'POST /api/*');
  const forwarding=spans.find(s=>s.name==='api.forward');assert.ok(forwarding);assert.equal(forwarding.kind,3);assert.equal(attributes(forwarding.attributes)['http.response.status_code'].toString(),'200');assert.equal(parents[0].split('-')[1],Buffer.from(forwarding.traceId).toString('hex'));assert.equal(parents[0].split('-')[2],Buffer.from(forwarding.spanId).toString('hex'));
  const logs=received.filter(x=>x.name==='ExportLogsServiceRequest').flatMap(x=>x.data.resourceLogs.flatMap(r=>r.scopeLogs.flatMap(s=>s.logRecords)));assert.ok(logs.some(l=>attributes(l.attributes)['error.type']==='BAD_JSON'&&Buffer.from(l.traceId).length===16));
  const metrics=received.filter(x=>x.name==='ExportMetricsServiceRequest').flatMap(x=>x.data.resourceMetrics.flatMap(r=>r.scopeMetrics.flatMap(s=>s.metrics)));assert.ok(metrics.filter(m=>m.name==='salesdrone.http.requests').some(m=>m.sum.dataPoints.some(p=>attributes(p.attributes)['error.type']==='BAD_JSON')));
  assert.ok(!JSON.stringify(received).includes('PRIVATE'));assert.ok(!outcomes.join('').includes('PRIVATE'));assert.ok(outcomes.every(x=>JSON.parse(x).trace_id));
 }finally{clearTimeout(deadline);gateway.closeAllConnections();gateway.close();backend.closeAllConnections();backend.close();await telemetry.shutdown();receiver.closeAllConnections();receiver.close();}
});
