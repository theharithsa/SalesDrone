import { AppError } from './contracts.js';
import { canReadLead, effectiveMember, path } from './policy.js';
import { readResearchSettings } from './lead-research-settings.js';
import { emailOn, readEmailSettings, writeEmailJob, enqueueEmail } from './email-policy.js';

export async function queueLeadEmails(tx, changes, at, trace) {
  if (!changes.some(({ old, lead }) => old.stage !== lead.stage || old.assignedToUid !== lead.assignedToUid)) return;
  const settings = await readEmailSettings(tx);
  if (!settings.enabled) return;
  const stages = changes.some(({ old, lead }) => old.stage !== lead.stage) &&
    (settings.events.lead_converted || settings.events.lead_failed)
    ? await readResearchSettings(tx) : null;
  for (const { old, lead } of changes) {
    if (lead.archived) continue;
    if (emailOn(settings, 'lead_assigned') && lead.assignedToUid && old.assignedToUid !== lead.assignedToUid) {
      const revision = lead.assignmentRevision || 1;
      writeEmailJob(tx, {
        event: 'lead_assigned', identity: lead.id + ':' + revision,
        uid: lead.assignedToUid, leadId: lead.id, sourceVersion: revision, at, trace, settings,
      });
    }
    if (!stages || old.stage === lead.stage) continue;
    const outcomeAssignee = lead.assignedToUid || null;
    const uid = outcomeAssignee || settings.outcomeRecipientUid;
    if (!uid) continue;
    for (const [event, values] of [['lead_converted', stages.convertedStages], ['lead_failed', stages.failedStages]]) {
      if (emailOn(settings, event) && values.includes(lead.stage) && !values.includes(old.stage)) {
        writeEmailJob(tx, {
          event, identity: lead.id + ':' + lead.version, uid, leadId: lead.id,
          sourceVersion: lead.version, outcomeStage: lead.stage, outcomeAssignee, at, trace, settings,
        });
      }
    }
  }
}

export async function queueTaskEmail(tx, action, task, actor, at, trace) {
  if (!task.leadId || !action || task.recipientUid === actor) return;
  const event = 'task_' + action.toLowerCase();
  await enqueueEmail(tx, {
    event, identity: task.id + ':' + task.version, uid: task.recipientUid,
    leadId: task.leadId, taskId: task.id, sourceVersion: task.version, at, trace,
  });
}

export async function assertTaskRecipient(tx, member, lead) {
  const recipient = await effectiveMember(tx, await tx.get(path('members', member)));
  if (!recipient?.active || !recipient.capabilities.includes('leads:read') || !canReadLead(recipient, lead))
    throw new AppError(400, 'ASSIGNEE', 'Choose an active member who can view this lead');
}
