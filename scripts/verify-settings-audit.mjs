// Synthetic audit transport check; never modifies production settings or audit records.
import { randomUUID } from 'node:crypto';
import { cloud } from './cloud-access.mjs';
import { memoryStore } from '../functions/src/store.js';
import { path } from '../functions/src/policy.js';
import { queueSettingsAudits } from '../functions/src/settings-audit.js';
import { deliverTelemetry } from '../functions/src/telemetry-outbox.js';
import { createTelemetry } from '../functions/src/telemetry.js';
const secret = await cloud(
  'https://secretmanager.googleapis.com/v1/projects/sales-drone-avinya/secrets/DYNATRACE_API_TOKEN/versions/latest:access',
);
let key = Buffer.from(secret.payload.data, 'base64').toString();
const store = memoryStore(),
  tenant = 'https://indiacs.live.dynatrace.com';
const telemetry = createTelemetry({
  tenant,
  key,
  service: 'salesdrone-validation',
  environment: 'production-verification',
});
try {
  let eventId;
  const result = await telemetry.worker(
    'settings-audit-verification',
    async () => {
      await store.run(async (tx) =>
        queueSettingsAudits(
          tx,
          {
            id: randomUUID(),
            actorUid: 'synthetic-audit-verification',
            action: 'verification.settings.audit',
            requestId: randomUUID(),
            createdAt: new Date().toISOString(),
          },
          [
            {
              section: 'appearance',
              keys: ['bookMode'],
              targetId: 'synthetic-user',
              operation: 'updated',
            },
          ],
          telemetry.capture(),
        ),
      );
      const row = (await store.query(path('telemetryOutbox'), { limit: 1 }))[0];
      eventId = row.id;
      // Probe traffic is explicitly labelled and has no server-confirmed business authority.
      await store.run(async (tx) =>
        tx.set(path('telemetryOutbox', row.id), {
          ...row,
          event: {
            ...row.event,
            source: 'com.avinyatech.salesdrone.validation',
            data: {
              ...row.event.data,
              'event.provider': 'com.avinyatech.salesdrone.validation',
              'event.authority': 'synthetic-verification',
              'validation.synthetic': true,
            },
          },
        }),
      );
      return deliverTelemetry({ store, tenant, key, telemetry });
    },
  );
  const receipt = await store.get(path('telemetryOutbox', eventId));
  console.log(
    JSON.stringify({
      synthetic: true,
      eventId,
      version: receipt.event.data['app.version'],
      ...result,
      httpStatus: receipt.lastStatus,
      status: receipt.status,
      customerSettingsChanged: false,
      tenantSearchability: 'Not established by HTTP acceptance',
    }),
  );
  if (receipt.status !== 'Delivered') process.exitCode = 1;
} finally {
  key = '';
  await telemetry.flush();
  await telemetry.shutdown();
}
