// Operator-only acceptance command. No HTTP trigger or scheduled cost.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { preproduction } from './preproduction.js';
import { firestoreStore } from './store.js';
import { observableStore } from './observable-store.js';
import { createTelemetry } from './telemetry.js';
import { deliverTelemetry } from './telemetry-outbox.js';
import { prepareLead } from './leads.js';
import { path } from './policy.js';
import { BUILD_COMMIT } from './version.js';

assert.equal(process.env.SDR_PREFLIGHT_ENVIRONMENT, 'pre-production');
assert.equal(process.env.SDR_PREFLIGHT_COMMIT, BUILD_COMMIT);
assert.match(BUILD_COMMIT, /^[0-9a-f]{40}$/);
assert.ok(process.env.DYNATRACE_API_TOKEN, 'Missing pre-production ingestion token');
const identity = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email', {
  headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(5000),
});
assert.equal(await identity.text(), preproduction.runtimeAccount);

const app = initializeApp({ projectId: preproduction.project });
const base = firestoreStore(getFirestore(app, preproduction.database));
const telemetry = createTelemetry({
  tenant: process.env.DYNATRACE_TENANT_URL,
  key: process.env.DYNATRACE_API_TOKEN,
  service: 'salesdrone-preprod-outbox-check',
  environment: 'pre-production',
});
const now = new Date().toISOString();
const fixture = 'preprod-verify-' + randomUUID();
const queue = path('telemetryOutbox');

let documents;
try {
  await telemetry.worker('telemetry.preprod_acceptance', async () => {
    const captured = {
      ...base,
      run: async (fn) => {
        const written = await base.run(async tx => {
          const pending = new Map();
          await fn({
            ...tx,
            set: (name, value) => {
              assert.ok(!pending.has(name), 'Duplicate acceptance fixture path');
              pending.set(name, value);
              tx.set(name, value);
            },
          });
          assert.ok(pending.size > 0 && pending.size <= 10);
          return pending;
        });
        documents = written;
      },
    };
    await observableStore(captured, () => telemetry).run(async tx => {
      assert.equal(await tx.get(path('leads', fixture)), null);
      const lead = await prepareLead(tx, {
        name: 'Synthetic release check',
        enquiryDate: now.slice(0, 10),
        needsReview: true,
        stage: 'New',
      }, { uid: 'preprod-release-check', id: fixture, now });
      lead.write();
    });
    // Only events created by this fixture transaction can be selected.
    const jobs = [...documents].filter(([name]) => name.startsWith(queue + '/')).map(([, value]) => value);
    assert.ok(jobs.some(job => job.event.type === 'com.avinyatech.salesdrone.leads.committed'));
    const scoped = {
      ...base,
      count: undefined,
      query: (collection, { filters }) => {
        assert.equal(collection, queue);
        return jobs.filter(job => job.status === filters[0][2]);
      },
    };
    const result = await deliverTelemetry({
      store: scoped,
      tenant: process.env.DYNATRACE_TENANT_URL,
      key: process.env.DYNATRACE_API_TOKEN,
      telemetry,
      environment: 'pre-production',
    });
    assert.equal(result.delivered, jobs.length, 'Synthetic committed outbox did not deliver');
    console.log(JSON.stringify({ event: 'preprod-outbox-check', buildCommit: BUILD_COMMIT,
      delivered: result.delivered, eventIds: jobs.map(job => job.event.id) }));
    return { processed: result.delivered };
  });
} finally {
  if (documents) await base.run(tx => {
    for (const name of documents.keys()) tx.delete(name);
  });
  await telemetry.shutdown();
}
