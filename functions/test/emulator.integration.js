import { cleanupAttachments } from '../src/attachments.js';
import { firebaseFiles } from '../src/file-storage.js';
import { path } from '../src/policy.js';
import { observableStore } from '../src/observable-store.js';
import { test } from 'node:test';
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
  const intelligence = (
    await req('post', '/dashboard/insights', {}).expect(200)
  ).body;
  assert.equal(intelligence.status, 'Ready');
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
      kind: 'administrative',
      dueAt: '2026-11-03T05:30:00Z',
    }).expect(200)
  ).body;
  assert.equal(edit.title, 'Edited emulator task');
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
  const fileBytes = Buffer.from('Fictional emulator file contents');
  const base = '/leads/' + fileLead.id + '/attachments';
  const pending = (
    await req(
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
    await req('put', base + '/' + pending.id + '/content')
      .set('Content-Type', 'application/octet-stream')
      .send(fileBytes)
      .expect(200)
  ).body;
  assert.equal(ready.state, 'Ready');
  assert.deepEqual(
    (await req('get', base + '/' + ready.id + '/content').expect(200)).body,
    fileBytes,
  );
  assert.equal((await req('get', base).expect(200)).body.items[0].id, ready.id);
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
  await req('delete', base + '/' + ready.id, {
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
  await db.terminate();
});
