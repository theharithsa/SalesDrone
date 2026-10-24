// Read the provided token from hidden terminal input. Never echo or write it to disk.
import {cloud} from './cloud-access.mjs';
import {spawnSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
const project='sales-drone-avinya',number='510928501696',repo='theharithsa/SalesDrone';
if(!process.stdin.isTTY)throw Error('Use a terminal with hidden input');
process.stdin.setRawMode(true);process.stdin.resume();
console.log('Waiting for Dynatrace ingestion credential (input hidden).');
let token=await new Promise((resolve,reject)=>{let text='';function onData(chunk){for(const char of chunk.toString()){if(char==='\u0003'){process.stdin.off('data',onData);reject(Error('Cancelled'));return;}if(char==='\r'||char==='\n'){process.stdin.off('data',onData);resolve(text);return;}text+=char;}}process.stdin.on('data',onData);});
process.stdin.setRawMode(false);process.stdin.pause();
if(!/^dt0c01\.[A-Za-z0-9.]+$/.test(token))throw Error('Unexpected token format');
async function secret(name,value){const base=`https://secretmanager.googleapis.com/v1/projects/${project}/secrets/${name}`;try{await cloud(base);}catch(e){if(e.status!==404)throw e;await cloud(`https://secretmanager.googleapis.com/v1/projects/${project}/secrets?secretId=${name}`,{method:'POST',body:JSON.stringify({replication:{automatic:{}}})});}await cloud(base+':addVersion',{method:'POST',body:JSON.stringify({payload:{data:Buffer.from(value).toString('base64')}})});const p=await cloud(base+':getIamPolicy');p.bindings||=[];let b=p.bindings.find(v=>v.role==='roles/secretmanager.secretAccessor');if(!b){b={role:'roles/secretmanager.secretAccessor',members:[]};p.bindings.push(b);}const member=`serviceAccount:${number}-compute@developer.gserviceaccount.com`;if(!b.members.includes(member))b.members.push(member);await cloud(base+':setIamPolicy',{method:'POST',body:JSON.stringify({policy:p})});}
await secret('DYNATRACE_API_TOKEN',token);
const result=spawnSync('gh',['secret','set','DYNATRACE_API_TOKEN','--repo',repo],{input:token,encoding:'utf8'});if(result.status)throw Error('Could not save repository ingestion secret');
const envPath=new URL('../functions/.env.sales-drone-avinya',import.meta.url);let env=await readFile(envPath,'utf8');const cursor=env.match(/^CURSOR_SECRET=(.*)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g,'');if(cursor){await secret('CURSOR_SECRET',cursor);env=env.replace(/^CURSOR_SECRET=.*\r?\n?/m,'');await writeFile(envPath,env,{mode:0o600});}
const tenant='https://indiacs.live.dynatrace.com';
const now=new Date().toISOString(),id='salesdrone-observability-check-'+Date.now();
const event={specversion:'1.0',id,source:'com.avinyatech.salesdrone.validation',type:'com.avinyatech.salesdrone.instrumentation.validated',time:now,data:{'event.id':id,'event.authority':'server-confirmed','schema.version':1,'app.version':'1.0.0','validation.synthetic':true}};
const accepted=await fetch(tenant+'/api/v2/bizevents/ingest',{method:'POST',redirect:'error',headers:{Authorization:'Api-Token '+token,'Content-Type':'application/json'},body:JSON.stringify(event),signal:AbortSignal.timeout(15000)});
console.log(JSON.stringify({secretNames:['DYNATRACE_API_TOKEN',...(cursor?['CURSOR_SECRET']:[])],githubSecretConfigured:true,bizEventProbe:{status:accepted.status,eventId:id},tenant}));
token='';
