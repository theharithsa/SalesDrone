import { hash } from './policy.js';
import { STAGES, OUTCOMES, TASK_KINDS } from './contracts.js';
const fields = new Set(['name','phone','email','company','city','zone','source','stage','assignedToUid','archived','doNotContact','enquiryDate','enquiryStatus','initialDiscussion','customFields','state','dueAt','kind','deletedAt','title','active','capabilities','scope','role','status','version']);
const ref=(kind,id)=>typeof id==='string' ? kind+':'+hash(kind+':'+id) : undefined;
export function optionRef(kind,value) {
  if(typeof value!=='string') return 'not_recorded';
  if((kind==='stage'?STAGES:kind==='outcome'?OUTCOMES:[]).includes(value))return value;
  return ref(kind,value);
}
export function changedFields(before,after) {
  return [...new Set([...Object.keys(before||{}),...Object.keys(after||{})])]
    .filter(key=>fields.has(key)&&JSON.stringify(before?.[key])!==JSON.stringify(after?.[key])).slice(0,40);
}
export function semanticChanges(domain,before,after) {
  if(!after)return [];
  const common={'record.domain':domain,'entity.ref':ref(domain,after.id),'record.version':Number.isFinite(after.version)?after.version:undefined,'changed.fields':changedFields(before,after)};
  const event=(type,data={})=>({type,...common,...data});
  if(domain==='auditEvents')return [event('audit.operation.committed',{'audit.id':ref('audit',after.id),'audit.action':after.action})];
  if(domain==='leads'&&before){
    const result=[];
    if(before.stage!==after.stage)result.push(event('leads.stage_changed',{'lead.id':ref('leads',after.id),'stage.from':optionRef('stage',before.stage),'stage.to':optionRef('stage',after.stage),'lead.source':optionRef('source',after.source)}));
    for(const [key,type] of [['assignedToUid','assignment_changed'],['archived',after.archived?'archived':'restored'],['doNotContact',after.doNotContact?'suppressed':'unsuppressed']])
      if(before[key]!==after[key]&&(key==='assignedToUid'||after[key]===true||before[key]===true))result.push(event('leads.'+type,{'lead.id':ref('leads',after.id)}));
    return result;
  }
  if(domain==='activities'&&!before&&['note','call'].includes(after.type))return [event('activities.logged',{'lead.id':ref('leads',after.leadId),'activity.type':after.type,outcome:optionRef('outcome',after.outcome),has_follow_up:!!(after.autoReminder?.taskId||after.autoReminder?.status==='Manual')})];
  if(domain==='tasks'&&before&&before.state!==after.state&&['Completed','Cancelled','Pending'].includes(after.state)){
    const at=Date.parse(after.completedAt||after.cancelledAt||after.updatedAt),due=Date.parse(before.dueAt);
    return [event('tasks.'+({Completed:'completed',Cancelled:'cancelled',Pending:'reopened'}[after.state]),{'task.id':ref('tasks',after.id),'lead.id':ref('leads',after.leadId),'task.kind':TASK_KINDS.includes(after.kind)?after.kind:'other',...(Number.isFinite(at)&&Number.isFinite(due)?{overdue:at>due,'lateness.s':Math.max(0,(at-due)/1000)}:{})})];
  }
  if(domain==='tasks'&&before?.state==='Pending'&&after.state==='Pending'&&before.dueAt!==after.dueAt)
    return [event('tasks.rescheduled',{'task.id':ref('tasks',after.id),'lead.id':ref('leads',after.leadId),'task.kind':TASK_KINDS.includes(after.kind)?after.kind:'other'})];
  if(domain==='imports'&&before?.status!=='Completed'&&after.status==='Completed')return [event('imports.completed',{'import.id':ref('imports',after.id),...(Number.isFinite(Date.parse(after.completedAt))&&Number.isFinite(Date.parse(after.createdAt))?{'duration.s':Math.max(0,(Date.parse(after.completedAt)-Date.parse(after.createdAt))/1000)}:{}),...Object.fromEntries([['created','imported'],['updated','updated'],['unchanged','unchanged'],['skipped','skipped'],['total','total']].filter(([,key])=>Number.isFinite(after[key])).map(([key,source])=>['rows.'+key,after[source]]))})];
  return [];
}
