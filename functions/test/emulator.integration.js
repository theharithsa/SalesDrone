import {
  advanceLeadReset,
  guardLeadData,
  RESET_STATE,
} from '../src/lead-data-reset.js';
import { cleanupAttachments } from '../src/attachments.js';
import { firebaseFiles } from '../src/file-storage.js';
import { path } from '../src/policy.js';
import { observableStore } from '../src/observable-store.js';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import request from 'supertest';
import { firestoreStore } from '../src/store.js';
import { createApp } from '../src/app.js';
import { analyzeNotes } from '../src/automatic-reminders.js';
import { dispatchReminders } from '../src/reminders.js';
if (
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST
)
  throw Error('Run this test only through the Firebase Emulator Suite');
const projectId = 'demo-salesdrone';
const admin = initializeApp({ projectId });
const db = getFirestore(admin),
  auth = getAuth(admin);
async function signIn(email) {
  const b64 = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const token =
    b64({ alg: 'none', typ: 'JWT' }) +
    '.' +
    b64({
      sub: email,
      email,
      email_verified: true,
      name: email.split('@')[0],
      iss: 'https://accounts.google.com',
      aud: projectId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }) +
    '.';
  const res = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=fake`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postBody: 'id_token=' + token + '&providerId=google.com',
        requestUri: 'http://localhost',
        returnSecureToken: true,
      }),
    },
  );
  const data = await res.json();
  assert.ok(res.ok, JSON.stringify(data));
  return data.idToken;
}

test('actual Firestore transactions, Auth Google tokens, queries, rules and scheduled reminder persistence', async () => {
  await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  const store = observableStore(firestoreStore(db), () => ({
    enabled: true,
    span: async (_name, fn) => fn(),
    capture: () => ({
      actorId: 'system',
      requestId: 'emulator-attempt',
      operationId: 'emulator-operation',
      operation: 'emulator.integration',
      traceparent: null,
    }),
  }));
  let lastBriefingInput;
  const app = createApp({
    files: firebaseFiles(undefined, 'demo-salesdrone.firebasestorage.app'),
    store,
    verifyToken: (t) => auth.verifyIdToken(t, true),
    verifyPersonalTokenOwner: async (uid) => {
      const user = await auth.getUser(uid);
      return !user.disabled;
    },
    extractScore: async () => ({ signals: [] }),
    summarizeDashboard: async (c) => {
      lastBriefingInput = c;
      return {
        headline: 'Verified emulator brief',
        summary: 'Review your current reminders.',
        insights: [
          {
            title: 'Open reminders',
            detail: 'Review the outstanding work.',
            type: 'priority',
            taskIds: [],
            leadIds: [],
            facts: [{ key: 'pendingTasks', value: c.facts.pendingTasks }],
          },
        ],
      };
    },
  });
  const token = await signIn('spraghav@gmail.com');
  const outsider = await signIn('outsider@example.com');
  const req = (method, url, body, key) => {
    let r = request(app)
      [method]('/api/v1' + url)
      .set('Authorization', 'Bearer ' + token);
    if (key) r = r.set('Idempotency-Key', key);
    return body ? r.send(body) : r;
  };
  await req('get', '/me').expect(200);
  assert.equal(
    (await req('get', '/me').expect(200)).body.preferences.bookMode,
    false,
  );
  await req('patch', '/me', {
    timezone: 'Asia/Kolkata',
    appearance: 'light',
    bookMode: true,
    fontStyle: 'source-sans',
    displayScale: 90,
  }).expect(200);
  await req('patch', '/me', {
    timezone: 'Asia/Kolkata',
    appearance: 'dark',
  }).expect(200);
  assert.equal(
    (await req('get', '/me').expect(200)).body.preferences.bookMode,
    true,
  );
  const ownUser = (await auth.verifyIdToken(token)).uid;
  assert.equal((await db.doc('users/' + ownUser).get()).data().bookMode, true);
  assert.equal(
    (await db.doc('users/' + ownUser).get()).data().displayScale,
    90,
  );
  assert.equal(
    (await db.doc('users/' + ownUser).get()).data().fontStyle,
    'source-sans',
  );
  assert.equal(
    (await req('get', '/me').expect(200)).body.preferences.fontStyle,
    'source-sans',
  );
  const settingAudits = (
    await db
      .collection('workspaces/avinyatech/auditEvents')
      .where('action', '==', 'PATCH /me')
      .limit(20)
      .get()
  ).docs.map((d) => d.data());
  const appearanceAudit = settingAudits.find((a) =>
    a.settingsChanges?.some(
      (c) => c.section === 'appearance' && c.keys.includes('bookMode'),
    ),
  );
  assert.ok(appearanceAudit);
  assert.ok(
    appearanceAudit.settingsChanges.some((c) => c.keys.includes('fontStyle')),
  );
  const auditOutbox = (
    await db.collection('workspaces/avinyatech/telemetryOutbox').get()
  ).docs.map((d) => d.data());
  assert.ok(
    auditOutbox.some(
      (row) =>
        row.event.type ===
          'com.avinyatech.salesdrone.settings.audit.committed' &&
        row.event.data['audit.id'] === appearanceAudit.id,
    ),
  );
  assert.ok(!JSON.stringify(auditOutbox.map((r) => r.event)).includes(ownUser));

  await req('patch', '/me', {
    timezone: 'Asia/Kolkata',
    appearance: 'system',
    bookMode: false,
  }).expect(200);

  await request(app)
    .get('/api/v1/me')
    .set('Authorization', 'Bearer ' + outsider)
    .expect(200);
  await request(app)
    .get('/api/v1/leads')
    .set('Authorization', 'Bearer ' + outsider)
    .expect(403);
  const key = randomUUID();
  const input = {
    name: 'Emulator Customer',
    phone: '+12025550123',
    company: 'Example',
    location: 'Bengaluru',
    zone: 'Education',
    enquiryDate: '2026-10-24',
  };
  const lead = (await req('post', '/leads', input, key).expect(200)).body;
  const retry = (await req('post', '/leads', input, key).expect(200)).body;
  const filtered = (
    await req(
      'get',
      '/leads?filters=' +
        encodeURIComponent(
          JSON.stringify([
            { field: 'zone', op: 'equals', value: 'education' },
            { field: 'location', op: 'contains', value: 'bengaluru' },
          ]),
        ),
    ).expect(200)
  ).body;
  assert.equal(filtered.items.length, 1);
  assert.equal(lead.id, retry.id);
  assert.equal(
    (await req('get', '/leads?search=emulator&field=name').expect(200)).body
      .items.length,
    1,
  );
  await req(
    'post',
    '/leads/' + lead.id + '/activities',
    {
      type: 'call',
      outcome: 'Connected',
      notes: 'An emulator conversation',
      expectedVersion: 1,
      followUp: {
        title: 'Follow up',
        dueAt: new Date(Date.now() - 60000).toISOString(),
        timezone: 'Asia/Kolkata',
        kind: 'outreach',
      },
    },
    randomUUID(),
  ).expect(200);
  await req('get', '/summary').expect(200);
  const journey = (
    await req('get', '/leads/' + lead.id + '/journey').expect(200)
  ).body;
  assert.equal(journey.historyComplete, true);
  assert.ok(journey.items.length >= 1);
  assert.ok(
    (
      await db.collection('workspaces/avinyatech/telemetryOutbox').count().get()
    ).data().count > 0,
  );
  const score = (
    await req('post', '/leads/' + lead.id + '/score/refresh', {}).expect(200)
  ).body;
  assert.equal(score.status, 'Ready');
  const dashboard = (await req('get', '/dashboard').expect(200)).body;
  assert.ok(dashboard.coverage.totalLeads >= 1);
  assert.equal(dashboard.aiContext, undefined);
  assert.equal(
    (await req('get', '/dashboard').expect(200)).body.insightMode,
    'manual',
  );
  const controls = (await req('get', '/workspace-settings').expect(200)).body;
  assert.equal(controls.assignedOnly, true);
  const report = (
    await req('post', '/leads/export', {
      columns: ['name', 'phone'],
      filters: [],
      limit: 1,
    }).expect(200)
  ).body;
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].values.length, 2);
  await req('patch', '/workspace-settings', {
    expectedVersion: controls.version,
    exportsEnabled: false,
    assignedOnly: true,
  }).expect(200);
  await req('post', '/leads/export', { columns: ['name'] }).expect(403);
  await req('patch', '/workspace-settings', {
    expectedVersion: controls.version + 1,
    exportsEnabled: true,
    assignedOnly: true,
  }).expect(200);
  const memberToken = await signIn('report-exception@example.test');
  const memberUid = (await auth.verifyIdToken(memberToken)).uid;
  await store.run(async (tx) => {
    tx.set(path('members', memberUid), {
      id: memberUid, uid: memberUid, role: 'Viewer', scope: 'assigned',
      capabilities: ['leads:read'], active: true, version: 1,
    });
  });
  const memberReport = () => request(app).post('/api/v1/leads/export')
    .set('Authorization', 'Bearer ' + memberToken).send({ columns: ['name'] });
  const savedControls = (await req('patch', '/workspace-settings', {
    expectedVersion: controls.version + 2,
    exportsEnabled: true,
    assignedOnly: true,
    memberExportsEnabled: false,
  }).expect(200)).body;
  await memberReport().expect(403);
  await req('patch', '/members/' + memberUid, {
    expectedVersion: 1, role: 'Viewer', scope: 'assigned', active: true,
    leadExportAccess: 'allow',
  }).expect(200);
  assert.deepEqual((await memberReport().expect(200)).body.rows, []);
  await req('patch', '/members/' + memberUid, {
    expectedVersion: 2, role: 'Viewer', scope: 'assigned', active: true,
    leadExportAccess: 'deny',
  }).expect(200);
  await memberReport().expect(403);
  await req('patch', '/workspace-settings', {
    expectedVersion: savedControls.version,
    exportsEnabled: true,
    assignedOnly: true,
    memberExportsEnabled: true,
  }).expect(200);
  const aiPreferences = (await req('get', '/ai-settings').expect(200)).body;
  assert.equal(aiPreferences.usingDefault, true);
  await req('patch', '/ai-settings', {
    expectedVersion: aiPreferences.version,
    insightMode: 'automatic',
    instructions: 'Emulator guidance: focus on callbacks.',
  }).expect(200);
  assert.equal(
    (await req('get', '/ai-settings').expect(200)).body.usingDefault,
    false,
  );
  const { uid } = await auth.verifyIdToken(token);
  const budgetStartedAt = Date.now();
  const intelligence = (
    await req('post', '/dashboard/insights', {}).expect(200)
  ).body;
  assert.equal(intelligence.status, 'Ready');
  const budgets = await db.collection(`users/${uid}/aiBudgets`).get();
  assert.equal(budgets.size, 1);
  const budget = budgets.docs[0].data();
  assert.equal(budget.count, 1);
  assert.ok(budget.expiresAt.toMillis() >= budgetStartedAt + 86400000);
  assert.ok(budget.expiresAt.toMillis() <= Date.now() + 86400000);

  const deviceId = randomUUID();
  await req('post', '/devices', {
    id: deviceId,
    token: 'synthetic-device-token',
    label: 'Emulator test device',
  }).expect(200);
  try {
    await req('post', `/devices/${deviceId}/test`).expect(200);
    const cooldown = (await db.doc(path('pushTests', uid)).get()).data();
    assert.equal(cooldown.expiresAt.toMillis(), Date.parse(cooldown.at) + 86400000);
    await req('post', `/devices/${deviceId}/test`).expect(429);
  } finally {
    await req('delete', `/devices/${deviceId}`).expect(200);
  }
  assert.ok(
    !JSON.stringify(
      await store.query('workspaces/avinyatech/telemetryOutbox', {
        limit: 250,
      }),
    ).includes('Emulator guidance: focus on callbacks.'),
  );
  assert.equal(
    lastBriefingInput.workspaceGuidance,
    'Emulator guidance: focus on callbacks.',
  );
  assert.equal(
    (await req('get', '/scoring-settings').expect(200)).body.factors.length,
    14,
  );

  assert.equal(
    (await req('get', '/tasks?state=Pending').expect(200)).body.items.length,
    1,
  );
  await dispatchReminders({ store, send: async () => {} });
  assert.equal(
    (await req('get', '/notifications').expect(200)).body.items.filter(
      (n) => n.taskId,
    ).length,
    1,
  );
  const direct = await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents/workspaces/avinyatech/leads/${lead.id}`,
    { headers: { Authorization: 'Bearer ' + token } },
  );
  assert.equal(direct.status, 403);
  const i = (
    await req(
      'post',
      '/imports/preview',
      {
        filename: 'test.xlsx',
        sheet: 'Enquiries',
        rows: [
          {
            name: 'Imported one',
            phone: '+12025550124',
            enquiryDate: '24/10/2026',
          },
          {
            name: 'Imported duplicate',
            phone: '+12025550124',
            enquiryDate: '24/10/2026',
          },
        ],
      },
      randomUUID(),
    ).expect(200)
  ).body;
  const committed = (
    await req('post', '/imports/' + i.id + '/commit', {}, randomUUID()).expect(
      200,
    )
  ).body;
  assert.equal(committed.imported, 1);
  assert.equal(committed.duplicates, 1);
  const current = (await req('get', '/leads/' + lead.id).expect(200)).body;
  const note = (
    await req(
      'post',
      '/leads/' + lead.id + '/activities',
      {
        type: 'note',
        notes: 'Call tomorrow at 11 AM.',
        expectedVersion: current.version,
      },
      randomUUID(),
    ).expect(200)
  ).body.activity;
  await analyzeNotes({
    store,
    extract: async () => ({
      intent: 'schedule',
      action: 'call',
      evidence: 'Call tomorrow at 11 AM.',
      conditional: false,
      multiple: false,
      timing: 'days',
      days: 1,
      minutes: null,
      date: null,
      weekday: null,
      time: '11:00',
    }),
  });
  const analyzed = await store.get(
    'workspaces/avinyatech/activities/' + note.id,
  );
  assert.equal(analyzed.autoReminder.status, 'Scheduled');
  const autoTask = await store.get(
    'workspaces/avinyatech/tasks/' + analyzed.autoReminder.taskId,
  );
  assert.equal(autoTask.sourceActivityId, note.id);
  await req('patch', '/activities/' + note.id + '/automatic-reminder', {
    action: 'dismiss',
    expectedRevision: 1,
  }).expect(200);
  assert.equal(
    (await store.get('workspaces/avinyatech/tasks/' + autoTask.id)).state,
    'Cancelled',
  );
  const fresh = (
    await req(
      'post',
      '/leads',
      {
        ...input,
        phone: '+12025550129',
        initialDiscussion: 'Call in 5 minutes.',
      },
      randomUUID(),
    ).expect(200)
  ).body;
  await analyzeNotes({
    store,
    extract: async () => ({
      intent: 'schedule',
      action: 'call',
      evidence: 'Call in 5 minutes.',
      conditional: false,
      multiple: false,
      timing: 'minutes',
      minutes: 5,
      days: null,
      date: null,
      weekday: null,
      time: null,
    }),
  });
  const freshNotes = await store.query('workspaces/avinyatech/activities', {
    filters: [['leadId', '==', fresh.id]],
  });
  assert.equal(freshNotes[0].autoReminder.status, 'Scheduled');
  assert.equal(
    (
      await store.get(
        'workspaces/avinyatech/tasks/' + freshNotes[0].autoReminder.taskId,
      )
    ).sourceActivityId,
    freshNotes[0].id,
  );
  // Configuration retirement preserves lead data and cannot hide both contact inputs.
  const beforeVisibility = (await req('get', '/field-options').expect(200))
    .body;
  await req('patch', '/field-options', {
    expectedVersion: beforeVisibility.version,
    values: beforeVisibility.values,
    hiddenFields: ['phone', 'countryCode', 'stage'],
  }).expect(200);
  const visibility = (await req('get', '/field-options').expect(200)).body;
  assert.deepEqual(visibility.hiddenFields, ['phone', 'countryCode', 'stage']);
  await req('patch', '/field-options', {
    expectedVersion: visibility.version,
    values: visibility.values,
    hiddenFields: ['phone', 'email'],
  }).expect(400);
  await req('patch', '/field-options', {
    expectedVersion: visibility.version,
    values: visibility.values,
    hiddenFields: [],
  }).expect(200);
  const fields = (await req('get', '/field-options').expect(200)).body;
  fields.values.stage.push('Emulator custom stage');
  fields.values.outcome.push('Emulator custom outcome');
  await req('patch', '/field-options', {
    expectedVersion: fields.version,
    values: fields.values,
    labels: { name: 'Contact person', zone: 'Industry' },
  }).expect(200);
  assert.equal(
    (await req('get', '/field-options').expect(200)).body.labels.name,
    'Contact person',
  );
  const custom = (
    await req(
      'post',
      '/leads',
      { ...input, phone: '+12025550139', stage: 'Emulator custom stage' },
      randomUUID(),
    ).expect(200)
  ).body;
  await req(
    'post',
    '/leads/' + custom.id + '/activities',
    { type: 'call', outcome: 'Emulator custom outcome', expectedVersion: 1 },
    randomUUID(),
  ).expect(200);
  const generatedTask = await store.get(
    'workspaces/avinyatech/tasks/' + freshNotes[0].autoReminder.taskId,
  );
  const edit = (
    await req('patch', '/tasks/' + generatedTask.id, {
      expectedVersion: generatedTask.version,
      title: 'Edited emulator task',
      comment: 'Fictional scheduling reason',
      kind: 'administrative',
      dueAt: '2026-11-03T05:30:00Z',
    }).expect(200)
  ).body;
  assert.equal(edit.title, 'Edited emulator task');
  const listedTask=(await req('get','/tasks?state=Pending').expect(200)).body.items.find(t=>t.id===edit.id);
  assert.equal(listedTask.lead.id,generatedTask.leadId);
  assert.equal(listedTask.lead.name,(await store.get('workspaces/avinyatech/leads/'+generatedTask.leadId)).name);
  assert.deepEqual(Object.keys(listedTask.lead).sort(),['company','id','name']);
  await req('delete', '/tasks/' + edit.id, {
    expectedVersion: edit.version,
  }).expect(200);
  await req('get', '/tasks/' + edit.id).expect(404);
  assert.equal(
    (await store.get('workspaces/avinyatech/tasks/' + edit.id)).deleted,
    true,
  );
  assert.equal(
    (
      await store.get(
        'workspaces/avinyatech/reminderDeliveries/' +
          edit.id +
          '_' +
          edit.version,
      )
    ).status,
    'Cancelled',
  );
  const config = (await req('get', '/field-options').expect(200)).body;
  const definition = {
    id: 'cf_integration_product',
    label: 'Integration product',
    type: 'select',
    options: ['Drone', 'Camera'],
    required: true,
    deleted: false,
  };
  const customized = (
    await req('patch', '/field-options', {
      expectedVersion: config.version,
      values: config.values,
      customFields: [...config.customFields, definition],
      hiddenFields: ['company'],
    }).expect(200)
  ).body;
  const captured = (
    await req(
      'post',
      '/leads',
      {
        ...input,
        name: 'Custom integration lead',
        phone: '+12025550189',
        customFields: { cf_integration_product: 'Drone' },
      },
      randomUUID(),
    ).expect(200)
  ).body;
  assert.equal(captured.customFields.cf_integration_product, 'Drone');
  const customFiltered = (
    await req(
      'get',
      '/leads?filters=' +
        encodeURIComponent(
          JSON.stringify([
            { field: 'cf_integration_product', op: 'equals', value: 'Drone' },
          ]),
        ),
    ).expect(200)
  ).body;
  assert.ok(customFiltered.items.some((l) => l.id === captured.id));
  const patched = (
    await req('patch', '/leads/' + captured.id, {
      expectedVersion: captured.version,
      customFields: { cf_integration_product: 'Camera' },
    }).expect(200)
  ).body;
  await req('patch', '/field-options', {
    expectedVersion: customized.version,
    values: customized.values,
    customFields: customized.customFields.map((f) =>
      f.id === definition.id ? { ...f, deleted: true } : f,
    ),
  }).expect(200);
  assert.equal(
    (await req('get', '/leads/' + patched.id).expect(200)).body.customFields
      .cf_integration_product,
    'Camera',
  );
  const initialAlert = (
    await req('get', '/notifications').expect(200)
  ).body.items.find((n) => n.kind === 'lead_created' && n.leadId === lead.id);
  assert.ok(initialAlert);
  await req('patch', '/notifications/' + initialAlert.id, {
    read: true,
  }).expect(200);
  assert.ok(
    (
      await store.get(
        'users/' +
          (await auth.verifyIdToken(token)).uid +
          '/notifications/' +
          initialAlert.id,
      )
    ).readAt,
  );
  await req('patch', '/notifications/' + initialAlert.id, {
    read: false,
  }).expect(200);
  assert.equal(
    (
      await store.get(
        'users/' +
          (await auth.verifyIdToken(token)).uid +
          '/notifications/' +
          initialAlert.id,
      )
    ).readAt,
    null,
  );
  const secondToken = await signIn('theharithsa@gmail.com');
  const second = (method, url, body) => {
    const r = request(app)
      [method]('/api/v1' + url)
      .set('Authorization', 'Bearer ' + secondToken);
    return body ? r.send(body) : r;
  };
  const secondProfile = (await second('get', '/me').expect(200)).body;
  const latest = (await req('get', '/leads/' + lead.id).expect(200)).body;
  const assigned = (
    await req('patch', '/leads/' + lead.id + '/assignment', {
      expectedVersion: latest.version,
      assignedToUid: secondProfile.identity.uid,
    }).expect(200)
  ).body;
  const assignmentAlert = (
    await second('get', '/notifications').expect(200)
  ).body.items.find((n) => n.kind === 'lead_assigned' && n.leadId === lead.id);
  assert.ok(assignmentAlert);
  assert.ok(
    !(await req('get', '/notifications').expect(200)).body.items.some(
      (n) => n.id === initialAlert.id,
    ),
  );
  await req('patch', '/notifications/' + initialAlert.id, {
    read: true,
  }).expect(404);
  await second('patch', '/notifications/' + assignmentAlert.id, {
    read: true,
  }).expect(200);
  assert.equal(assigned.assignedToUid, secondProfile.identity.uid);
  const commentRows = Array.from({ length: 12 }, (_, i) => ({
    name: 'Comment integration ' + i,
    email: 'comment.integration.' + i + '@example.com',
    phone: '+1202555' + String(3000 + i),
    enquiryDate: '2026-10-24',
    importComments: Array.from({ length: 40 }, (_, j) => ({
      sourceColumn: 'History ' + j,
      sourceIndex: j,
      notes: 'Historical comment ' + i + '/' + j,
    })),
  }));
  let commentJob = (
    await req(
      'post',
      '/imports/preview',
      { filename: 'comment-columns.xlsx', sheet: 'Sheet1', rows: commentRows },
      randomUUID(),
    ).expect(200)
  ).body;
  commentJob = (
    await req(
      'post',
      '/imports/' + commentJob.id + '/commit',
      {},
      randomUUID(),
    ).expect(200)
  ).body;
  assert.equal(commentJob.offset, 11);
  commentJob = (
    await req(
      'post',
      '/imports/' + commentJob.id + '/commit',
      {},
      randomUUID(),
    ).expect(200)
  ).body;
  assert.equal(commentJob.imported, 12);
  const importedComments = await store.query(
    'workspaces/avinyatech/activities',
    { filters: [['importId', '==', commentJob.id]], limit: 1000 },
  );
  assert.equal(importedComments.length, 480);
  assert.ok(importedComments.every((a) => a.imported && a.occurredAt === null));
  await req(
    'post',
    '/imports/' + commentJob.id + '/commit',
    {},
    randomUUID(),
  ).expect(200);
  assert.equal(
    (
      await store.query('workspaces/avinyatech/activities', {
        filters: [['importId', '==', commentJob.id]],
        limit: 1000,
      })
    ).length,
    480,
  );
  // Real Firestore queries, transactions and Google Auth token issuance for PATs.
  const patResult = (
    await req('post', '/personal-access-tokens', {
      name: 'Synthetic emulator integration',
      scopes: ['leads:read', 'leads:create', 'leads:edit', 'leads:archive'],
      expiresInDays: 7,
    }).expect(200)
  ).body;
  const patCall = (method, url, body, key) => {
    let r = request(app)
      [method]('/api/v1' + url)
      .set('Authorization', 'Bearer ' + patResult.token);
    if (key) r = r.set('Idempotency-Key', key);
    return body === undefined ? r : r.send(body);
  };
  const patKey = randomUUID(),
    patInput = {
      name: 'Synthetic PAT enquiry',
      enquiryDate: '2026-10-25',
      phone: '+12025550169',
    };
  let patLead = (await patCall('post', '/leads', patInput, patKey).expect(200))
    .body;
  assert.equal(
    (await patCall('post', '/leads', patInput, patKey).expect(200)).body.id,
    patLead.id,
  );
  patLead = (
    await patCall('patch', '/leads/' + patLead.id, {
      expectedVersion: patLead.version,
      stage: 'Working',
    }).expect(200)
  ).body;
  await patCall('get', '/leads/' + patLead.id + '/journey').expect(200);
  await patCall('post', '/leads/' + patLead.id + '/archive').expect(400);
  await patCall('post', '/leads/' + patLead.id + '/archive', {
    expectedVersion: patLead.version,
  }).expect(200);
  const patPage = (
    await req('get', '/personal-access-tokens?limit=1').expect(200)
  ).body;
  assert.equal(patPage.items[0].id, patResult.personalAccessToken.id);
  assert.ok(!JSON.stringify(patPage).includes(patResult.token));
  await patCall('get', '/personal-access-tokens').expect(403);
  await req(
    'delete',
    '/personal-access-tokens/' + patResult.personalAccessToken.id,
    {},
  ).expect(200);
  await patCall('get', '/leads').expect(401);
  const accountToken = (
    await req('post', '/personal-access-tokens', {
      name: 'Synthetic disabled-owner test',
      scopes: ['tasks:read'],
      expiresInDays: 7,
    }).expect(200)
  ).body;
  const ownerUid = (await auth.verifyIdToken(token)).uid;
  await auth.updateUser(ownerUid, { disabled: true });
  await request(app)
    .get('/api/v1/tasks')
    .set('Authorization', 'Bearer ' + accountToken.token)
    .expect(401);
  await auth.updateUser(ownerUid, { disabled: false });
  await req(
    'delete',
    '/personal-access-tokens/' + accountToken.personalAccessToken.id,
    {},
  ).expect(200);
  const securityEvents = await store.query(path('telemetryOutbox'), {
    limit: 1000,
  });
  const safeEvents = JSON.stringify(securityEvents);
  assert.ok(!safeEvents.includes(patResult.token));
  const storedPAT = await store.get(
    path('personalAccessTokens', patResult.personalAccessToken.id),
  );
  assert.ok(!safeEvents.includes(storedPAT.tokenHash));
  assert.ok(!safeEvents.includes('Synthetic emulator integration'));
  assert.ok(
    securityEvents.some(
      (e) => e.event?.data?.['record.domain'] === 'personalAccessTokens',
    ),
  );
  const fileLead = (
    await req(
      'post',
      '/leads',
      {
        name: 'Fictional Storage fixture',
        phone: '+12025550999',
        enquiryDate: '2026-10-26',
      },
      randomUUID(),
    ).expect(200)
  ).body;
  const bulk = {
    items: [{ id: fileLead.id, expectedVersion: fileLead.version }],
    changes: { company: 'Synthetic batch fixture' },
  };
  await req('post', '/leads/batch/preview', bulk).expect(200);
  await req('post', '/leads/batch', bulk, randomUUID()).expect(200);
  assert.equal(
    (await store.get(path('leads', fileLead.id))).company,
    'Synthetic batch fixture',
  );
  const attachmentToken = (
    await req('post', '/personal-access-tokens', {
      name: 'Synthetic Storage API token',
      scopes: ['attachments:read', 'attachments:write'],
      expiresInDays: 7,
    }).expect(200)
  ).body.token;
  const fileCall = (method, url, body, key) => {
    let r = request(app)
      [method]('/api/v1' + url)
      .set('Authorization', 'Bearer ' + attachmentToken);
    if (key) r = r.set('Idempotency-Key', key);
    return body === undefined ? r : r.send(body);
  };
  const fileBytes = Buffer.from('Fictional emulator file contents');
  const base = '/leads/' + fileLead.id + '/attachments';
  const pending = (
    await fileCall(
      'post',
      base,
      {
        name: 'fictional.txt',
        contentType: 'text/plain',
        size: fileBytes.length,
      },
      randomUUID(),
    ).expect(200)
  ).body;
  const ready = (
    await fileCall('put', base + '/' + pending.id + '/content')
      .set('Content-Type', 'application/octet-stream')
      .send(fileBytes)
      .expect(200)
  ).body;
  assert.equal(ready.state, 'Ready');
  assert.deepEqual(
    (await fileCall('get', base + '/' + ready.id + '/content').expect(200))
      .body,
    fileBytes,
  );
  assert.equal(
    (await fileCall('get', base).expect(200)).body.items[0].id,
    ready.id,
  );
  const objectPath =
    'workspaces/avinyatech/lead-files/' + fileLead.id + '/' + ready.id;
  const directStorage = await fetch(
    'http://' +
      process.env.FIREBASE_STORAGE_EMULATOR_HOST +
      '/v0/b/demo-salesdrone.firebasestorage.app/o/' +
      encodeURIComponent(objectPath) +
      '?alt=media',
  );
  assert.equal(
    directStorage.status,
    403,
    'Direct unauthenticated Storage access must remain denied',
  );
  await fileCall('delete', base + '/' + ready.id, {
    expectedVersion: ready.version,
  }).expect(200);
  await req('get', base + '/' + ready.id + '/content').expect(404);
  const cleanup = await cleanupAttachments({
    store,
    files: firebaseFiles(undefined, 'demo-salesdrone.firebasestorage.app'),
    now: () => new Date(Date.now() + 7200000).toISOString(),
  });
  assert.equal(cleanup.removed, 1);
  assert.equal(
    (await store.get(path('leadAttachments', ready.id))).state,
    'Deleted',
  );
  await assert.rejects(() =>
    firebaseFiles(undefined, 'demo-salesdrone.firebasestorage.app').read(
      objectPath,
    ),
  );
});

test('archive Settings API persists dates and paginates with actual Firestore assigned-scope queries', async () => {
  const token = await signIn('archive-review@example.com');
  const identity = await auth.verifyIdToken(token);
  const store = firestoreStore(db);
  const app = createApp({
    store,
    verifyToken: (t) => auth.verifyIdToken(t, true),
  });
  const call = (method, url, body) => {
    const r = request(app)
      [method]('/api/v1' + url)
      .set('Authorization', 'Bearer ' + token);
    return body ? r.send(body) : r;
  };
  await store.run(async (tx) => {
    tx.set(path('members', identity.uid), {
      id: identity.uid,
      uid: identity.uid,
      role: 'SDR',
      scope: 'assigned',
      capabilities: ['leads:read', 'leads:edit'],
      active: true,
      version: 1,
    });
    for (let i = 0; i < 4; i++)
      tx.set(path('leads', 'archive_emulator_' + i), {
        id: 'archive_emulator_' + i,
        name: 'Synthetic archive ' + i,
        stage: 'New',
        archived: i !== 0,
        assignedToUid: i === 3 ? 'someone-else' : identity.uid,
        version: 1,
      });
    tx.set(path('tasks', 'archive_emulator_pending'), {
      id: 'archive_emulator_pending',
      kind: 'outreach',
      leadId: 'archive_emulator_0',
      recipientUid: identity.uid,
      state: 'Pending',
      version: 1,
    });
  });
  await call('post', '/leads/archive_emulator_0/archive', {
    expectedVersion: 1,
  }).expect(200);
  const archived = await store.get(path('leads', 'archive_emulator_0'));
  assert.ok(archived.archivedAt);
  assert.equal(archived.archived, true);
  assert.equal(
    (await store.get(path('tasks', 'archive_emulator_pending'))).state,
    'Cancelled',
  );
  const first = (await call('get', '/archived-leads?limit=2').expect(200)).body;
  assert.equal(first.items.length, 2);
  assert.ok(first.nextCursor);
  const second = (
    await call(
      'get',
      '/archived-leads?limit=2&cursor=' + encodeURIComponent(first.nextCursor),
    ).expect(200)
  ).body;
  assert.equal(second.items.length, 1);
  assert.equal(second.nextCursor, null);
  assert.ok(
    [...first.items, ...second.items].every(
      (l) => l.assignedToUid === identity.uid && l.archived,
    ),
  );
  await call('get', '/leads/archive_emulator_3').expect(404);
  await call('post','/leads/archive_emulator_3/restore',{expectedVersion:1}).expect(404);
  await call('post','/leads/archive_emulator_0/restore',{expectedVersion:1}).expect(409);
  await call('post','/leads/archive_emulator_0/restore',{expectedVersion:2}).expect(200);
  assert.equal((await store.get(path('tasks','archive_emulator_pending'))).state,'Cancelled');
  assert.equal((await store.get(path('leads','archive_emulator_0'))).archived,false);
});

test('reviewed imports persist source baselines and permission-filtered outcomes in actual Auth/Firestore transactions', async () => {
  const token = await signIn('spraghav@gmail.com'),
    workerToken = await signIn('import-collaborator@example.com');
  const identity = await auth.verifyIdToken(workerToken),
    store = firestoreStore(db);
  const app = createApp({
    store,
    verifyToken: (t) => auth.verifyIdToken(t, true),
  });
  const call = (method, url, body, credential = token) => {
    const r = request(app)
      [method]('/api/v1' + url)
      .set('Authorization', 'Bearer ' + credential)
      .set('Idempotency-Key', randomUUID());
    return body === undefined ? r : r.send(body);
  };
  await call('get', '/me').expect(200);
  await store.run((tx) =>
    tx.set(path('members', identity.uid), {
      id: identity.uid,
      uid: identity.uid,
      name: 'Import collaborator',
      active: true,
      role: 'SDR',
      scope: 'assigned',
      version: 1,
      capabilities: [
        'leads:read',
        'leads:create',
        'leads:edit',
        'imports:read',
        'imports:write',
        'imports:share',
      ],
    }),
  );
  const source = [1, 2].map((n) => ({
    name: 'Import emulator ' + n,
    phone: '+1202555800' + n,
    enquiryDate: '2026-10-20',
    company: 'Initial',
    importComments: [],
  }));
  const prepare = async (rows, extra = {}, credential = token) => {
    let j = (
      await call(
        'post',
        '/imports/preview',
        {
          filename: 'synthetic-emulator.csv',
          sheet: 'CSV',
          rows,
          reviewed: true,
          ...extra,
        },
        credential,
      ).expect(200)
    ).body;
    while (j.status === 'Preparing')
      j = (
        await call(
          'post',
          '/imports/' + j.id + '/plan',
          { expectedVersion: j.version },
          credential,
        ).expect(200)
      ).body;
    return j;
  };
  const approve = async (j, credential = token) => {
    while (j.reviewOffset < j.total)
      j = (
        await call(
          'post',
          '/imports/' + j.id + '/review',
          { expectedVersion: j.version },
          credential,
        ).expect(200)
      ).body;
    return j;
  };
  let first = await approve(await prepare(source));
  first = (
    await call('post', '/imports/' + first.id + '/commit', {
      expectedVersion: first.version,
    }).expect(200)
  ).body;
  assert.equal(first.imported, 2);
  const saved = await store.query(path('leads'), {
    filters: [['importId', '==', first.id]],
    limit: 10,
  });
  const mine = saved.find((l) => l.phone === source[0].phone);
  await call('patch', '/leads/' + mine.id + '/assignment', {
    assignedToUid: identity.uid,
    expectedVersion: mine.version,
  }).expect(200);
  const visible = (
    await call(
      'get',
      '/imports/' + first.id + '/rows?limit=1',
      undefined,
      workerToken,
    ).expect(200)
  ).body.items;
  assert.equal(
    visible.filter((r) => r.classification === 'Restricted').length,
    1,
  );
  assert.equal(
    visible.find((r) => r.classification === 'Restricted').row,
    undefined,
  );
  const revision = [
    { ...source[0], company: 'Updated by workbook' },
    source[1],
    { ...source[0], name: 'Import emulator 3', phone: '+12025558003' },
  ];
  let next = await approve(
    await prepare(
      revision,
      { duplicateMode: 'update', sourceImportId: first.id },
      workerToken,
    ),
    workerToken,
  );
  assert.equal(next.pending, 1);
  next = (
    await call(
      'patch',
      '/imports/' + next.id + '/rows/1',
      { expectedVersion: next.version, action: 'skip' },
      workerToken,
    ).expect(200)
  ).body;
  const [a, b] = await Promise.all([
    call(
      'post',
      '/imports/' + next.id + '/commit',
      { expectedVersion: next.version },
      workerToken,
    ),
    call(
      'post',
      '/imports/' + next.id + '/commit',
      { expectedVersion: next.version },
      token,
    ),
  ]);
  assert.ok([200, 409].includes(a.status));
  assert.ok([200, 409].includes(b.status));
  assert.ok(a.status === 200 || b.status === 200);
  next = (
    await call('get', '/imports/' + next.id, undefined, workerToken).expect(200)
  ).body;
  assert.equal(next.status, 'Completed');
  assert.equal(next.updated, 1);
  assert.equal(next.imported, 1);
  assert.equal(next.skipped, 1);
  assert.equal(
    (
      await store.query(path('leads'), {
        filters: [['importId', '==', next.id]],
        limit: 10,
      })
    )[0].assignedToUid,
    identity.uid,
  );
  assert.equal(
    (await store.get(path('leads', mine.id))).company,
    'Updated by workbook',
  );
  assert.equal(
    (await store.get(path('leads', saved.find((l) => l.id !== mine.id).id)))
      .company,
    'Initial',
  );
  assert.equal(
    (
      await store.query(path('importBaselines'), {
        filters: [['datasetId', '==', first.id]],
        limit: 20,
      })
    ).length,
    3,
  );
  do {
    first = (
      await call('delete', '/imports/' + first.id, {
        expectedVersion: first.version,
        confirmation: 'DELETE IMPORT DETAILS',
      }).expect(200)
    ).body;
  } while (first.status === 'Deleting');
  assert.equal(
    (
      await store.query(path('importBaselines'), {
        filters: [['datasetId', '==', first.id]],
        limit: 20,
      })
    ).length,
    0,
  );
  assert.ok(await store.get(path('leads', mine.id)));
  const maximum = (
    await call('post', '/imports/preview', {
      filename: 'synthetic-maximum.csv',
      sheet: 'CSV',
      reviewed: true,
      rows: Array.from({ length: 5000 }, (_, i) => ({
        name: 'Maximum ' + i,
        phone: '+1202' + String(5000000 + i),
        enquiryDate: '2026-10-20',
      })),
    }).expect(200)
  ).body;
  assert.equal(maximum.total, 5000);
  assert.equal(
    await store.count(path('importChunks'), [['importId', '==', maximum.id]]),
    455,
  );
});

test('lead reset uses real Auth/Firestore/Storage, tombstones retries and preserves workspace configuration', async () => {
  let at = '2026-10-29T11:00:00.000Z';
  const raw = firestoreStore(db),
    store = guardLeadData(
      observableStore(raw, () => ({
        enabled: true,
        span: async (_n, fn) => fn(),
        capture: () => ({
          actorId: 'system',
          operation: 'reset.integration',
          operationId: 'reset-emulator',
          requestId: 'reset-emulator',
          traceparent: null,
        }),
      })),
    );
  const files = firebaseFiles(undefined, 'demo-salesdrone.firebasestorage.app');
  const token = await signIn('spraghav@gmail.com');
  const app = createApp({
    store,
    files,
    now: () => at,
    verifyToken: (t) => auth.verifyIdToken(t, true),
  });
  const call = (method, url, body, key) => {
    const r = request(app)
      [method]('/api/v1' + url)
      .set('Authorization', 'Bearer ' + token);
    if (key) r.set('Idempotency-Key', key);
    return body ? r.send(body) : r;
  };
  await call('get', '/me').expect(200);
  const settingsBefore = await raw.get(path('settings', 'workspace'));
  const owner = (await auth.verifyIdToken(token)).uid;
  const objectPath = 'workspaces/avinyatech/lead-files/reset-emulator/file';
  await files.save(
    objectPath,
    Buffer.from('synthetic reset fixture'),
    'text/plain',
    'fixture',
  );
  await raw.run(async (tx) => {
    tx.set(path('leads', 'reset-emulator'), {
      id: 'reset-emulator',
      name: 'Synthetic reset fixture',
      archived: false,
      version: 1,
    });
    tx.set(path('leadAttachments', 'file'), {
      id: 'file',
      leadId: 'reset-emulator',
      objectPath,
    });
    tx.set(`users/${owner}/insights/reset-test`, {
      summary: 'Synthetic reset fixture',
    });
    tx.set(`users/${owner}/notifications/reset-test`, {
      id: 'reset-test',
      leadId: 'reset-emulator',
    });
  });
  const p = (await call('post', '/lead-data-reset/preview', {}).expect(200))
    .body;
  const input = { previewId: p.previewId, confirmation: 'DELETE ALL LEADS' },
    key = randomUUID();
  await call('post', '/lead-data-reset', input, key).expect(200);
  await assert.rejects(
    store.run(async (tx) =>
      tx.set(path('leads', 'late-reset-emulator'), {
        id: 'late-reset-emulator',
      }),
    ),
    { code: 'LEAD_DATA_RESET' },
  );
  await call(
    'post',
    '/leads',
    { name: 'Synthetic denied', phone: '5555555555' },
    randomUUID(),
  ).expect(503);
  at = '2026-10-29T11:06:00.000Z';
  for (let i = 0; i < 200; i++) {
    const result = await advanceLeadReset({
      store,
      files,
      now: () => at,
      batches: 4,
    });
    assert.equal(result.blocked, 0);
    if (!result.active) break;
  }
  const state = await raw.get(RESET_STATE);
  assert.equal(state.active, false);
  assert.equal(await raw.count(path('leads')), 0);
  assert.deepEqual(
    await files.list('workspaces/avinyatech/lead-files/', 30),
    [],
  );
  assert.equal(await raw.get(`users/${owner}/insights/reset-test`), null);
  assert.equal(await raw.get(`users/${owner}/notifications/reset-test`), null);
  assert.deepEqual(
    await raw.get(path('settings', 'workspace')),
    settingsBefore,
  );
  assert.equal((await raw.get(path('members', owner))).role, 'Admin');
  assert.ok(
    (await raw.query(path('telemetryOutbox'), { limit: 1000 })).some(
      (row) => row.event.data['records.reset_completed'] === 1,
    ),
  );
  await store.run(async (tx) =>
    tx.set(path('leads', 'fresh-reset-emulator'), {
      id: 'fresh-reset-emulator',
    }),
  );
  await call('post', '/lead-data-reset', input, key).expect(200);
  assert.ok(await raw.get(path('leads', 'fresh-reset-emulator')));
});

after(() => db.terminate());

test('real Firestore stores TTL timestamps and batch reads preserve missing positions',async()=>{
 const {rateLimitExpiry,backfillRateLimitExpiry}=await import('../src/rate-limit.js');
 const {ROOT}=await import('../src/policy.js');const store=firestoreStore(db);
 const id='ttl-'+randomUUID(),legacy='legacy-'+id;
 await store.run(async tx=>{
  tx.set(path('rateLimits',id),{id,count:2,expiresAt:rateLimitExpiry('2026-10-30T00:00:00Z')});
  tx.set(path('rateLimits',legacy),{id:legacy,count:3,expiresAt:'2026-10-29T00:00:00Z'});
 });
 const [row,missing]=await store.getAll([path('rateLimits',id),path('rateLimits','missing-'+id)]);
 assert.equal(row.expiresAt.toDate().toISOString(),'2026-10-31T00:00:00.000Z');assert.equal(missing,null);
 // A fresh maintenance cursor exercises the actual transactional read/write adapter.
 await store.run(async tx=>tx.delete(`${ROOT}/maintenance/rateLimitExpiry`));
 let result;do{result=await backfillRateLimitExpiry(store,ROOT)}while(!result.complete);
 assert.equal((await store.get(path('rateLimits',legacy))).expiresAt.toDate().toISOString(),'2026-10-29T00:00:00.000Z');
 await store.run(async tx=>{tx.delete(path('rateLimits',id));tx.delete(path('rateLimits',legacy));});
});

test('Exact match uses merged raw equality indexes and document-ID cursors in real Firestore',async()=>{
 const {documentKey}=await import('../src/store.js');const store=firestoreStore(db),prefix='exact-'+randomUUID();
 const ids=[prefix+'a',prefix+'b'];
 await store.run(async tx=>{for(const id of ids)tx.set(path('leads',id),{id:'business-'+id,source:'Website',stage:'New',archived:false,assignedToUid:prefix,customFields:{cf_product:'Retail'}})});
 const filters=[['archived','==',false],['assignedToUid','==',prefix],['source','==','Website'],['stage','==','New'],['customFields.cf_product','==','Retail']];
 const first=await store.query(path('leads'),{filters,order:'__name__',direction:'desc',limit:1});assert.equal(documentKey(first[0]),ids[1]);
 const next=await store.query(path('leads'),{filters,order:'__name__',direction:'desc',after:[documentKey(first[0])],limit:1});assert.equal(documentKey(next[0]),ids[0]);assert.ok(!JSON.stringify(first).includes('document-key'));
 assert.equal((await store.query(path('leads'),{filters:filters.map(f=>f[0]==='source'?['source','==','website']:f),order:'__name__'})).length,0);
 await store.run(async tx=>{for(const id of ids)tx.delete(path('leads',id))});
});

test('Admin-created import fields persist through replay/update and personal dashboard grouping in real Auth/Firestore',async()=>{
 const store=firestoreStore(db),token=await signIn('spraghav@gmail.com'),memberToken=await signIn('new-fields-member@example.test');
 const identity=await auth.verifyIdToken(memberToken),app=createApp({store,verifyToken:t=>auth.verifyIdToken(t,true)});
 const call=(method,url,body,credential=token)=>{const r=request(app)[method]('/api/v1'+url).set('Authorization','Bearer '+credential).set('Idempotency-Key',randomUUID());return body===undefined?r:r.send(body)};
 await call('get','/me').expect(200);
 const {PRESETS}=await import('../src/contracts.js');await store.run(tx=>tx.set(path('members',identity.uid),{id:identity.uid,uid:identity.uid,email:identity.email,role:'SDR',scope:'assigned',active:true,version:1,capabilities:PRESETS.SDR}));
 let config=(await call('get','/field-options').expect(200)).body;const fieldId='cf_import_'+randomUUID().replaceAll('-','');
 const schema={expectedVersion:config.version,values:config.values,hiddenFields:[...new Set([...config.hiddenFields,'stage'])],customFields:[...config.customFields,{id:fieldId,label:'Synthetic product '+randomUUID().slice(0,8),type:'text',options:[],required:false,deleted:false}]};
 await call('patch','/field-options',schema,memberToken).expect(403);config=(await call('patch','/field-options',schema).expect(200)).body;await call('patch','/field-options',schema).expect(409);
 const data={name:'Synthetic new field import',phone:'+12025559876',enquiryDate:'2026-10-31',legacyStatus:'Awaiting drawings',[fieldId]:'0012',importComments:[]};
 async function prepare(rows,extra={}){
 let j=(await call('post','/imports/preview',{filename:'synthetic-fields.csv',sheet:'CSV',rows,reviewed:true,dateOrder:'DMY',statusMap:{},statusField:'legacyStatus',...extra}).expect(200)).body;
 while(j.status==='Preparing')j=(await call('post','/imports/'+j.id+'/plan',{expectedVersion:j.version}).expect(200)).body;
 while(j.reviewOffset<j.total)j=(await call('post','/imports/'+j.id+'/review',{expectedVersion:j.version}).expect(200)).body;
 return j;
 }
 let job=await prepare([data]);const sourceRows=(await call('get','/imports/'+job.id+'/rows').expect(200)).body.items;assert.equal(sourceRows[0].sourceStatus,'Awaiting drawings');job=(await call('post','/imports/'+job.id+'/commit',{expectedVersion:job.version}).expect(200)).body;assert.equal(job.imported,1);
 const lead=(await store.query(path('leads'),{filters:[['importId','==',job.id]],limit:5}))[0];assert.equal(lead.customFields[fieldId],'0012');assert.equal(lead.legacyStatus,'Awaiting drawings');assert.equal(lead.stage,'New');
 await call('post','/imports/'+job.id+'/commit',{expectedVersion:job.version}).expect(200);
 await call('patch','/leads/'+lead.id,{expectedVersion:lead.version,stage:'Won'}).expect(200);
 let update=await prepare([{...data,leadId:lead.id,[fieldId]:'0034'}],{duplicateMode:'update',sourceImportId:job.id});update=(await call('post','/imports/'+update.id+'/commit',{expectedVersion:update.version}).expect(200)).body;assert.equal(update.updated,1);assert.equal((await store.get(path('leads',lead.id))).customFields[fieldId],'0034');assert.equal((await store.get(path('leads',lead.id))).stage,'Won');
 await call('patch','/me',{dashboardField:fieldId}).expect(200);const dashboard=(await call('get','/dashboard').expect(200)).body;assert.equal(dashboard.visualization.field,fieldId);assert.ok(dashboard.visualization.groups.some(g=>g.label==='0034'&&g.value===1));
 await call('patch','/me',{dashboardField:'legacyStatus'},memberToken).expect(200);assert.equal((await call('get','/me',undefined,memberToken).expect(200)).body.preferences.dashboardField,'legacyStatus');
});

test('shared contact stage edits and hidden stage analytics persist in actual Firestore', async () => {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`, {method:'DELETE'});
  const store=firestoreStore(db),token=await signIn('spraghav@gmail.com');
  const app=createApp({store,verifyToken:t=>auth.verifyIdToken(t,true)});
  const call=(method,url,body)=>{const r=request(app)[method]('/api/v1'+url).set('Authorization','Bearer '+token).set('Idempotency-Key',randomUUID());return body===undefined?r:r.send(body)};
  await call('get','/me').expect(200);
  const data={name:'Synthetic shared contact',phone:'+12025550777',enquiryDate:'2026-10-31'};
  const a=(await call('post','/leads',data).expect(200)).body;
  const b=(await call('post','/leads',{...data,name:'Synthetic separate enquiry',allowDuplicate:true}).expect(200)).body;
  const c=(await call('post','/leads',{...data,name:'Synthetic other contact',phone:'+12025550888'}).expect(200)).body;
  const config=(await call('get','/field-options').expect(200)).body;
  const customValues={...config.values,stage:['New','Intro','Samples Given']};
  const configured=(await call('patch','/field-options',{expectedVersion:config.version,values:customValues,hiddenFields:['stage']}).expect(200)).body;
  const changed=(await call('patch','/leads/'+b.id,{expectedVersion:b.version,stage:'Samples Given'}).expect(200)).body;
  assert.equal((await store.get(path('leads',b.id))).stage,'Samples Given');
  await call('patch','/leads/'+b.id,{expectedVersion:changed.version,phone:c.phone}).expect(409);
  const {contactKeys}=await import('../src/leads.js');
  assert.deepEqual(new Set((await store.get(path('dedupeKeys',contactKeys(a)[0]))).leadIds),new Set([a.id,b.id]));
  await call('patch','/me',{dashboardField:'stage'}).expect(200);
  const dashboard=(await call('get','/dashboard').expect(200)).body;
  assert.equal(dashboard.visualization.field,'stage');
  assert.equal(dashboard.visualization.groups.find(g=>g.label==='Samples Given').value,1);
  assert.deepEqual(dashboard.visualization.groups.map(g=>g.label),customValues.stage);
  await call('patch','/field-options',{expectedVersion:configured.version,values:{...customValues,stage:['New','Intro','Review']}}).expect(200);
  await call('patch','/leads/'+b.id,{expectedVersion:changed.version,stage:'Review'}).expect(200);
  const refreshed=(await call('get','/dashboard').expect(200)).body;
  assert.equal(refreshed.visualization.groups.find(g=>g.label==='Review').value,1);
  assert.ok(!refreshed.visualization.groups.some(g=>g.label==='Samples Given'));
  assert.equal((await store.get(path('leads',b.id))).stage,'Review');
});

test('Lead research uses real scoped Firestore pages, private API history, source invalidation and ACL-prefiltered vectors',async()=>{
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`,{method:'DELETE'});
  const {researchStore}=await import('../src/lead-research-store.js');
  const {stepHygiene}=await import('../src/lead-hygiene.js');
  const {processIndexJob,retrieveEvidence}=await import('../src/lead-research-index.js');
  const {researchMember,researchAccessKey}=await import('../src/lead-research-access.js');
  const store=guardLeadData(researchStore(firestoreStore(db)));
  const app=createApp({store,verifyToken:token=>auth.verifyIdToken(token),now:()=> '2026-10-31T10:00:00.000Z'});
  const adminToken=await signIn('spraghav@gmail.com'),repToken=await signIn('research-rep@example.test');
  const rep=(await auth.verifyIdToken(repToken)).uid;
  const call=(token,method,url,body,key)=>{let r=request(app)[method]('/api/v1'+url).set('Authorization','Bearer '+token);if(key)r=r.set('Idempotency-Key',key);return body?r.send(body):r;};
  await call(adminToken,'get','/me').expect(200);
  await store.run(async tx=>{
    tx.set(path('members',rep),{id:rep,uid:rep,email:'research-rep@example.test',role:'SDR',scope:'assigned',active:true,version:1,capabilities:['leads:read','hygiene:read','hygiene:run','assistant:query','tasks:read']});
    tx.set(path('settings','leadResearch'),{version:1,indexingEnabled:true,convertedStages:['Won'],failedStages:['Disqualified'],archiveReviewStages:[],inactivityDays:null,timezone:'Asia/Kolkata'});
    for(let i=0;i<55;i++){const id='research-'+String(i).padStart(3,'0');tx.set(path('leads',id),{id,name:'Fictional research enquiry',company:'Fictional supplier',phone:'9876543210',countryCode:'+91',email:'',enquiryDate:'2026-01-01',stage:'New',assignedToUid:i<52?rep:'outside',archived:false,version:1,comments:'Fictional material pricing discussion.'});}
    const {hash}=await import('../src/policy.js');
    const key=hash('phone:+919876543210');
    tx.set(path('dedupeKeys',key),{id:key,leadIds:Array.from({length:55},(_,i)=>'research-'+String(i).padStart(3,'0'))});
  });
  const scan=(await call(repToken,'post','/lead-hygiene/scans',{},randomUUID()).expect(200)).body;
  for(let i=0;i<6;i++)await stepHygiene({store,id:scan.id});
  const report=(await call(repToken,'get','/lead-hygiene/scans/'+scan.id).expect(200)).body;
  assert.equal(report.status,'Completed');assert.equal(report.scanned,52);
  const findings=(await call(repToken,'get','/lead-hygiene/scans/'+scan.id+'/findings').expect(200)).body;
  assert.ok(findings.items.every(f=>!f.leadIds.some(id=>Number(id.split('-')[1])>=52)));
  await call(adminToken,'get','/lead-hygiene/scans/'+scan.id).expect(404);
  const embed=async input=>{const v=[1,...Array(767).fill(0)];return Array.isArray(input)?input.map(()=>v):v;};
  for(const id of ['research-000','research-054']){
    const {hash}=await import('../src/policy.js');
    const job=await store.get(path('researchIndexJobs',hash('leads:'+id)));
    await processIndexJob({store,job,embed});
  }
  const actor=await researchMember(store,{uid:rep},['assistant:query']);
  const sources=await retrieveEvidence({store,identity:{uid:rep},access:researchAccessKey(actor),question:'material pricing',embed});
  assert.equal(sources.length,1);assert.equal(sources[0].leadId,'research-000');
  const stored=(await db.collection(path('researchChunks')).get()).docs[0].data();
  assert.equal(stored.embedding.toArray().length,768);
  await store.run(async tx=>{const lead=await tx.get(path('leads','research-000'));tx.set(path('leads','research-000'),{...lead,assignedToUid:'outside',version:2});});
  assert.equal((await call(repToken,'get','/lead-hygiene/scans/'+scan.id).expect(200)).body.status,'Stale');
  assert.deepEqual(await retrieveEvidence({store,identity:{uid:rep},access:researchAccessKey(actor),question:'material pricing',embed}),[]);
  const chat=(await call(repToken,'post','/lead-assistant/conversations',{},randomUUID()).expect(200)).body;
  await call(adminToken,'get','/lead-assistant/conversations/'+chat.id+'/messages').expect(404);
  const {processAssistantRequest}=await import('../src/lead-assistant.js');
  await store.run(async tx=>{for(const [id,recipientUid] of [['research-task',rep],['private-other','outside']])tx.set(path('tasks',id),{id,recipientUid,leadId:'research-001',kind:'outreach',state:'Pending',version:1,dueAt:'2026-11-03T10:00:00Z'});});
  const pending=(await call(repToken,'post','/lead-assistant/conversations/'+chat.id+'/questions',{question:'List leads to call next week'},randomUUID()).expect(200)).body;
  const provider={plan:async()=>({tool:'find_own_followups',filters:[],groupBy:'',outcome:'none',period:{unit:'week',offset:1,startDate:'',endDate:''},dateField:''})};
  for(let i=0;i<3;i++)await processAssistantRequest({store,id:pending.id,provider});
  const answer=(await call(repToken,'get','/lead-assistant/requests/'+pending.id).expect(200)).body;
  assert.equal(answer.answer.count,1);
  const matches=(await call(repToken,'get','/lead-assistant/requests/'+pending.id+'/leads?limit=1').expect(200)).body;
  assert.equal(matches.items[0].id,'research-001');assert.equal(matches.items[0].phone,undefined);
  await call(repToken,'get','/lead-assistant/conversations/'+chat.id+'/messages').expect(200);
  await store.run(async tx=>{const lead=await tx.get(path('leads','research-001'));tx.set(path('leads','research-001'),{...lead,stage:'Won',version:2});});
  const compound=(await call(repToken,'post','/lead-assistant/conversations/'+chat.id+'/questions',{question:'How many leads do I have and which are closed?'},randomUUID()).expect(200)).body;
  const basePlan={filters:[],groupBy:'',outcome:'none',period:{unit:'none',offset:0,startDate:'',endDate:''},dateField:''};
  for(let i=0;i<8;i++)await processAssistantRequest({store,id:compound.id,provider:{plan:async()=>({steps:[{...basePlan,tool:'aggregate_leads'},{...basePlan,tool:'find_leads',outcome:'converted'}]})}});
  const compoundAnswer=(await call(repToken,'get','/lead-assistant/requests/'+compound.id).expect(200)).body;
  assert.deepEqual(compoundAnswer.answer.parts.map(p=>p.count),[51,1]);
  const closed=(await call(repToken,'get','/lead-assistant/requests/'+compound.id+'/leads?part=1').expect(200)).body;assert.equal(closed.items[0].id,'research-001');
  await call(repToken,'get','/lead-assistant/requests/'+compound.id+'/leads?part=0').expect(409);
  const stop=(await call(repToken,'post','/lead-assistant/conversations/'+chat.id+'/questions',{question:'Another lead question'},randomUUID()).expect(200)).body;
  await call(repToken,'post','/lead-assistant/requests/'+stop.id+'/cancel',{expectedVersion:1}).expect(200);
  await processAssistantRequest({store,id:stop.id,provider});
  assert.equal((await call(repToken,'get','/lead-assistant/requests/'+stop.id).expect(200)).body.status,'Cancelled');
  await call(repToken,'delete','/lead-assistant/conversations/'+chat.id,{expectedVersion:(await store.get(path('assistantConversations',chat.id))).version}).expect(200);
  await call(repToken,'get','/lead-assistant/conversations/'+chat.id+'/messages').expect(404);
});

test('correction authorship is enforced with real Auth and atomic Firestore revision history',async(t)=>{
 const store=firestoreStore(db),settingsPath='workspaces/avinyatech/settings/workspace',prior=await store.get(settingsPath);
 t.after(async()=>{await store.run(async tx=>{if(prior)tx.set(settingsPath,prior);else tx.delete(settingsPath);});});
 const identities=[];for(const email of ['correction-author@example.com','correction-peer@example.com','correction-admin@example.com']){const token=await signIn(email);identities.push({token,identity:await auth.verifyIdToken(token)});}
 const app=createApp({store,verifyToken:token=>auth.verifyIdToken(token,true)});
 const call=(who,method,url,body)=>{let r=request(app)[method]('/api/v1'+url).set('Authorization','Bearer '+identities[who].token).set('Idempotency-Key',randomUUID());return body?r.send(body):r;};
 await store.run(async tx=>{
  tx.set(settingsPath,{version:(prior?.version||1)+1,exportsEnabled:true,assignedOnly:false});
  for(const [i,{identity}]of identities.entries())tx.set(path('members',identity.uid),{id:identity.uid,uid:identity.uid,active:true,role:i===2?'Admin':'SDR',scope:'all',capabilities:['leads:read','leads:edit','activities:write'],version:1});
  tx.set(path('leads','correction-lead'),{id:'correction-lead',name:'Synthetic correction',stage:'New',assignedToUid:identities[0].identity.uid,archived:false,version:1});
 });
 const a=(await call(0,'post','/leads/correction-lead/activities',{type:'note',notes:'Synthetic original',expectedVersion:1}).expect(200)).body.activity;
 const input={type:'note',notes:'Synthetic correction',expectedRevision:1};
 const denial=await call(1,'post','/activities/'+a.id+'/corrections',input).expect(403);assert.equal(denial.body.error.code,'ACTIVITY_AUTHOR');
 await call(0,'post','/activities/'+a.id+'/corrections',input).expect(200);
 await call(2,'post','/activities/'+a.id+'/corrections',{...input,expectedRevision:2}).expect(200);
 const revisions=await store.query(path('activityRevisions'),{filters:[['activityId','==',a.id]],limit:10});assert.equal(revisions.length,2);
});

test('shared lead work and business-query results persist with actual Auth, Firestore versions and source guards',async()=>{
 const {researchStore}=await import('../src/lead-research-store.js');
 const {processAssistantRequest}=await import('../src/lead-assistant.js');
 const store=researchStore(firestoreStore(db)),at='2026-11-02T10:00:00Z';
 const ownerToken=await signIn('shared-owner@example.com'),editorToken=await signIn('shared-editor@example.com');
 const owner=(await auth.verifyIdToken(ownerToken)).uid,editor=(await auth.verifyIdToken(editorToken)).uid;
 const leadId='shared-emulator-lead',taskId='shared-emulator-task';
 await store.run(async tx=>{
  tx.set(path('settings','workspace'),{version:7,assignedOnly:false,exportsEnabled:true});
  for(const [uid,name,caps]of [[owner,'Task owner',['leads:read','tasks:write']],[editor,'Lead editor',['leads:read','leads:edit','assistant:query']]])tx.set(path('members',uid),{id:uid,uid,name,active:true,role:'SDR',scope:'all',version:1,capabilities:caps});
  tx.set(path('leads',leadId),{id:leadId,name:'Fictional shared lead',company:'Synthetic',archived:false,assignedToUid:editor,version:1});
  tx.set(path('tasks',taskId),{id:taskId,leadId,recipientUid:owner,creatorUid:owner,title:'Shared emulator work marker',state:'Pending',kind:'administrative',dueAt:'2030-01-01T10:00:00Z',timezone:'Asia/Kolkata',version:1});
 });
 const app=createApp({store,now:()=>at,verifyToken:t=>auth.verifyIdToken(t,true)});
 const req=(method,url,body,key=randomUUID())=>{const r=request(app)[method]('/api/v1'+url).set('Authorization','Bearer '+editorToken).set('Idempotency-Key',key);return body?r.send(body):r;};
 const rows=(await req('get','/leads/'+leadId+'/tasks?state=Pending').expect(200)).body.items;
 assert.equal(rows[0].responsible.name,'Task owner');assert.equal(rows[0].canManage,true);
 const sharedPage=(await req('get','/tasks?view=accessible&state=Pending&limit=100').expect(200)).body;const shared=sharedPage.items.find(t=>t.id===taskId);assert.equal(shared.responsible.name,'Task owner');assert.equal(shared.lead.name,'Fictional shared lead');assert.equal(shared.canManage,true);assert.equal(shared.canEditOwn,false);
 const key=randomUUID(),body={expectedVersion:1,state:'Completed',comment:'Synthetic private task comment'};
 const completed=(await req('patch','/leads/'+leadId+'/tasks/'+taskId,body,key).expect(200)).body;
 assert.equal(completed.recipientUid,owner);assert.equal(completed.version,2);
 assert.equal((await req('patch','/leads/'+leadId+'/tasks/'+taskId,body,key).expect(200)).body.version,2);
 const chat=(await req('post','/lead-assistant/conversations',{}).expect(200)).body;
 const question=(await req('post','/lead-assistant/conversations/'+chat.id+'/questions',{question:'List tasks titled Shared emulator work marker'}).expect(200)).body;
 const plan={tool:'query_business_records',dataset:'tasks',filters:[{field:'title',operator:'equals',value:'Shared emulator work marker'}],outcome:'none',groupBy:'state',dateField:'',period:{unit:'none',offset:0,startDate:'',endDate:''}};
 for(let i=0;i<20;i++){if((await store.get(path('assistantRequests',question.id))).status!=='Pending')break;await processAssistantRequest({store,id:question.id,provider:{plan:async()=>({steps:[plan]})},now:()=>at});}
 const result=(await req('get','/lead-assistant/requests/'+question.id).expect(200)).body;
 assert.equal(result.answer.count,1);assert.equal(result.answer.groups.Completed,1);assert.equal(result.after,null);
 const records=(await req('get','/lead-assistant/requests/'+question.id+'/leads?part=0').expect(200)).body.items;
 assert.equal(records[0].href,'/leads/'+leadId);
});

test('Admin Team statistics and assignee filters use actual Auth and Firestore with private-source exclusion',async()=>{
 const store=firestoreStore(db),at='2026-11-03T10:00:00.000Z';
 const adminToken=await signIn('team-admin@example.com'),repToken=await signIn('team-rep@example.com');
 const adminUid=(await auth.verifyIdToken(adminToken)).uid,repUid=(await auth.verifyIdToken(repToken)).uid;
 await store.run(async tx=>{
  tx.set(path('settings','workspace'),{version:8,assignedOnly:true,exportsEnabled:true});
  for(const [uid,role,caps]of [[adminUid,'Admin',['leads:read','members:write']],[repUid,'SDR',['leads:read']]])tx.set(path('members',uid),{id:uid,uid,name:'Synthetic Team '+role,role,scope:'all',active:true,version:1,capabilities:caps});
  tx.set(path('leads','team-lead'),{id:'team-lead',name:'Synthetic team lead',assignedToUid:repUid,stage:'Custom stage',archived:false});
  tx.set(path('activities','team-note'),{id:'team-note',leadId:'team-lead',actorUid:repUid,type:'note',notes:'Synthetic authored comment',createdAt:at,revision:1});
  tx.set(path('activities','team-import'),{id:'team-import',leadId:'team-lead',actorUid:repUid,type:'note',notes:'Synthetic imported comment',createdAt:at,imported:true});
  tx.set(path('tasks','team-private'),{id:'team-private',leadId:null,recipientUid:repUid,state:'Pending',dueAt:at,title:'Synthetic private reminder'});
 });
 const app=createApp({store,now:()=>at,verifyToken:t=>auth.verifyIdToken(t,true)});
 const get=(url,token=adminToken)=>request(app).get('/api/v1'+url).set('Authorization','Bearer '+token);
 const result=(await get('/team?days=7').expect(200)).body,m=result.members.find(m=>m.id===repUid);assert.equal(m.comments,1);assert.equal(m.leadsWorked,1);assert.equal(m.assigned,1);assert.equal(m.pending,0);
 const activities=(await get('/team/members/'+repUid+'/activities?days=7').expect(200)).body.items;assert.equal(activities.length,1);assert.equal(activities[0].notes,'Synthetic authored comment');
 const range=new URLSearchParams({from:'2026-11-03T09:00:00.000Z',to:'2026-11-03T11:00:00.000Z'});
 const custom=(await get('/team/members/'+repUid+'/activities?'+range).expect(200)).body.items;
 assert.deepEqual(custom.map(a=>a.id),['team-note']);
 const search=(await get('/leads?field=all&search=authored+comment',repToken).expect(200)).body;
 assert.ok(search.items.some(l=>l.id==='team-lead'));
 const report=(await request(app).post('/api/v1/leads/export').set('Authorization','Bearer '+repToken)
  .send({columns:['name'],field:'all',search:'authored comment',includeComments:true}).expect(200)).body;
 assert.deepEqual(report.comments.map(row=>row.leadId),['team-lead','team-lead']);
 await get('/team',repToken).expect(403);
 const filtered=(await get('/leads?filters=[]&assignedToUid='+repUid).expect(200)).body.items;assert.ok(filtered.some(l=>l.id==='team-lead'));assert.ok(filtered.every(l=>l.assignedToUid===repUid));
 const dir=(await get('/lead-assignees?limit=100').expect(200)).body.items;assert.ok(dir.some(m=>m.id===repUid&&m.name==='Synthetic Team SDR'));assert.ok(dir.every(m=>Object.keys(m).sort().join(',')==='active,id,name'));
});

test('MCP read scopes use real Auth owners, Firestore policy and revocation without member administration',async()=>{
 const store=firestoreStore(db),at='2026-11-03T11:00:00.000Z';
 const google=await signIn('mcp-owner@example.com'),uid=(await auth.verifyIdToken(google)).uid;
 await store.run(async tx=>tx.set(path('members',uid),{id:uid,uid,name:'Synthetic MCP Admin',role:'Admin',scope:'assigned',active:true,version:1,capabilities:['leads:read','members:write']}));
 const app=createApp({store,now:()=>at,verifyToken:t=>auth.verifyIdToken(t,true),verifyPersonalTokenOwner:async uid=>{const u=await auth.getUser(uid);return !u.disabled&&u.providerData.some(p=>p.providerId==='google.com');}});
 const issue=await request(app).post('/api/v1/personal-access-tokens').set('Authorization','Bearer '+google).send({name:'Synthetic MCP read access',scopes:['team:read','people:read'],expiresInDays:7}).expect(200);
 const pat=issue.body.token,id=issue.body.personalAccessToken.id;
 const get=url=>request(app).get('/api/v1'+url).set('Authorization','Bearer '+pat);
 const team=(await get('/team?days=7').expect(200)).body;assert.equal(team.members.reduce((n,m)=>n+m.assigned,0),0);
 const people=(await get('/lead-assignees').expect(200)).body;assert.ok(people.items.every(m=>Object.keys(m).sort().join(',')==='active,id,name'));
 await get('/members').expect(403);await get('/leads').expect(403);
 const stored=await store.get(path('personalAccessTokens',id));assert.equal(stored.token,undefined);assert.match(stored.tokenHash,/^[a-f0-9]{64}$/);
 await request(app).delete('/api/v1/personal-access-tokens/'+id).set('Authorization','Bearer '+google).send({}).expect(200);
 await get('/team').expect(401);
});

test('upgraded Firebase client SDK signs in with Google, refreshes tokens and signs out against Auth emulator', async () => {
  const { initializeApp: initializeClient, deleteApp } = await import('firebase/app');
  const { getAuth: getClientAuth, connectAuthEmulator, GoogleAuthProvider, signInWithCredential, signOut } = await import('firebase/auth');
  const client = initializeClient({ apiKey: 'fake', projectId, authDomain: 'localhost' }, 'sdk-review-' + randomUUID());
  const clientAuth = getClientAuth(client);
  connectAuthEmulator(clientAuth, 'http://' + process.env.FIREBASE_AUTH_EMULATOR_HOST, { disableWarnings: true });
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const email = 'sdk-upgrade@example.com';
  const googleToken = encode({ alg: 'none', typ: 'JWT' }) + '.' + encode({
    sub: email, email, email_verified: true, name: 'Synthetic SDK review',
    iss: 'https://accounts.google.com', aud: projectId,
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
  }) + '.';
  try {
    const result = await signInWithCredential(clientAuth, GoogleAuthProvider.credential(googleToken));
    const initial = await result.user.getIdToken();
    const refreshed = await result.user.getIdToken(true);
    for (const token of [initial, refreshed]) {
      const claims = await auth.verifyIdToken(token, true);
      assert.equal(claims.uid, result.user.uid);
      assert.equal(claims.firebase.sign_in_provider, 'google.com');
    }
    const app = createApp({ store: firestoreStore(db), verifyToken: t => auth.verifyIdToken(t, true) });
    const profile = await request(app).get('/api/v1/me').set('Authorization', 'Bearer ' + refreshed).expect(200);
    assert.equal(profile.body.mode, 'demo', 'unapproved SDK identity must not gain workspace membership');
    await signOut(clientAuth);
    assert.equal(clientAuth.currentUser, null);
  } finally {
    await deleteApp(client);
  }
});

test('terminal delivery retention uses the existing Firestore status and due-time query', async () => {
  const { cleanTerminalDeliveries } = await import('../src/delivery-retention.js');
  const store = firestoreStore(db);
  const id = 'retention-emulator-' + randomUUID();
  const pendingId = id + '-pending';
  const oldAt = '2000-01-01T00:00:00.000Z';
  await store.run(async (tx) => {
    tx.set(path('reminderDeliveries', id), { id, status: 'Failed', nextAttemptAt: oldAt });
    tx.set(path('reminderDeliveries', pendingId), { id: pendingId, status: 'Pending', nextAttemptAt: oldAt });
    for (const jobId of [id, pendingId]) {
      const receiptId = jobId + '_device';
      tx.set(path('deviceDeliveries', receiptId), { id: receiptId, status: 'Accepted', at: oldAt });
    }
  });
  try {
    await cleanTerminalDeliveries(store, '2000-06-01T00:00:00.000Z');
    assert.equal(await store.get(path('reminderDeliveries', id)), null);
    assert.equal(await store.get(path('deviceDeliveries', id + '_device')), null);
    assert.equal((await store.get(path('reminderDeliveries', pendingId))).status, 'Pending');
    assert.equal((await store.get(path('deviceDeliveries', pendingId + '_device'))).status, 'Accepted');
  } finally {
    await store.run(async (tx) => {
      tx.delete(path('reminderDeliveries', pendingId));
      tx.delete(path('deviceDeliveries', pendingId + '_device'));
    });
  }
});
