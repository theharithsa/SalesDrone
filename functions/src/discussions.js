// Workbook columns and later comments share one append-only activity timeline.
import { path } from './policy.js';
import { enqueueAnalysis } from './automatic-reminders.js';
export const DISCUSSION_FIELDS = [
  ['initialDiscussion', 'Initial discussion'],
  ['followUp1', '1st follow up'],
  ['followUp2', '2nd follow up'],
  ['followUp3', '3rd follow up'],
  ['followUp4', '4th follow up'],
  ['comments', 'Comment'],
];
export async function appendDiscussions(
  tx,
  lead,
  member,
  now,
  {
    previous = null,
    imported = false,
    importId = null,
    idPrefix = lead.id,
  } = {},
) {
  const added = [];
  for (const [index, [field, label]] of DISCUSSION_FIELDS.entries()) {
    const text = String(lead[field] || '').trim();
    if (!text || (previous && text === String(previous[field] || '').trim()))
      continue;
    // Older clients may send the same initial text under Comments as well.
    if (
      field === 'comments' &&
      text === String(lead.initialDiscussion || '').trim()
    )
      continue;
    const activity = {
      id: idPrefix + '_discussion_' + index,
      leadId: lead.id,
      type: 'note',
      notes: text,
      actorUid: member.uid,
      createdAt: now,
      revision: 1,
      sourceColumn: label,
      sourceOrder: index,
      occurredAt: imported ? null : now,
      ...(imported ? { importId, imported: true } : {}),
    };
    if (!imported && ['initialDiscussion', 'comments'].includes(field))
      added.push(await enqueueAnalysis(tx, activity, member, lead, now));
    else {
      tx.set(path('activities', activity.id), activity);
      added.push(activity);
    }
  }
  return added;
}

export function appendImportedComments(
  tx,
  lead,
  member,
  comments,
  now,
  importId,
) {
  for (const [order, comment] of comments.entries()) {
    const activity = {
      id: lead.id + '_import_comment_' + String(order).padStart(2, '0'),
      leadId: lead.id,
      type: 'note',
      notes: comment.notes,
      actorUid: member.uid,
      createdAt: now,
      revision: 1,
      sourceColumn: comment.sourceColumn,
      sourceOrder: order,
      sourceColumnIndex: comment.sourceIndex,
      occurredAt: null,
      importId,
      imported: true,
    };
    tx.set(path('activities', activity.id), activity);
  }
}
