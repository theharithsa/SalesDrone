// Read-only tenant queries only. No settings/document/alert APIs or credential output.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {queryFiles,optionalQueries,readPack,detectorSuffix} from './observability-pack.mjs';
const run=promisify(execFile),root=new URL('../observability/',import.meta.url);
export async function validateQueries(execute){
 const pack=await readPack(),results=[];
 for(const name of queryFiles){
  let query=await readFile(new URL(`queries/${name}.dql`,root),'utf8');const rule=pack.rules.find(r=>r.query===`queries/${name}.dql`);if(rule)query+=detectorSuffix(rule);
  const base={query:name,sha256:createHash('sha256').update(query).digest('hex'),optional:optionalQueries.has(name)};
  try{const {records,warnings=false}=await execute(query);if(!Array.isArray(records))throw Error('Malformed query result');
   results.push({...base,status:warnings?'warning':records.length?'data-visible':base.optional?'requires-tenant-setup-or-traffic':'valid-no-data',rows:records.length});
  }catch{results.push({...base,status:'query-failed',rows:null});}
 }
 return {schemaVersion:1,checkedAt:new Date().toISOString(),mode:'read-only queries; no tenant setup',results,valid:results.every(r=>!['warning','query-failed'].includes(r.status))};
}
if(process.argv[1]&&import.meta.url===new URL(process.argv[1],'file:').href){
 if(!process.argv.includes('--tenant'))throw Error('Use --tenant to opt in to read-only dtctl queries. No resources are installed.');
 const dir=await mkdtemp(join(tmpdir(),'salesdrone-queries-'));
 try{const report=await validateQueries(async query=>{
   const file=join(dir,'query.dql');await writeFile(file,query);
   const {stdout,stderr}=await run('dtctl',['query','-f',file,'-o','json'],{timeout:45000,maxBuffer:2*1024*1024});
   return {records:JSON.parse(stdout).records,warnings:/warning/i.test(stderr)};
  });
  const output=process.argv.includes('--output')?process.argv[process.argv.indexOf('--output')+1]:'test-results/monitoring-inputs.json';if(!output)throw Error('Missing output path');
  await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));if(!report.valid)process.exitCode=1;
 }finally{await rm(dir,{recursive:true,force:true});}
}
