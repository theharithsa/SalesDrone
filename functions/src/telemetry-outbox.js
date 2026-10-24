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
  const [pending, sending] = await Promise.all(
    ['Pending', 'Sending'].map((status) =>
      store.query(queue, {
        filters: [
          ['status', '==', status],
          ['nextAttemptAt', '<=', now()],
        ],
        order: 'nextAttemptAt',
        limit: 20,
      }),
    ),
  );
  const jobs = [...sending, ...pending].slice(0, 20),
    stats = { examined: jobs.length, delivered: 0, retried: 0, rejected: 0 };
  for (let i = 0; i < jobs.length; i += 4)
    await Promise.all(
      jobs.slice(i, i + 4).map(async (job) => {
        const lease = randomUUID(),
          p = path('telemetryOutbox', job.id);
        const claimed = await store.run(async (tx) => {
          const current = await tx.get(p);
          if (
            !current ||
            !['Pending', 'Sending'].includes(current.status) ||
            current.nextAttemptAt > now()
          )
            return null;
          const value = {
            ...current,
            status: 'Sending',
            lease,
            attemptCount: current.attemptCount + 1,
            nextAttemptAt: new Date(Date.parse(now()) + 180000).toISOString(),
          };
          tx.set(p, value);
          return value;
        });
        if (!claimed) return;
        const send = async () => {
          let status = 0,
            retryAfter = 0;
          try {
            const event = { ...claimed.event };
            if (!event.traceparent && telemetry) {
              event.traceparent = telemetry.capture().traceparent || undefined;
              if (!event.traceparent) delete event.traceparent;
            }
            const r = await fetchImpl(origin + '/api/v2/bizevents/ingest', {
              method: 'POST',
              redirect: 'error',
              headers: {
                Authorization: 'Api-Token ' + key,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(event),
              signal: AbortSignal.timeout(10000),
            });
            status = r.status;
            retryAfter = Math.min(
              3600,
              Math.max(0, Number(r.headers?.get('retry-after')) || 0),
            );
          } catch {}
          const accepted = status === 202,
            permanent =
              (!!status && status < 500 && ![202, 408, 429].includes(status)) ||
              claimed.attemptCount >= 10;
          await store.run(async (tx) => {
            const current = await tx.get(p);
            if (current?.lease !== lease) return;
            tx.set(p, {
              ...current,
              status: accepted
                ? 'Delivered'
                : permanent
                  ? 'Rejected'
                  : 'Pending',
              ...(accepted ? { deliveredAt: now() } : {}),
              lastStatus: status,
              nextAttemptAt: new Date(
                Date.parse(now()) +
                  Math.max(
                    retryAfter,
                    Math.min(3600, 15 * 2 ** Math.min(current.attemptCount, 8)),
                  ) *
                    1000,
              ).toISOString(),
            });
          });
          const result = accepted
            ? 'delivered'
            : permanent
              ? 'rejected'
              : 'retried';
          stats[result]++;
          telemetry?.log('telemetry.delivery', {
            outcome: result,
            'event.id': claimed.id,
            'http.status_code': status,
          });
        };
        if (telemetry)
          await telemetry.span(
            'telemetry.deliver',
            send,
            { 'event.id': claimed.id },
            claimed.event.traceparent,
          );
        else await send();
      }),
    );
  return stats;
}
