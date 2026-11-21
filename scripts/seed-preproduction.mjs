import assert from 'node:assert/strict';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { preproduction as target } from '../functions/src/preproduction.js';
import { PRESETS } from '../functions/src/contracts.js';
import { path } from '../functions/src/policy.js';
import { firestoreStore } from '../functions/src/store.js';
import { prepareLead } from '../functions/src/leads.js';
import { makeTask, queueTask } from '../functions/src/tasks.js';

assert.equal(process.env.GCP_PROJECT_ID, target.project);
assert.equal(process.env.SALESDRONE_SEED_DATABASE, target.database);
assert.equal(process.env.SALESDRONE_ENVIRONMENT, 'pre-production');
assert.ok(process.env.PREPROD_OWNER_EMAIL, 'Supply the verified pre-production owner email');
assert.ok(!process.env.FIRESTORE_EMULATOR_HOST && !process.env.FIREBASE_AUTH_EMULATOR_HOST);
const app = initializeApp({ projectId: target.project, credential: applicationDefault() });
const db = getFirestore(app, target.database);
const owner = await getAuth(app).getUserByEmail(process.env.PREPROD_OWNER_EMAIL);
assert.ok(owner.emailVerified && !owner.disabled && owner.providerData.some(p => p.providerId === 'google.com'));
const store = firestoreStore(db);
const manifest = path('seedManifests', 'synthetic-workspace-v1');
const membership = path('members', owner.uid);
const companies = ['Example Studio', 'Sample Workshop', 'Demo Materials', 'Practice Supply', 'Test Cooperative'];
const result = await store.run(async (tx) => {
  if (await tx.get(manifest)) return { replay: true, writes: 0 };
  const existingMember = await tx.get(membership);
  assert.ok(!existingMember || (existingMember.active && existingMember.role === 'Admin'),
    'Existing pre-production membership needs manual review');
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  const leads = await Promise.all(Array.from({ length: 30 }, async (_, i) => {
    const id = 'preprod-lead-' + String(i + 1).padStart(2, '0');
    assert.ok(!(await tx.get(path('leads', id))), 'Synthetic lead ID already exists without a seed manifest');
    return prepareLead(tx, {
      name: 'Example enquiry ' + (i + 1),
      email: id + '@example.invalid',
      company: companies[i % companies.length],
      enquiryDate: day,
      stage: ['New', 'Working', 'Qualified'][i % 3],
    }, { id, uid: owner.uid, now });
  }));
  if (!existingMember) tx.set(membership, {
    id: owner.uid, uid: owner.uid, email: owner.email, name: owner.displayName || 'Pre-production Admin',
    role: 'Admin', scope: 'all', capabilities: PRESETS.Admin, active: true, version: 1,
  });
  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    lead.write();
    if (i >= 12) continue;
    const task = makeTask({
      title: 'Review synthetic enquiry ' + (i + 1), kind: 'outreach',
      dueAt: new Date(Date.parse(now) + (i + 1) * 3600000).toISOString(), timezone: 'Asia/Kolkata',
    }, { uid: owner.uid }, 'preprod-task-' + (i + 1), lead.record.id, now);
    queueTask(tx, task);
  }
  const writes = 30 * 3 + 12 * 2 + 1 + Number(!existingMember);
  assert.ok(writes <= 250);
  tx.set(manifest, { fixtureVersion: 1, leads: 30, tasks: 12, writes, seededAt: now });
  return { replay: false, leads: 30, tasks: 12, writes };
});
console.log(JSON.stringify(result));
