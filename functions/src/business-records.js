// Read-only, projected business datasets. No model-selected collection paths or credentials.
import {AppError} from './contracts.js';
import {path,canReadLead,hash} from './policy.js';
import {documentKey} from './store.js';
import {sharedImports,readImport} from './import-review.js';
import {readHygieneScan} from './lead-hygiene.js';
import {reportingDate} from './lead-research-settings.js';
import {readScoring,scoreView} from './scoring.js';
const common={leadName:'text',company:'text',stage:'text',person:'text',createdAt:'date',updatedAt:'date'};
export const BUSINESS_CATALOG={
 tasks:{collection:'tasks',label:'lead tasks',fields:{...common,title:'text',state:'text',kind:'text',dueAt:'date'}},
 notes:{collection:'activities',label:'notes',fields:{...common,notes:'text'}},
 calls:{collection:'activities',label:'calls',fields:{...common,notes:'text',outcome:'text',disposition:'text',durationSeconds:'number'}},
 transitions:{collection:'leadTransitions',label:'stage changes',fields:{...common,from:'text',to:'text',reason:'text'}},
 imports:{collection:'imports',label:'imports',permission:'imports:read',fields:{filename:'text',sheet:'text',status:'text',createdAt:'date',updatedAt:'date',total:'number',valid:'number',invalid:'number',imported:'number',updated:'number',unchanged:'number',duplicates:'number',skipped:'number',failed:'number'}},
 reports:{collection:'hygieneScans',label:'Hygiene reports',permission:'hygiene:read',fields:{status:'text',createdAt:'date',updatedAt:'date',scanned:'number',findings:'number'}},
 files:{collection:'leadAttachments',label:'files',fields:{...common,name:'text',contentType:'text',size:'number',state:'text'}},
 scores:{collection:'leadScores',label:'lead scores',fields:{...common,status:'text',score:'number',band:'text',scoredAt:'date'}}
};
export const businessCatalog=m=>Object.entries(BUSINESS_CATALOG).filter(([,d])=>!d.permission||m.capabilities.includes(d.permission)).map(([id,d])=>({id,label:d.label,fields:d.fields}));
const normalize=v=>String(v??'').normalize('NFKC').toLowerCase();
export function validateBusinessPlan(plan,window,question,timezone){
 const d=BUSINESS_CATALOG[plan.dataset];
 if(plan.overdueOnly&&(plan.dataset!=='tasks'||!/\b(overdue|past due)\b/i.test(question)))throw new AppError(400,'AGENT_CLARIFY','Specify overdue lead tasks.');
 if(plan.ownOnly&&!/\b(my|me|mine|I)\b/i.test(question))throw new AppError(400,'AGENT_CLARIFY','Specify whose recorded work to read.');
 if(!d||plan.outcome!=='none'||plan.groupBy&&!d.fields[plan.groupBy]||(plan.selectFields||[]).some(f=>!d.fields[f]))throw new AppError(400,'AGENT_CLARIFY','Choose an available business dataset and its recorded fields.');
 if(window&&d.fields[plan.dateField]!=='date')throw new AppError(400,'AGENT_CLARIFY','Choose the recorded date for this business query.');
 for(const f of plan.filters){
  const type=d.fields[f.field];
  const statusAliases={Pending:/\b(open|pending)\b/i,Completed:/\b(done|closed|completed|complete)\b/i,Cancelled:/\b(cancelled|canceled)\b/i};
  const grounded=normalize(question).includes(normalize(f.value)) || ['state','status'].includes(f.field)&&statusAliases[f.value]?.test(question) || ['failed','invalid','duplicates'].includes(f.field)&&f.value==='0'&&f.operator==='after'&&/\b(failed|invalid|duplicates?)\b/i.test(question);
  if(!type||!grounded)throw new AppError(400,'AGENT_CLARIFY','Specify the business field and literal value to match.');
  if(['before','after'].includes(f.operator)&&!['number','date'].includes(type))throw new AppError(400,'AGENT_CLARIFY','Use a date or number for this comparison.');
  if(type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(f.value)||!Number.isFinite(Date.parse(f.value+'T00:00:00Z'))||new Date(f.value+'T00:00:00Z').toISOString().slice(0,10)!==f.value))throw new AppError(400,'AGENT_CLARIFY','Specify the recorded calendar date as YYYY-MM-DD.');
  if(type==='number'&&!Number.isFinite(Number(f.value)))throw new AppError(400,'AGENT_CLARIFY','Specify a valid numeric value.');
 }
 const ownOnly=plan.ownOnly&&!( /\bmy (?:accessible )?leads\b/i.test(question)&&! /\b(my tasks|my calls|my notes|my imports|my files|assigned to me|by me|I logged|I uploaded)\b/i.test(question));
 return {...plan,ownOnly,window,timezone};
}
export async function businessRecord(db,m,dataset,id){
 const d=BUSINESS_CATALOG[dataset];
 if(!d||d.permission&&!m.capabilities.includes(d.permission))throw new AppError(403,'FORBIDDEN','Business read access is required.');
 let row=await db.get(path(d.collection,id));
 if(!row||row.deleted||['Deleting','Deleted','DetailsDeleted'].includes(row.status)||['Deleting','Deleted'].includes(row.state))return null;
 if(dataset==='notes'&&row.type!=='note'||dataset==='calls'&&row.type!=='call')return null;
 let lead=null;
 if(!['imports','reports'].includes(dataset)){
  const leadId=dataset==='scores'?row.id:row.leadId;
  if(!leadId)return null; // Never surface personal reminders.
  lead=await db.get(path('leads',leadId));
  if(!canReadLead(m,lead))return null;
 }
 if(dataset==='imports'){
  if(row.createdByUid!==m.uid&&!sharedImports(m))return null;
  row=await readImport(db,m,id);
 }
 if(dataset==='reports'){
  if(row.ownerUid!==m.uid)return null;
  try{row=await readHygieneScan(db,{uid:m.uid},id);}catch(e){if(['NOT_FOUND','STALE_ACCESS'].includes(e.code))return null;throw e;}
 }
 if(dataset==='files'&&row.state!=='Ready')return null;
 if(dataset==='scores')row={...row,...scoreView(await readScoring(db),lead,row)};
 const personId=dataset==='tasks'?row.recipientUid:dataset==='files'?row.createdByUid:row.actorUid;
 const member=personId?await db.get(path('members',personId)):null;
 const person=typeof member?.name==='string'&&!member.name.includes('@')?member.name:'Not recorded';
 const source={...row,leadName:lead?.name,company:lead?.company,stage:lead?.stage,person};
 const values=Object.fromEntries(Object.keys(d.fields).map(k=>[k,source[k]??null]));
 const href=lead?'/leads/'+encodeURIComponent(lead.id):dataset==='imports'?'/imports':'/hygiene';
 return {values,ownerUid:personId||row.createdByUid||row.ownerUid||null,leadId:lead?.id||null,version:row.version||row.sourceVersion||0,result:{id:dataset+':'+id,name:row.title||row.filename||row.name||lead?.name||d.label,company:lead?.name||'',stage:row.state||row.status||'',detail:Object.entries(values).filter(([,v])=>v!==null).map(([k,v])=>k.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase())+': '+String(v).slice(0,1000)).join('\n'),href}};
}
export function matchesBusiness(values,plan){
 const d=BUSINESS_CATALOG[plan.dataset];
 for(const f of plan.filters){
  const actual=values[f.field];if(actual===null)return false;
  const a=normalize(actual),b=normalize(f.value);
  if(f.operator==='equals'&&a!==b||f.operator==='contains'&&!a.includes(b)||f.operator==='not_equals'&&a===b||f.operator==='not_contains'&&a.includes(b))return false;
  if(['before','after'].includes(f.operator)){
   const x=d.fields[f.field]==='number'?Number(actual):reportingDate(String(actual),plan.timezone), y=d.fields[f.field]==='number'?Number(f.value):f.value;
   if(f.operator==='before'?!(x<y):!(x>y))return false;
  }
 }
 if(plan.window){const raw=values[plan.dateField],date=raw?reportingDate(String(raw),plan.window.timezone):'';if(!date||date<plan.window.startDate||date>=plan.window.endDate)return false;}
 return true;
}
export async function businessPage(tx,r,m){
 const p=r.agentPlan,d=BUSINESS_CATALOG[p.dataset];
 if(!businessCatalog(m).some(c=>c.id===p.dataset))throw new AppError(403,'FORBIDDEN','Business read access is required.');
 const filters=p.dataset==='reports'?[['ownerUid','==',m.uid]]:p.dataset==='imports'&&!sharedImports(m)?[['createdByUid','==',m.uid]]:[];
 const rows=await tx.query(path(d.collection),{filters,order:'__name__',after:r.after?[r.after]:undefined,limit:100});
 const next={...r,scanned:r.scanned+rows.length,after:rows.length?documentKey(rows.at(-1)):r.after,groups:{...r.groups}};
 for(const row of rows){
  const record=await businessRecord(tx,m,p.dataset,row.id);
  if(!record)continue;
  next.accessibleScanned=(next.accessibleScanned||0)+1;
  if(p.ownOnly&&record.ownerUid!==m.uid||p.overdueOnly&&(record.values.state!=='Pending'||!record.values.dueAt||record.values.dueAt>=r.createdAt)||!matchesBusiness(record.values,p))continue;
  const requestId=r.agentSteps?r.id+':'+r.partIndex:r.id,key=requestId+'_'+hash(p.dataset+':'+row.id);
  if(await tx.get(path('assistantContributions',key)))continue;
  tx.set(path('assistantContributions',key),{id:key,jobId:r.jobId,requestId,leadId:record.leadId,lead:record.result,business:{dataset:p.dataset,id:row.id,version:record.version}});
  next.matched=(next.matched||0)+1;
  if(p.groupBy){const label=String(record.values[p.groupBy]??'Not recorded').slice(0,200),key=hash(label);if(next.groups[key])next.groups[key].count++;else if(Object.keys(next.groups).length<100)next.groups[key]={label,count:1};else next.groupOverflow=(next.groupOverflow||0)+1;}
 }
 if(rows.length<100||next.scanned>=25000){next.phase='Answer';next.after=null;next.limited=rows.length===100&&next.scanned>=25000;}
 return next;
}
export function businessAnswer(r,config){
 const p=r.agentPlan,d=BUSINESS_CATALOG[p.dataset],count=r.matched||0;
 return {state:r.limited?'Partial':'Grounded',text:`I found ${count} ${count===1?({tasks:'lead task',notes:'note',calls:'call',transitions:'stage change',imports:'import',reports:'Hygiene report',files:'file',scores:'lead score'})[p.dataset]:d.label}.`+(r.limited?' The scan limit was reached; this is a partial count. Narrow the question to check a smaller set.':''),count,groups:Object.fromEntries(Object.values(r.groups||{}).map(g=>[g.label,g.count])),groupOverflow:r.groupOverflow||0,hasResults:true,resultType:'records',coverage:{cohort:'Business records within your current access',scanned:r.accessibleScanned||0,asOf:r.createdAt,timezone:config.timezone,...(p.window?{window:p.window}:{})}};
}
