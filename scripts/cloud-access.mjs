// Operator helper: uses the existing Firebase CLI account in memory. Never prints tokens.
import {createRequire} from 'node:module';
const require=createRequire(new URL('../package.json',import.meta.url));
const {getGlobalDefaultAccount,getAccessToken}=require('firebase-tools/lib/auth.js');
let credential;
export async function cloud(url,options={}){if(!credential){const a=getGlobalDefaultAccount();if(!a)throw Error('Firebase CLI account is unavailable');credential=await getAccessToken(a.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);}const r=await fetch(url,{...options,headers:{Authorization:'Bearer '+credential.access_token,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(60000)});const body=await r.text();let data;try{data=JSON.parse(body);}catch{data={message:body.slice(0,300)};}if(!r.ok){const e=new Error(data.error?.message||`Cloud request failed: ${r.status}`);e.status=r.status;e.details=data.error?.details;e.response=data;throw e;}return data;}
