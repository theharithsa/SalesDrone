import { localParts } from './automatic-reminders.js';
import { datePlus, weekStart } from './email-policy.js';
import { canReadLead, path } from './policy.js';

export const DIGEST_TASK_LIMIT = 120;
function within(value, from, until, timezone) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) &&
    localParts(value, timezone).date >= from && localParts(value, timezone).date < until;
}
const upper = date => datePlus(date, 1) + 'T00:00:00.000Z';
const lower = date => datePlus(date, -1) + 'T00:00:00.000Z';
async function tasksInWindow(store, uid, state, order, from, until) {
  const filters = [['recipientUid', '==', uid], ['state', '==', state], [order, '<', upper(until)]];
  if (from) filters.push([order, '>=', lower(from)]);
  return store.query(path('tasks'), {
    filters, order, limit: DIGEST_TASK_LIMIT + 1,
    fields: ['id', 'leadId', 'kind', 'deleted', 'deletedAt', 'dueAt', 'completedAt', 'completedDueAt'],
  });
}
export async function digestFacts(store, member, type, slot, prefs) {
  const { timezone } = prefs;
  const start = weekStart(slot.date);
  const previous = datePlus(start, -7);
  const beforePrevious = datePlus(start, -14);
  const [pending, completed] = await Promise.all([
    tasksInWindow(store, member.uid, 'Pending', 'dueAt', type === 'weekly' ? slot.date : null,
      datePlus(slot.date, type === 'daily' ? 1 : 7)),
    type === 'weekly'
      ? tasksInWindow(store, member.uid, 'Completed', 'completedAt', beforePrevious, start)
      : [],
  ]);
  if (pending.length > DIGEST_TASK_LIMIT || completed.length > DIGEST_TASK_LIMIT) return null;
  const ids = [...new Set([...pending, ...completed].map(task => task.leadId).filter(Boolean))];
  const records = await store.getAll(ids.map(id => path('leads', id)), [
    'assignedToUid', 'archived', 'doNotContact', 'needsReview',
  ]);
  const leads = new Map(ids.map((id, index) => [id, records[index]]));
  const scope = new Map();
  const visible = (task, active) => {
    const lead = leads.get(task.leadId);
    const allowed = !task.deleted && !task.deletedAt && !lead?.archived && canReadLead(member, lead) &&
      (!active || task.kind !== 'outreach' || (!lead.doNotContact && !lead.needsReview));
    if (allowed) scope.set(task.leadId, lead);
    return allowed;
  };
  const active = pending.filter(task => visible(task, true));
  if (type === 'daily') {
    const overdue = active.filter(task => task.dueAt < slot.at);
    const today = active.filter(task => task.dueAt >= slot.at &&
      within(task.dueAt, slot.date, datePlus(slot.date, 1), timezone));
    if (!overdue.length && !today.length) return null;
    return { scope, facts: {
      date: slot.date, timezone, dueToday: today.length, overdue: overdue.length,
      nextDeadline: today[0]?.dueAt || null,
      oldestOverdueHours: overdue.length
        ? Math.floor((Date.parse(slot.at) - Date.parse(overdue[0].dueAt)) / 3_600_000) : null,
    } };
  }
  const completions = completed.filter(task => visible(task, false));
  const thisWeek = completions.filter(task => within(task.completedAt, previous, start, timezone));
  if (!thisWeek.length) return null;
  const priorWeek = completions.filter(task => within(task.completedAt, beforePrevious, previous, timezone));
  const upcoming = active.filter(task => task.dueAt >= slot.at &&
    within(task.dueAt, slot.date, datePlus(slot.date, 7), timezone));
  const onTime = thisWeek.every(task => Number.isFinite(Date.parse(task.completedDueAt)))
    ? thisWeek.filter(task => Date.parse(task.completedAt) <= Date.parse(task.completedDueAt)).length : null;
  return { scope, facts: {
    from: previous, until: start, timezone,
    completed: thisWeek.length, leads: new Set(thisWeek.map(task => task.leadId)).size,
    priorWeek: priorWeek.length, onTime, upcoming: upcoming.length,
    nextDeadline: upcoming[0]?.dueAt || null,
  } };
}
