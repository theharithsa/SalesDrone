import { path } from './policy.js';

const terminalStatuses = ['Dispatched', 'Failed', 'Cancelled'];
const retentionMs = 90 * 24 * 60 * 60 * 1000;
const receiptLimit = 20;

export function deliveryReceipts(db, deliveryId, limit) {
  return db.query(path('deviceDeliveries'), {
    filters: [
      ['id', '>=', deliveryId + '_'],
      ['id', '<=', deliveryId + '_\uf8ff'],
    ],
    order: 'id',
    limit,
  });
}

export async function cleanTerminalDeliveries(store, at) {
  const cutoff = new Date(Date.parse(at) - retentionMs).toISOString();
  return store.run(async (tx) => {
    const jobs = await tx.query(path('reminderDeliveries'), {
      filters: [
        ['status', 'in', terminalStatuses],
        ['nextAttemptAt', '<=', cutoff],
      ],
      order: 'nextAttemptAt',
      limit: 10,
    });
    let removed = 0;
    for (const job of jobs) {
      if (job.finishedAt > cutoff) continue;
      const receipts = await deliveryReceipts(tx, job.id, receiptLimit + 1);
      for (const receipt of receipts.slice(0, receiptLimit)) {
        tx.delete(path('deviceDeliveries', receipt.id));
        removed++;
      }
      if (receipts.length > receiptLimit) continue;
      tx.delete(path('reminderDeliveries', job.id));
      removed++;
    }
    return { removed };
  });
}
