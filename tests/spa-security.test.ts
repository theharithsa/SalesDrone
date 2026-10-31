import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const config=JSON.parse(readFileSync('firebase.json','utf8'));
const parsePolicy=(value:string)=>Object.fromEntries(value.split(';').map(d=>{const [name,...tokens]=d.trim().split(/\s+/);return [name,new Set(tokens)];}));
test('SPA CSP keeps required Firebase and Dynatrace origins without permitting inline scripts or eval',()=>{
 const policy=config.hosting.headers.find((x:any)=>x.source==='/').headers.find((x:any)=>x.key==='Content-Security-Policy').value;
 const directives=parsePolicy(policy),scripts=directives['script-src'];
 assert.ok(scripts.has('https://apis.google.com'));assert.ok(scripts.has('https://www.google.com/recaptcha/'));assert.ok(scripts.has('https://js-cdn.dynatrace.com'));
 assert.ok(!scripts.has("'unsafe-inline'")&&!scripts.has("'unsafe-eval'"));assert.deepEqual([...directives['object-src']],["'none'"]);assert.ok(directives['connect-src'].has('https://bf12470wrz.bf.dynatrace.com'));
 const document=new JSDOM(readFileSync('apps/web/index.html','utf8'),{url:'https://salesdrone.example.invalid/'}).window.document;
 const appearance=Array.from(document.scripts).find(s=>new URL(s.src).pathname==='/appearance-bootstrap.js');assert.ok(appearance);assert.ok(Array.from(document.scripts).every(s=>s.src));
 const meta=document.querySelector('meta[http-equiv="Content-Security-Policy"]');assert.equal(meta?.getAttribute('content'),policy.replace("; frame-ancestors 'self'",''));assert.ok(meta!.compareDocumentPosition(appearance!)&4);
 const portal=config.hosting.headers.find((x:any)=>x.source==='/api/docs').headers.find((x:any)=>x.key==='Content-Security-Policy').value;assert.deepEqual([...parsePolicy(portal)['script-src']],["'self'"]);
});
test('API rewrite uses fixed ingress after static documentation; all existing domain Functions remain configured',()=>{
 assert.equal(config.hosting.rewrites[0].source,'/api/docs');assert.equal(config.hosting.rewrites[1].run.serviceId,'salesdrone-ingress');assert.equal(config.hosting.rewrites[1].run.region,'asia-south1');assert.equal(config.functions[0].codebase,'salesdrone');
});
