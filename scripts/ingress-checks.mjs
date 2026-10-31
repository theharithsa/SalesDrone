import {HEALTH_PATH} from '../services/ingress/src/contract.js';
import { gzipSync } from 'node:zlib';
// Read-only denial/parser probes. Never attach customer credentials or identifiers.
export async function checkIngress(origin, expected, {fetchImpl=fetch, largeBody=true}={}) {
 const cases=[
  {id:'malformed-json',method:'POST',headers:{'Content-Type':'application/json'},body:'{',status:400,code:'BAD_JSON'},
  {id:'strict-json',method:'POST',headers:{'Content-Type':'application/json'},body:'null',status:400,code:'BAD_JSON'},
  {id:'compressed-json-denial',method:'POST',headers:{'Content-Type':'application/json','Content-Encoding':'gzip'},body:gzipSync('{}'),status:401,code:'UNAUTHENTICATED'},
  {id:'binary-denial',method:'PUT',path:'/api/v1/leads/postdeploy-placeholder/attachments/postdeploy-placeholder/content',headers:{'Content-Type':'application/octet-stream'},body:Buffer.from([0,255,5]),status:401,code:'UNAUTHENTICATED'},
  ...(largeBody?[{id:'oversized-json',method:'POST',headers:{'Content-Type':'application/json'},body:' '.repeat(12*1024*1024+1),status:413,code:'PAYLOAD_TOO_LARGE'}]:[]),
 ];
 const results=[];
 for(const item of cases){
  const response=await fetchImpl(origin+(item.path||'/api/v1/leads'),{method:item.method,headers:item.headers,body:item.body,redirect:'error',signal:AbortSignal.timeout(30000)});
  const value=await response.json();
  if(response.status!==item.status || value.error?.code!==item.code || !value.error.requestId || response.headers.get('x-request-id')!==value.error.requestId || response.headers.get('x-app-version')!==expected.version || response.headers.get('cache-control')!=='no-store')throw Error('Ingress contract failed: '+item.id);
  results.push({id:item.id,status:'passed'});
 }
 return results;
}

export async function checkIngressIdentity(origin,expected,{fetchImpl=fetch}={}){
 const response=await fetchImpl(origin+HEALTH_PATH,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});
 if(response.status!==200 || !/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||'')){
  await response.body?.cancel();
  throw Error('Ingress operational health did not return application JSON');
 }
 let identity;try{identity=await response.json();}catch{throw Error('Ingress operational health returned invalid JSON');}
 if(identity.version!==expected.version || identity.commit!==expected.commit || response.headers.get('x-app-version')!==expected.version || response.headers.get('cache-control')!=='no-store')throw Error('Ingress identity mismatch before Hosting cutover');
 return {version:identity.version,commit:identity.commit};
}
