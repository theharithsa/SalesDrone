// Explicit synthetic probe through the real transport, with no production domain writes.
import { randomUUID } from 'node:crypto';
import { cloud } from './cloud-access.mjs';
import { memoryStore } from '../functions/src/store.js';
import { path } from '../functions/src/policy.js';
import { createTelemetry } from '../functions/src/telemetry.js';
import { deliverTelemetry } from '../functions/src/telemetry-outbox.js';
import { APP_VERSION, BUILD_COMMIT } from '../functions/src/version.js';
const secret = await cloud(
  'https://secretmanager.googleapis.com/v1/projects/sales-drone-avinya/secrets/DYNATRACE_API_TOKEN/versions/latest:access',
);
let key = Buffer.from(secret.payload.data, 'base64').toString();
const tenant = 'https://indiacs.live.dynatrace.com',
  store = memoryStore(),
  id = randomUUID();
const telemetry = createTelemetry({
  tenant,
  key,
  service: 'salesdrone-validation',
  environment: 'production-verification',
});
try {
  const stats = await telemetry.worker('bizevent-verification', async () => {
    const time = new Date().toISOString();
    await store.run(async (tx) =>
      tx.set(path('telemetryOutbox', id), {
        id,
        status: 'Pending',
        attemptCount: 0,
        createdAt: time,
        nextAttemptAt: time,
        event: {
          specversion: '1.0',
          id,
          source: 'com.avinyatech.salesdrone.validation',
          type: 'com.avinyatech.salesdrone.instrumentation.verified',
          time,
          traceparent: telemetry.capture().traceparent,
          data: {
            'event.id': id,
            'event.provider': 'com.avinyatech.salesdrone.validation',
            'event.authority': 'synthetic-verification',
            'validation.synthetic': true,
            'app.version': APP_VERSION,
            'build.commit': BUILD_COMMIT,
          },
        },
      }),
    );
    return deliverTelemetry({ store, tenant, key, telemetry });
  });
  const receipt = await store.get(path('telemetryOutbox', id));
  console.log(
    JSON.stringify({
      synthetic: true,
      eventId: id,
      ...stats,
      status: receipt.status,
      httpStatus: receipt.lastStatus,
      format: receipt.deliveryFormat,
      tenantSearchability: 'Not established by HTTP acceptance',
    }),
  );
  if (receipt.status !== 'Delivered') process.exitCode = 1;
} finally {
  key = '';
  await telemetry.flush();
  await telemetry.shutdown();
}
