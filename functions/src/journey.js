import { path, hash } from './policy.js';
export const transitionId = (leadId, version) =>
  hash(leadId).slice(0, 32) + '_' + String(version).padStart(12, '0');
export function recordStage(tx, lead, from, actorUid, at, reason) {
  if (from === lead.stage) return;
  const id = transitionId(lead.id, lead.version);
  tx.set(path('leadTransitions', id), {
    id,
    leadId: lead.id,
    from: from || null,
    to: lead.stage,
    leadVersion: lead.version,
    actorUid: actorUid || null,
    createdAt: at,
    reason,
  });
}
