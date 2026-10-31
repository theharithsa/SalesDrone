import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const config=JSON.parse(readFileSync('firebase.json','utf8'));
test('SPA CSP keeps required Firebase and Dynatrace origins without permitting inline scripts or eval',()=>{
 const policy=config.hosting.headers.find((x:any)=>x.source==='/').headers.find((x:any)=>x.key==='Content-Security-Policy').value;
 const scripts=policy.split(';').find((x:string)=>x.trim().startsWith('script-src'));
 assert.ok(scripts.includes('https://apis.google.com'));assert.ok(scripts.includes('https://www.google.com/recaptcha/'));assert.ok(scripts.includes('https://js-cdn.dynatrace.com'));
 assert.ok(!scripts.includes('unsafe-inline')&&!scripts.includes('unsafe-eval'));assert.ok(policy.includes("object-src 'none'")&&policy.includes('https://bf12470wrz.bf.dynatrace.com'));
 const index=readFileSync('apps/web/index.html','utf8');assert.ok(index.includes('src="/appearance-bootstrap.js"'));assert.ok(!/<script>/.test(index));
 const meta=index.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];assert.equal(meta,policy.replace("; frame-ancestors 'self'",''));
 const docs=config.hosting.headers.find((x:any)=>x.source==='/api/docs').headers.find((x:any)=>x.key==='Content-Security-Policy').value;assert.ok(!docs.includes('dynatrace')&&!docs.includes('google.com'));
});
test('API rewrite uses fixed ingress after static documentation; all existing domain Functions remain configured',()=>{
 assert.equal(config.hosting.rewrites[0].source,'/api/docs');assert.equal(config.hosting.rewrites[1].run.serviceId,'salesdrone-ingress');assert.equal(config.hosting.rewrites[1].run.region,'asia-south1');assert.equal(config.functions[0].codebase,'salesdrone');
});
