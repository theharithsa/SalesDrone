// Shared delivery contract for manual and automatically generated tasks.
import { path, validateTimezone } from "./policy.js";
export function makeTask(input, member, id, leadId, now) {
  validateTimezone(input.timezone);
  return {
    ...input,
    id,
    leadId: leadId || null,
    creatorUid: member.uid,
    recipientUid: member.uid,
    state: "Pending",
    version: 1,
    createdAt: now,
    completedAt: null,
  };
}
export function queueTask(tx, task) {
  tx.set(path("tasks", task.id), task);
  const id = task.id + "_" + task.version;
  tx.set(path("reminderDeliveries", id), {
    id,
    taskId: task.id,
    taskVersion: task.version,
    status: "Pending",
    nextAttemptAt: task.dueAt,
    attemptCount: 0,
    createdAt: task.createdAt,
  });
}
