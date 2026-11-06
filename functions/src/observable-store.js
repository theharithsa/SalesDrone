import { validParent } from './telemetry.js';
import { collectionName } from './observability-contract.js';
import { semanticChanges } from './business-observability.js';
import { randomUUID } from 'node:crypto';
import { hash, path, ROOT } from './policy.js';
import { APP_VERSION, BUILD_COMMIT } from './version.js';
const asyncQueues=new Set(['noteAnalyses','reminderDeliveries','researchIndexJobs']);
const domains = new Set([
  'leads',
  'leadDataResets',
  'leadAttachments',
  'activities',
  'activityRevisions',
  'leadTransitions',
  'tasks',
  'members',
  'personalAccessTokens',
  'invitations',
  'imports',
  'leadScores',
  'hygieneScans',
  'assistantConversations',
  'assistantRequests',
  'auditEvents',
]);
function domain(p, data) {
  const parts = p.split('/');
  if (p.startsWith(ROOT + '/')) {
    const d = parts[2];
    if (d === 'settings')
      return ['fields', 'scoring', 'ai', 'workspace'].includes(parts[3])
        ? 'settings'
        : null;
    if (d === 'leadScores' && !['Ready', 'Failed'].includes(data?.status))
      return null;
    return domains.has(d) ? d : null;
  }
  if (parts[0] === 'users' && parts[2] === 'notifications')
    return 'notifications';
  if (parts[0] === 'users' && parts[2] === 'devices') return 'devices';
  return null;
}
/** Count only transitions observed from a read-before-write snapshot. No field values leave the store. */
export function lifecycleCounts(domain, before, after) {
  if (['hygieneScans','assistantRequests','assistantConversations'].includes(domain) && after) {
    const result={};
    for(const state of ['Completed','Failed','Stale','Deleting'])
      if(after.status===state&&before?.status!==state)result[state.toLowerCase()]=1;
    return result;
  }
  if (domain === 'leadDataResets' && after)
    return {
      ...(!before ? { reset_started: 1 } : {}),
      ...(after.status === 'Completed' && before?.status !== 'Completed'
        ? { reset_completed: 1 }
        : {}),
      ...(after.status === 'Blocked' && before?.status !== 'Blocked'
        ? { reset_blocked: 1 }
        : {}),
    };
  if (domain === 'imports' && after?.formatVersion === 3) {
    const counts = {};
    for (const [key, name] of [
      ['imported', 'import_created'],
      ['updated', 'import_updated'],
      ['unchanged', 'import_unchanged'],
      ['skipped', 'import_skipped'],
    ]) {
      const n = (after[key] || 0) - (before?.[key] || 0);
      if (n > 0) counts[name] = n;
    }
    for (const [state, name] of [
      ['Preparing', 'import_preparing'],
      ['Completed', 'import_completed'],
      ['Blocked', 'import_blocked'],
      ['DetailsDeleted', 'import_details_deleted'],
    ])
      if (after.status === state && before?.status !== state) counts[name] = 1;
    return counts;
  }
  if (!before || !after) return {};
  const result = {};
  if (domain === 'tasks') {
    for (const state of ['Completed', 'Cancelled', 'Pending'])
      if (after.state === state && before.state !== state)
        result[state === 'Pending' ? 'reopened' : state.toLowerCase()] = 1;
    if (!before.deletedAt && after.deletedAt) result.soft_deleted = 1;
  }
  if (domain === 'leads') {
    if (!before.archived && after.archived) result.archived = 1;
    if (before.archived && after.archived === false) result.restored = 1;
    if (!before.doNotContact && after.doNotContact) result.suppressed = 1;
    if (before.doNotContact && after.doNotContact === false)
      result.unsuppressed = 1;
    if (before.stage !== after.stage) result.stage_changed = 1;
    if (before.assignedToUid !== after.assignedToUid)
      result.assignment_changed = 1;
  }
  return result;
}
// Instrument the SDK boundary; never serialize document values into telemetry.
export function observableStore(base, getTelemetry = () => null) {
  const wrap = (operation, p, fn) => {
    const t=getTelemetry();
    return t?.database ? t.database(operation,collectionName(p),fn)
      : t ? t.span('firestore.'+operation,fn,{'db.system.name':'gcp.firestore','db.operation.name':operation,'db.collection.name':collectionName(p)}) : fn();
  };
  return {
    ...base,
    ...(base.nearest?{nearest:(p,o)=>wrap('nearest',p,()=>base.nearest(p,o))}:{}),
    get:p=>wrap('get',p,()=>base.get(p)),
    getAll:(paths,fields)=>wrap('getAll',paths[0],()=>base.getAll(paths,fields)),
    query:(p,o)=>wrap('query',p,()=>base.query(p,o)),
    count:(p,f)=>wrap('count',p,()=>base.count(p,f)),
    scan:(p,o)=>wrap('scan',p,()=>base.scan(p,o)),
    run:fn=>{
      const available=getTelemetry(), transactionId=randomUUID();
      let attempts=0, committed=[];
      const execute=async span=>{
        const result=await base.run(async tx=>{
          attempts++;
          span?.setAttribute?.('db.transaction.attempts',attempts);
          const written=new Map(),known=new Map();
          const reader={...tx,
            get:async p=>{const v=await wrap('get',p,()=>tx.get(p));known.set(p,v);if(asyncQueues.has(p.split('/')[2])&&validParent(v?.observabilityTraceparent)){const [,traceId,spanId,flags]=v.observabilityTraceparent.split('-');span?.addLink?.({context:{traceId,spanId,traceFlags:parseInt(flags,16),isRemote:true}});}return v;},
            getAll:async(paths,fields)=>{const values=await wrap('getAll',paths[0],()=>tx.getAll(paths,fields));if(!fields)paths.forEach((p,i)=>known.set(p,values[i]));return values;},
            query:async(p,o)=>{const values=await wrap('query',p,()=>tx.query(p,o));if(!o?.fields)for(const v of values)known.set(p+'/'+v.id,v);return values;},
            set:(p,v)=>{let value=v;if(asyncQueues.has(p.split('/')[2])&&!v.observabilityTraceparent){const parent=available?.capture?.().traceparent;if(validParent(parent))value={...v,observabilityTraceparent:parent};}tx.set(p,value);written.set(p,structuredClone(value));},
            delete:p=>{tx.delete(p);written.set(p,null);},
          };
          const value=await fn(reader),time=new Date().toISOString();
          const capture=available?.enabled?available.capture():{actorId:'system',requestId:'unavailable',operationId:transactionId,operation:'database.commit',traceparent:null};
          const audit=[...written].find(([p])=>p.startsWith(path('auditEvents')+'/'))?.[1];
          if(!available?.enabled&&audit){capture.actorId=typeof audit.actorUid==='string'?'user:'+hash('salesdrone:'+audit.actorUid).slice(0,32):'system';capture.operation=audit.action;capture.requestId=audit.requestId||'unavailable';}
          const common={
            'event.provider':'com.avinyatech.salesdrone.backend','event.authority':'server-confirmed',
            'service.name':capture.serviceName||'salesdrone-backend','service.namespace':'avinyatech','deployment.environment.name':capture.environmentName||'unknown',
            'schema.version':1,'transaction.id':transactionId,'operation.id':capture.operationId,
            'request.id':capture.requestId,operation:capture.operation,'actor.id':capture.actorId,
            'app.version':APP_VERSION,'build.commit':BUILD_COMMIT,
            'correlation.origin':capture.traceparent?'backend-transaction':'outbox-consumer',
          };
          const summaries=new Map(),pendingEvents=[];committed=[];
          const enqueue=(id,type,data)=>{
            const event={specversion:'1.0',id,source:'com.avinyatech.salesdrone.backend',type:'com.avinyatech.salesdrone.'+type,time,
              data:Object.fromEntries(Object.entries({...data,...common,'event.id':id}).filter(([,v])=>v!==undefined)),
              ...(capture.traceparent?{traceparent:capture.traceparent}:{}),
            };
            pendingEvents.push(event);
            committed.push(event);
          };
          for(const [p,v] of written){
            const d=domain(p,v);if(!d)continue;
            const s=summaries.get(d)||{written:0,created:0,changed:0,deleted:0};
            s.written++;
            if(v===null)s.deleted++;
            else if(known.has(p)){if(known.get(p)===null)s.created++;else s.changed++;}
            for(const [kind,count] of Object.entries(lifecycleCounts(d,known.get(p),v)))s[kind]=(s[kind]||0)+count;
            summaries.set(d,s);
            for(const change of semanticChanges(d,known.get(p),v)){
              const {type,...details}=change;
              enqueue(hash(transactionId+':'+type+':'+p),type,details);
            }
          }
          for(const [d,s] of summaries)enqueue(hash(transactionId+':'+d),d+'.committed',{
            'record.domain':d,'records.written':s.written,'records.known_created':s.created,'records.known_changed':s.changed,'records.deleted':s.deleted,
            ...Object.fromEntries(Object.entries(s).filter(([k])=>!['written','created','changed','deleted'].includes(k)).map(([k,v])=>['records.'+k,v])),
          });
          // Group only like-typed semantic events. New statuses isolate grouped
          // records from older consumers during a rolling Functions deployment.
          const groups=new Map();
          for(const event of pendingEvents){const list=groups.get(event.type)||[];list.push(event);groups.set(event.type,list);}
          for(const events of groups.values())for(let offset=0;offset<events.length;offset+=10){
            const [event,...additionalEvents]=events.slice(offset,offset+10),id=event.id;
            tx.set(path('telemetryOutbox',id),{id,status:additionalEvents.length?'PendingBatch':'Pending',nextAttemptAt:time,attemptCount:0,createdAt:time,event,...(additionalEvents.length?{additionalEvents,nextEvent:0}:{} )});
          }
          return value;
        });
        if(committed.length)available?.log?.('domain.transaction.committed',{'db.transaction.attempts':attempts,created:committed.length});
        return result;
      };
      return available?.transaction?available.transaction(transactionId,execute):available?available.span('firestore.transaction',execute,{'transaction.id':transactionId}):execute();
    },
  };
}
