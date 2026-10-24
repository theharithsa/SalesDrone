import { randomUUID } from 'node:crypto';
import { path } from './policy.js';
import { deliveryContext } from './notifications.js';
// One minute scanner; the lease is also nextAttemptAt so abandoned work becomes
// eligible again. Delivery IDs and per-device results survive worker retries.
export async function dispatchReminders({
  store,
  send,
  now = () => new Date().toISOString(),
  limit = 50,
}) {
  const jobs = await store.query(path('reminderDeliveries'), {
    filters: [
      ['status', '==', 'Pending'],
      ['nextAttemptAt', '<=', now()],
    ],
    order: 'nextAttemptAt',
    limit,
  });
  const stats = { claimed: 0, sent: 0, failed: 0, cancelled: 0 };
  for (const candidate of jobs) {
    const lease = randomUUID();
    const job = await store.run(async (tx) => {
      const j = await tx.get(path('reminderDeliveries', candidate.id));
      if (j?.status !== 'Pending' || j.nextAttemptAt > now()) return null;
      const context = await deliveryContext(tx, j);
      const eligible = !!context;
      if (!eligible) {
        tx.set(path('reminderDeliveries', j.id), { ...j, status: 'Cancelled' });
        return { cancelled: true };
      }
      const { member, task } = context;
      const notificationPath = `users/${member.uid}/notifications/${j.id}`;
      const notification = await tx.get(notificationPath);
      if (!notification && task)
        tx.set(notificationPath, {
          id: j.id,
          taskId: task.id,
          leadId: task.leadId,
          workspaceId: 'avinyatech',
          kind: 'task_reminder',
          title: 'A reminder is due',
          createdAt: now(),
          readAt: null,
        });
      const updated = {
        ...j,
        lease,
        nextAttemptAt: new Date(Date.parse(now()) + 120000).toISOString(),
        attemptCount: j.attemptCount + 1,
      };
      tx.set(path('reminderDeliveries', j.id), updated);
      return { ...updated, ...context };
    });
    if (!job) continue;
    if (job.cancelled) {
      stats.cancelled++;
      continue;
    }
    stats.claimed++;
    const devices = await store.query(`users/${job.member.uid}/devices`, {
      filters: [['enabled', '==', true]],
      limit: 100,
    });
    let retry = false;
    for (const device of devices) {
      const resultPath = path('deviceDeliveries', job.id + '_' + device.id);
      const prior = await store.get(resultPath);
      if (prior?.status === 'Accepted') continue;
      const [context, currentDevice] = await Promise.all([
        deliveryContext(store, job),
        store.get(`users/${job.member.uid}/devices/${device.id}`),
      ]);
      if (
        !context ||
        !currentDevice?.enabled ||
        currentDevice.token !== device.token
      )
        continue;
      try {
        await send({
          token: device.token,
          data: {
            title: 'SalesDrone by AvinyaTech',
            body: context.body,
            deliveryId: job.id,
            url: context.url,
          },
          webpush: { headers: { TTL: '3600', Urgency: 'normal' } },
        });
        await store.run(async (tx) => {
          tx.set(resultPath, {
            id: job.id + '_' + device.id,
            status: 'Accepted',
            at: now(),
          });
        });
        stats.sent++;
      } catch (e) {
        const invalid = [
          'messaging/registration-token-not-registered',
          'messaging/invalid-registration-token',
        ].includes(e.code);
        await store.run(async (tx) => {
          const d = await tx.get(
            `users/${job.member.uid}/devices/${device.id}`,
          );
          tx.set(resultPath, {
            id: job.id + '_' + device.id,
            status: invalid ? 'Invalid' : 'Failed',
            at: now(),
          });
          if (invalid && d?.token === device.token)
            tx.set(`users/${job.member.uid}/devices/${device.id}`, {
              ...d,
              enabled: false,
            });
        });
        if (!invalid) retry = true;
        stats.failed++;
      }
    }
    await store.run(async (tx) => {
      const current = await tx.get(path('reminderDeliveries', job.id));
      if (current.lease !== lease) return;
      const stillEligible = !!(await deliveryContext(tx, current));
      if (!stillEligible) stats.cancelled++;
      tx.set(path('reminderDeliveries', job.id), {
        ...current,
        status: !stillEligible
          ? 'Cancelled'
          : retry
            ? job.attemptCount >= 5
              ? 'Failed'
              : 'Pending'
            : 'Dispatched',
        nextAttemptAt: new Date(
          Date.parse(now()) + Math.min(3600000, 60000 * 2 ** job.attemptCount),
        ).toISOString(),
        finishedAt: now(),
      });
    });
  }
  return stats;
}
