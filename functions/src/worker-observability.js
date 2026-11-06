import { path } from './policy.js';
import { errorType } from './observability-contract.js';
const queues={reminders:'reminderDeliveries',analysis:'noteAnalyses',research:'researchIndexJobs'};
// This is due-work age, not original enqueue age. Lease/retry timestamps move forward.
export async function observeQueue(store,telemetry,queue,now=new Date().toISOString()) {
  if(!telemetry||!queues[queue]||!store.count)return;
  try {
    const collection=path(queues[queue]);
    if(queue==='research'){telemetry.queueHealth(queue,await store.count(collection,[['status','==','Pending']]),undefined);return;}
    const filters=[['status','==','Pending'],['nextAttemptAt','<=',now]];
    const [count,oldest]=await Promise.all([store.count(collection,filters),store.query(collection,{filters,order:'nextAttemptAt',limit:1})]);
    telemetry.queueHealth(queue,count,oldest[0]?.nextAttemptAt);
  }catch(error){telemetry.log('worker.health.failed',{'error.type':errorType(error)},'WARN');}
}
