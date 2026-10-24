// One-time operator bootstrap. Requires the existing Firebase CLI login and gh login.
// This script never creates or downloads a service-account private key.
import {cloud} from './cloud-access.mjs';
import {spawnSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
const project='sales-drone-avinya',number='510928501696',repo='theharithsa/SalesDrone',repoId='1432488502',ownerId='14597214';
const account='salesdrone-github-deploy',email=`${account}@${project}.iam.gserviceaccount.com`;
const pool='github-salesdrone',provider='github-main';
function gh(args,input){const r=spawnSync('gh',args,{input,encoding:'utf8'});if(r.status)throw Error('GitHub setup failed: '+r.stderr.slice(0,300));return r.stdout?JSON.parse(r.stdout):null;}
async function exists(url,create){try{return await cloud(url);}catch(e){if(e.status!==404)throw e;return create();}}
for(const api of ['iam.googleapis.com','iamcredentials.googleapis.com','sts.googleapis.com'])await cloud(`https://serviceusage.googleapis.com/v1/projects/${number}/services/${api}:enable`,{method:'POST',body:'{}'});
await exists(`https://iam.googleapis.com/v1/projects/${project}/serviceAccounts/${email}`,()=>cloud(`https://iam.googleapis.com/v1/projects/${project}/serviceAccounts`,{method:'POST',body:JSON.stringify({accountId:account,serviceAccount:{displayName:'SalesDrone GitHub production deployer'}})}));
const root=`https://iam.googleapis.com/v1/projects/${number}/locations/global/workloadIdentityPools`;
await exists(`${root}/${pool}`,()=>cloud(`${root}?workloadIdentityPoolId=${pool}`,{method:'POST',body:JSON.stringify({displayName:'SalesDrone GitHub only'})}));
const providers=`${root}/${pool}/providers`;
const condition=`assertion.repository_id == '${repoId}' && assertion.repository_owner_id == '${ownerId}' && assertion.ref == 'refs/heads/main' && assertion.workflow_ref == '${repo}/.github/workflows/deploy.yml@refs/heads/main'`;
await exists(`${providers}/${provider}`,()=>cloud(`${providers}?workloadIdentityPoolProviderId=${provider}`,{method:'POST',body:JSON.stringify({displayName:'GitHub main deploy workflow',oidc:{issuerUri:'https://token.actions.githubusercontent.com'},attributeMapping:{'google.subject':'assertion.sub','attribute.repository_id':'assertion.repository_id','attribute.repository_owner_id':'assertion.repository_owner_id','attribute.ref':'assertion.ref'},attributeCondition:condition})}));
const extras='salesdroneDeployExtras';
await exists(`https://iam.googleapis.com/v1/projects/${project}/roles/${extras}`,()=>cloud(`https://iam.googleapis.com/v1/projects/${project}/roles`,{method:'POST',body:JSON.stringify({roleId:extras,role:{title:'SalesDrone deploy IAM extras',stage:'GA',includedPermissions:['cloudfunctions.functions.getIamPolicy','cloudfunctions.functions.setIamPolicy','run.services.getIamPolicy','run.services.setIamPolicy']}})}));
const policy=await cloud(`https://cloudresourcemanager.googleapis.com/v1/projects/${project}:getIamPolicy`,{method:'POST',body:JSON.stringify({options:{requestedPolicyVersion:3}})});
const roles=['roles/firebasehosting.admin','roles/cloudfunctions.developer','roles/cloudscheduler.admin','roles/firebaserules.admin','roles/datastore.indexAdmin','roles/firebase.viewer','roles/serviceusage.serviceUsageViewer','roles/serviceusage.serviceUsageConsumer','roles/secretmanager.viewer','roles/artifactregistry.reader','roles/run.viewer','roles/cloudbuild.builds.viewer','roles/iam.serviceAccountViewer',`projects/${project}/roles/${extras}`];
for(const role of roles){let binding=policy.bindings.find(b=>b.role===role&&!b.condition);if(!binding){binding={role,members:[]};policy.bindings.push(binding);}if(!binding.members.includes('serviceAccount:'+email))binding.members.push('serviceAccount:'+email);}
await cloud(`https://cloudresourcemanager.googleapis.com/v1/projects/${project}:setIamPolicy`,{method:'POST',body:JSON.stringify({policy})});
async function bindServiceAccount(target,role,member){const url=`https://iam.googleapis.com/v1/projects/-/serviceAccounts/${target}`;const p=await cloud(url+':getIamPolicy',{method:'POST',body:'{}'});p.bindings||=[];let b=p.bindings.find(v=>v.role===role&&!v.condition);if(!b){b={role,members:[]};p.bindings.push(b);}if(!b.members.includes(member))b.members.push(member);await cloud(url+':setIamPolicy',{method:'POST',body:JSON.stringify({policy:p})});}
await bindServiceAccount(email,'roles/iam.workloadIdentityUser',`principalSet://iam.googleapis.com/projects/${number}/locations/global/workloadIdentityPools/${pool}/attribute.repository_id/${repoId}`);
await bindServiceAccount(`${number}-compute@developer.gserviceaccount.com`,'roles/iam.serviceAccountUser','serviceAccount:'+email);
gh(['api',`repos/${repo}/environments/production`,'--method','PUT','--input','-'],JSON.stringify({wait_timer:0}));
const vars={GCP_PROJECT_ID:project,GCP_WORKLOAD_IDENTITY_PROVIDER:`projects/${number}/locations/global/workloadIdentityPools/${pool}/providers/${provider}`,GCP_DEPLOY_SERVICE_ACCOUNT:email,DYNATRACE_TENANT_URL:'https://indiacs.live.dynatrace.com',VITE_ENABLE_RUM:'true'};
let env='';for(const file of ['.env','.env.local','.env.production','.env.production.local'])env+='\n'+await readFile(new URL('../apps/web/'+file,import.meta.url),'utf8').catch(()=> '');
for(const key of ['VITE_FIREBASE_VAPID_KEY','VITE_FIREBASE_APPCHECK_KEY','VITE_FIREBASE_APPCHECK_PROVIDER']){const match=[...env.matchAll(new RegExp('^'+key+'=(.*)$','gm'))].at(-1);if(match)vars[key]=match[1].trim().replace(/^['"]|['"]$/g,'');}
for(const [name,value] of Object.entries(vars)){const r=spawnSync('gh',['variable','set',name,'--repo',repo],{input:value,encoding:'utf8'});if(r.status)throw Error('Could not configure '+name);}
console.log(JSON.stringify({repository:repo,authentication:'OIDC / no private keys',provider:vars.GCP_WORKLOAD_IDENTITY_PROVIDER,deployer:email,roles:roles.length,variables:Object.keys(vars)}));
