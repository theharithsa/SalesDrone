import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {createRequire} from 'node:module';
import {checkAppCheckPolicy} from '../scripts/post-deploy-checks.mjs';
const config=JSON.parse(readFileSync('firebase.json','utf8'));
const parsePolicy=(value:string)=>Object.fromEntries(value.split(';').map(d=>{const [name,...tokens]=d.trim().split(/\s+/);return [name,new Set(tokens)];}));
test('every SPA CSP permits the installed App Check SDK token exchange origin',()=>{
 const require=createRequire(import.meta.url);
 const sdk=readFileSync(require.resolve('@firebase/app-check'),'utf8');
 const origins=[...new Set(sdk.match(/https:\/\/(?:content-)?firebaseappcheck\.googleapis\.com/g)||[])];
 assert.ok(origins.length>0,'App Check SDK endpoint discovery must not silently pass empty');
 const policies=config.hosting.headers.flatMap((entry:any)=>entry.headers.filter((header:any)=>header.key==='Content-Security-Policy').map((header:any)=>({source:entry.source,policy:header.value}))).filter((entry:any)=>parsePolicy(entry.policy)['script-src']?.has('https://apis.google.com'));
 assert.ok(policies.length>0);
 const document=new JSDOM(readFileSync('apps/web/index.html','utf8')).window.document;
 policies.push({source:'HTML meta fallback',policy:document.querySelector('meta[http-equiv="Content-Security-Policy"]')!.getAttribute('content')!});
 for(const {source,policy} of policies)for(const origin of origins)assert.ok(parsePolicy(policy)['connect-src']?.has(origin),`${source} must permit SDK token exchange at ${origin}`);
 for(const {policy} of policies)checkAppCheckPolicy(policy);
 assert.throws(()=>checkAppCheckPolicy("connect-src 'self' https://firebaseappcheck.googleapis.com"),/blocks Firebase App Check/);
});
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
