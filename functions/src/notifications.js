import { path, canReadLead, effectiveMember } from './policy.js';
export const isLeadNotification = (n) =>
  ['lead_created', 'lead_assigned'].includes(n.kind);
// Write the inbox item and push outbox in the same transaction as the lead.
export function queueLeadNotification(tx, lead, actorUid, kind, now) {
  if (!lead.assignedToUid) return;
  const id =
    Date.parse(now).toString(36) + '_lead_' + lead.id + '_' + lead.version;
  const notification = {
    id,
    kind,
    recipientUid: lead.assignedToUid,
    leadId: lead.id,
    taskId: null,
    assignmentRevision: lead.assignmentRevision || 1,
    actorUid,
    workspaceId: 'avinyatech',
    title:
      kind === 'lead_created'
        ? 'A new lead is ready for you'
        : 'A lead was assigned to you',
    body: 'Open the lead to review the details and plan your next step.',
    createdAt: now,
    readAt: null,
  };
  tx.set(`users/${lead.assignedToUid}/notifications/${id}`, notification);
  tx.set(path('reminderDeliveries', id), {
    ...notification,
    status: 'Pending',
    nextAttemptAt: now,
    attemptCount: 0,
  });
}
export async function notificationVisible(db, member, notification) {
  if (isLeadNotification(notification)) {
    const lead = await db.get(path('leads', notification.leadId));
    return (
      !!lead &&
      !lead.archived &&
      canReadLead(member, lead) &&
      lead.assignedToUid === member.uid &&
      (lead.assignmentRevision || 1) === notification.assignmentRevision
    );
  }
  const task = notification.taskId
    ? await db.get(path('tasks', notification.taskId))
    : null;
  if (!task || task.deleted || task.recipientUid !== member.uid) return false;
  if (!task.leadId) return true;
  const lead = await db.get(path('leads', task.leadId));
  return canReadLead(member, lead) && !lead.archived;
}
// Rechecked while claiming a delivery and immediately before each external send.
export async function deliveryContext(db, job) {
  if (isLeadNotification(job)) {
    const member = await effectiveMember(
      db,
      await db.get(path('members', job.recipientUid)),
    );
    if (
      !member?.active ||
      !member.capabilities.includes('leads:read') ||
      !(await notificationVisible(db, member, job))
    )
      return null;
    return {
      member,
      url: '/leads?lead=' + encodeURIComponent(job.leadId),
      body:
        job.kind === 'lead_created'
          ? 'A new lead is ready for you. Open your workspace to view it.'
          : 'A lead was assigned to you. Open your workspace to view it.',
    };
  }
  const task = await db.get(path('tasks', job.taskId));
  const member = task
    ? await effectiveMember(
        db,
        await db.get(path('members', task.recipientUid)),
      )
    : null;
  const lead = task?.leadId ? await db.get(path('leads', task.leadId)) : null;
  if (
    task?.state !== 'Pending' ||
    task.deleted ||
    task.version !== job.taskVersion ||
    !member?.active ||
    !member.capabilities.includes('leads:read') ||
    (task.leadId &&
      (!canReadLead(member, lead) ||
        lead.archived ||
        (task.kind === 'outreach' && (lead.doNotContact || lead.needsReview))))
  )
    return null;
  return {
    task,
    member,
    url: '/tasks?task=' + encodeURIComponent(task.id),
    body: 'A reminder is due. Open your workspace to view it.',
  };
}
