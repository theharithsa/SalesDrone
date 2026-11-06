import { settingsAuditLogFields } from './settings-audit.js';
import { randomUUID } from 'node:crypto';
import { path } from './policy.js';
export function tenantOrigin(value, { allowLocalTest = false } = {}) {
  const u = new URL(value);
  if (
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== '/' ||
    (!(
      u.protocol === 'https:' &&
      /^[a-z0-9-]+\.live\.dynatrace\.com$/.test(u.hostname)
    ) &&
      !(
        allowLocalTest &&
        u.protocol === 'http:' &&
        ['127.0.0.1', 'localhost'].includes(u.hostname)
      ))
  )
    throw Error('Invalid Dynatrace ingestion origin');
  return u.origin;
}
export async function deliverTelemetry({
  store,
  tenant,
  key,
  telemetry,
  fetchImpl = fetch,
  now = () => new Date().toISOString(),
  allowLocalTest = false,
}) {
  const origin = tenantOrigin(tenant, { allowLocalTest }),
    queue = path('telemetryOutbox');
  const started=Date.now(),deadline=started+80000;
  const buckets=await Promise.all(['SendingBatch','Sending','PendingBatch','Pending'].map(status=>store.query(queue,{
    filters:[['status','==',status],['nextAttemptAt','<=',now()]],order:'nextAttemptAt',limit:20,
  })));
  // Fair global due order: neither new grouped nor legacy entries may starve.
  const jobs=buckets.flat().sort((a,b)=>a.nextAttemptAt.localeCompare(b.nextAttemptAt)||a.id.localeCompare(b.id)).slice(0,20);
  const stats={examined:jobs.length,delivered:0,retried:0,rejected:0};
  if(telemetry?.outboxHealth&&store.count)try{
    const counts=Object.fromEntries(await Promise.all(['Pending','Sending','PendingBatch','SendingBatch','Rejected'].map(async status=>[status,await store.count(queue,[['status','==',status]])])));
    const due=buckets.flat().map(j=>Date.parse(j.nextAttemptAt)).filter(Number.isFinite);
    telemetry.outboxHealth({Pending:counts.Pending+counts.PendingBatch,Sending:counts.Sending+counts.SendingBatch,Rejected:counts.Rejected},due.length?Math.max(0,(Date.parse(now())-Math.min(...due))/1000):0);
  }catch{telemetry.log('telemetry.health.failed',{outcome:'failure'},'WARN');}
  const acceptedLog=(event,status)=>{
    const auditFields=settingsAuditLogFields(event);
    if(auditFields)telemetry?.log('settings.audit.delivered',{...auditFields,'event.id':event.id,'http.status_code':status});
    if(/\.(stage_changed|logged|completed|cancelled|archived|restored|assignment_changed|suppressed|unsuppressed|reopened|operation.committed)$/.test(event.type)){
      const data=event.data||{},origin=event.traceparent?.split('-');
      telemetry?.log('audit.delivered',{'event.id':event.id,'event.type':event.type,'event.occurred_at':event.time,'origin.transaction.id':data['transaction.id'],'origin.operation':data.operation,'origin.actor.id':data['actor.id'],'origin.request.id':data['request.id'],'record.domain':data['record.domain'],'entity.ref':data['entity.ref'],'changed.fields':data['changed.fields']||[],...(origin?.length===4?{'origin.trace_id':origin[1],'origin.span_id':origin[2]}:{})});
    }
  };
  for(let i=0;i<jobs.length&&Date.now()<deadline;i+=4)await Promise.all(jobs.slice(i,i+4).map(async job=>{
    const lease=randomUUID(),p=path('telemetryOutbox',job.id);
    const claimed=await store.run(async tx=>{
      const current=await tx.get(p);
      if(!current||!['Pending','Sending','PendingBatch','SendingBatch'].includes(current.status)||current.nextAttemptAt>now())return null;
      const value={...current,status:current.additionalEvents?'SendingBatch':'Sending',lease,attemptCount:current.attemptCount+1,nextAttemptAt:new Date(Date.parse(now())+180000).toISOString()};
      tx.set(p,value);return value;
    });
    if(!claimed)return;
    const send=async()=>{
      const invalid=!claimed.event||claimed.additionalEvents!==undefined&&(!Array.isArray(claimed.additionalEvents)||claimed.additionalEvents.length>9)||claimed.nextEvent!==undefined&&(!Number.isInteger(claimed.nextEvent)||claimed.nextEvent<0||claimed.nextEvent>1+(claimed.additionalEvents?.length||0));
      const events=invalid?[]:[claimed.event,...(claimed.additionalEvents||[])];
      let cursor=Number.isInteger(claimed.nextEvent)?claimed.nextEvent:0,status=0,retryAfter=0,budgetExpired=false;
      for(;cursor<events.length;){
        const remaining=deadline-Date.now();if(remaining<=0){budgetExpired=true;break;}
        const event={...events[cursor]};
        if(!event.traceparent&&telemetry){event.traceparent=telemetry.capture().traceparent||undefined;if(!event.traceparent)delete event.traceparent;}
        try{
          const response=await fetchImpl(origin+'/api/v2/bizevents/ingest',{
            method:'POST',redirect:'error',headers:{Authorization:'Api-Token '+key,'Content-Type':'application/cloudevent+json'},body:JSON.stringify(event),signal:AbortSignal.timeout(Math.max(1,Math.min(10000,remaining))),
          });
          status=response.status;retryAfter=Math.min(3600,Math.max(0,Number(response.headers?.get('retry-after'))||0));
        }catch{status=0;}
        if(status!==202)break;
        // Checkpoint each accepted event outside the source business transaction.
        // A crash before this checkpoint can resend its stable ID, never invent one.
        const checkpoint=await store.run(async tx=>{
          const current=await tx.get(p);if(current?.lease!==lease)return false;
          tx.set(p,{...current,nextEvent:cursor+1});return true;
        });
        if(!checkpoint)return;
        acceptedLog(events[cursor],status);cursor++;
      }
      const accepted=!invalid&&cursor===events.length,permanent=invalid||(!budgetExpired&&((!!status&&status<500&&![202,408,429].includes(status))||claimed.attemptCount>=10));
      const finalized=await store.run(async tx=>{
        const current=await tx.get(p);if(current?.lease!==lease)return false;
        tx.set(p,{...current,status:accepted?'Delivered':permanent?'Rejected':current.additionalEvents?'PendingBatch':'Pending',...(accepted?{deliveredAt:now()}:{}),...(budgetExpired?{attemptCount:Math.max(0,current.attemptCount-1)}:{}),lastStatus:status,deliveryFormat:current.additionalEvents?'cloudevent-group-v1':'cloudevent-v1',nextAttemptAt:new Date(Date.parse(now())+Math.max(retryAfter,Math.min(3600,15*2**Math.min(current.attemptCount,8)))*1000).toISOString()});return true;
      });
      if(!finalized)return;
      const result=accepted?'delivered':permanent?'rejected':'retried';stats[result]++;
      telemetry?.businessDelivery?.(result,status);
      telemetry?.log('telemetry.delivery',{outcome:result,'event.id':claimed.id,'http.status_code':status},accepted?'DEBUG':permanent?'ERROR':'WARN');
    };
    if(telemetry)await telemetry.span('telemetry.deliver',send,{'event.id':claimed.id},claimed.event?.traceparent);else await send();
  }));
  return stats;
}
