import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { memoryStore } from '../src/store.js';
import { path, hash } from '../src/policy.js';
import { observableStore, lifecycleCounts } from '../src/observable-store.js';
const row = (n = 1) => ({
  name: 'Synthetic person ' + n,
  phone: '+1202555' + String(1000 + n),
  enquiryDate: '2026-10-20',
  company: 'Before',
  importComments: [
    { sourceColumn: 'Notes', sourceIndex: 5, notes: 'Historical comment ' + n },
  ],
});
async function setup() {
  const store = memoryStore();
  let clock = '2026-10-30T09:00:00.000Z';
  const app = createApp({
    store,
    now: () => clock,
    verifyToken: async (uid) => ({
      uid,
      email:
        uid === 'admin'
          ? 'spraghav@gmail.com'
          : uid === 'other'
            ? 'theharithsa@gmail.com'
            : uid + '@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    }),
  });
  const call = (method, url, body, who = 'admin', key = randomUUID()) => {
    const r = request(app)
      [method]('/api/v1' + url)
      .set('Authorization', 'Bearer ' + who)
      .set('Idempotency-Key', key);
    return body ? r.send(body) : r;
  };
  await call('get', '/me').expect(200);
  await call('get', '/me', null, 'other').expect(200);
  return { store, call, tick: (v) => (clock = v) };
}
async function draft(s, rows, extra = {}, who = 'admin') {
  let j = (
    await s
      .call(
        'post',
        '/imports/preview',
        {
          filename: 'synthetic.csv',
          sheet: 'CSV',
          rows,
          reviewed: true,
          ...extra,
        },
        who,
      )
      .expect(200)
  ).body;
  while (j.status === 'Preparing')
    j = (
      await s
        .call(
          'post',
          '/imports/' + j.id + '/plan',
          { expectedVersion: j.version },
          who,
        )
        .expect(200)
    ).body;
  return j;
}
async function approve(s, j, who = 'admin') {
  while (j.reviewOffset < j.total)
    j = (
      await s
        .call(
          'post',
          '/imports/' + j.id + '/review',
          { expectedVersion: j.version },
          who,
        )
        .expect(200)
    ).body;
  return j;
}
async function commit(s, j, who = 'admin') {
  while (!['Completed', 'Blocked'].includes(j.status))
    j = (
      await s
        .call(
          'post',
          '/imports/' + j.id + '/commit',
          { expectedVersion: j.version },
          who,
        )
        .expect(200)
    ).body;
  return j;
}
async function rows(s, j, who = 'admin') {
  return (
    await s
      .call('get', '/imports/' + j.id + '/rows?limit=100', null, who)
      .expect(200)
  ).body.items;
}
test('reviewed workbook updates retain IDs, compare baseline/current/incoming and replay without duplicate discussions', async () => {
  const s = await setup();
  let first = await commit(
    s,
    await approve(s, await draft(s, [row(), row(2)])),
  );
  assert.equal(first.imported, 2);
  assert.equal((await s.store.query(path('activities'))).length, 2);
  let second = await draft(
    s,
    [{ ...row(2), company: 'Updated' }, row(), row(3)],
    { duplicateMode: 'update', sourceImportId: first.id },
  );
  assert.deepEqual(
    (await rows(s, second)).map((r) => r.classification),
    ['Update', 'Unchanged', 'New'],
  );
  const ids = (await s.store.query(path('leads'))).map((l) => l.id);
  second = await commit(s, await approve(s, second));
  assert.equal(second.status, 'Completed');
  assert.equal(second.updated, 1);
  assert.equal(second.unchanged, 1);
  assert.equal(second.imported, 1);
  assert.ok(ids.every((id) => s.store.dump()[path('leads', id)]));
  assert.equal(
    (await s.store.query(path('activities'))).filter((a) => a.type === 'note')
      .length,
    3,
  );
  let third = await commit(
    s,
    await approve(
      s,
      await draft(s, [{ ...row(2), company: 'Updated' }, row(), row(3)], {
        duplicateMode: 'update',
        sourceImportId: second.id,
      }),
    ),
  );
  assert.equal(third.unchanged, 3);
  assert.equal(third.updated, 0);
  assert.equal(
    (await s.store.query(path('activities'))).filter((a) => a.type === 'note')
      .length,
    3,
  );
});
test('team edits survive unchanged source cells, conflicting source changes need explicit decisions', async () => {
  const s = await setup(),
    first = await commit(s, await approve(s, await draft(s, [row()])));
  const [lead] = await s.store.query(path('leads'));
  await s
    .call('patch', '/leads/' + lead.id, {
      expectedVersion: lead.version,
      company: 'Teammate',
    })
    .expect(200);
  let j = await draft(s, [row()], {
    duplicateMode: 'update',
    sourceImportId: first.id,
  });
  assert.equal((await rows(s, j))[0].classification, 'Unchanged');
  j = await commit(s, await approve(s, j));
  assert.equal((await s.store.get(path('leads', lead.id))).company, 'Teammate');
  j = await draft(s, [{ ...row(), company: 'Workbook' }], {
    duplicateMode: 'update',
    sourceImportId: j.id,
  });
  j = await approve(s, j);
  assert.equal(j.pending, 1);
  const [r] = await rows(s, j);
  assert.equal(r.changes.find((c) => c.key === 'company').conflict, true);
  await s
    .call('post', '/imports/' + j.id + '/commit', {
      expectedVersion: j.version,
    })
    .expect(409);
  j = (
    await s
      .call('patch', '/imports/' + j.id + '/rows/0', {
        expectedVersion: j.version,
        action: 'accept',
        incomingFields: ['company'],
      })
      .expect(200)
  ).body;
  j = await commit(s, j);
  assert.equal(j.updated, 1);
  assert.equal((await s.store.get(path('leads', lead.id))).company, 'Workbook');
});
test('name-only, shared-phone, workbook overlaps and multiple database matches are visible review cases', async () => {
  const s = await setup();
  await commit(s, await approve(s, await draft(s, [row()])));
  const j = await draft(
    s,
    [
      { ...row(), phone: '+12025559999' },
      { ...row(2), phone: row().phone },
    ],
    { duplicateMode: 'update' },
  );
  const result = await rows(s, j);
  assert.ok(result.every((r) => r.classification === 'Conflict'));
  assert.ok(result.every((r) => r.candidates[0].name === row().name));
  const overlap = await draft(s, [row(8), row(8)], { duplicateMode: 'update' });
  assert.ok(
    (await rows(s, overlap)).every(
      (r) => r.classification === 'Conflict' && r.relatedRows.length === 2,
    ),
  );
});
test('non-admin import grants remain optional, shared history is explicit and row details stay lead-scoped', async () => {
  const s = await setup();
  const base = {
    id: 'worker',
    uid: 'worker',
    name: 'Worker',
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
    ],
  };
  await s.store.run((tx) => tx.set(path('members', 'worker'), base));
  const first = await commit(s, await approve(s, await draft(s, [row()])));
  let history = (await s.call('get', '/imports', null, 'worker').expect(200))
    .body;
  assert.equal(history.items.length, 0);
  await s.call('get', '/imports/' + first.id, null, 'worker').expect(404);
  await s.store.run((tx) =>
    tx.set(path('members', 'worker'), {
      ...base,
      capabilities: [...base.capabilities, 'imports:share'],
    }),
  );
  history = (await s.call('get', '/imports', null, 'worker').expect(200)).body;
  assert.equal(history.items.length, 1);
  assert.deepEqual(
    (await rows(s, first, 'worker')).map((r) => r.classification),
    ['Restricted'],
  );
  const own = await draft(s, [row()], { duplicateMode: 'update' }, 'worker');
  const [restricted] = await rows(s, own, 'worker');
  assert.equal(restricted.classification, 'Restricted');
  assert.equal(restricted.candidates.length, 0);
  assert.equal(restricted.leadId, undefined);
  const created = await commit(
    s,
    await approve(s, await draft(s, [row(5)], {}, 'worker'), 'worker'),
    'worker',
  );
  assert.equal(created.imported, 1);
  const leads = await s.store.query(path('leads'));
  assert.equal(
    leads.find((l) => l.phone === row(5).phone).assignedToUid,
    'worker',
  );
  await s
    .call(
      'delete',
      '/imports/' + created.id,
      {
        expectedVersion: created.version,
        confirmation: 'DELETE IMPORT DETAILS',
      },
      'worker',
    )
    .expect(403);
});
test('a concurrent executor or lead edit cannot apply an old reviewed chunk; refresh recovers remaining work', async () => {
  const s = await setup(),
    first = await commit(s, await approve(s, await draft(s, [row()])));
  let j = await approve(
    s,
    await draft(s, [{ ...row(), company: 'New' }], {
      duplicateMode: 'update',
      sourceImportId: first.id,
    }),
  );
  const [lead] = await s.store.query(path('leads'));
  await s
    .call('patch', '/leads/' + lead.id, {
      expectedVersion: lead.version,
      location: 'Team edit',
    })
    .expect(200);
  const oldVersion = j.version;
  j = await commit(s, j);
  assert.equal(j.status, 'Blocked');
  assert.equal(j.updated, 0);
  await s
    .call(
      'post',
      '/imports/' + j.id + '/commit',
      { expectedVersion: oldVersion },
      'other',
    )
    .expect(409);
  j = (
    await s
      .call('post', '/imports/' + j.id + '/refresh', {
        expectedVersion: j.version,
      })
      .expect(200)
  ).body;
  while (j.status === 'Preparing')
    j = (
      await s
        .call('post', '/imports/' + j.id + '/plan', {
          expectedVersion: j.version,
        })
        .expect(200)
    ).body;
  j = await commit(s, await approve(s, j));
  assert.equal(j.updated, 1);
  assert.equal(
    (await s.store.get(path('leads', lead.id))).location,
    'Team edit',
  );
});
test('explicit comment corrections retain prior revisions, do not enqueue AI and do not repeat on re-import', async () => {
  const s = await setup(),
    first = await commit(s, await approve(s, await draft(s, [row()])));
  const changed = {
    ...row(),
    importComments: [
      {
        sourceColumn: 'Notes',
        sourceIndex: 5,
        notes: 'Revised historical note',
      },
    ],
  };
  let j = await commit(
    s,
    await approve(
      s,
      await draft(s, [changed], {
        duplicateMode: 'update',
        sourceImportId: first.id,
      }),
    ),
  );
  assert.equal(j.updated, 1);
  const [a] = await s.store.query(path('activities'), {
    filters: [['type', '==', 'note']],
  });
  assert.equal(a.revision, 2);
  assert.equal(a.occurredAt, null);
  assert.equal(
    (await s.store.query(path('activityRevisions')))[0].notes,
    row().importComments[0].notes,
  );
  assert.equal((await s.store.query(path('noteAnalyses'))).length, 0);
  j = await commit(
    s,
    await approve(
      s,
      await draft(s, [changed], {
        duplicateMode: 'update',
        sourceImportId: j.id,
      }),
    ),
  );
  assert.equal(j.unchanged, 1);
  assert.equal((await s.store.query(path('activityRevisions'))).length, 1);
});
test('expired previews refresh, admin detail deletion preserves leads and clears source baselines', async () => {
  const s = await setup();
  let j = await approve(s, await draft(s, [row()]));
  s.tick('2026-11-02T09:00:00.000Z');
  j = await commit(s, j);
  assert.equal(j.status, 'Blocked');
  assert.equal(j.lastError, 'EXPIRED');
  j = (
    await s
      .call('post', '/imports/' + j.id + '/refresh', {
        expectedVersion: j.version,
      })
      .expect(200)
  ).body;
  while (j.status === 'Preparing')
    j = (
      await s
        .call('post', '/imports/' + j.id + '/plan', {
          expectedVersion: j.version,
        })
        .expect(200)
    ).body;
  j = await commit(s, await approve(s, j));
  assert.equal(j.imported, 1);
  const leadId = (await s.store.query(path('leads')))[0].id;
  do {
    j = (
      await s
        .call('delete', '/imports/' + j.id, {
          expectedVersion: j.version,
          confirmation: 'DELETE IMPORT DETAILS',
        })
        .expect(200)
    ).body;
  } while (j.status === 'Deleting');
  assert.equal(j.status, 'DetailsDeleted');
  assert.ok(await s.store.get(path('leads', leadId)));
  assert.equal((await s.store.query(path('importChunks'))).length, 0);
  assert.equal((await s.store.query(path('importBaselines'))).length, 0);
});
test('1000-row re-import preserves counts and IDs; pagination is bounded and import event counts contain no source values', async () => {
  const s = await setup();
  const input = Array.from({ length: 1000 }, (_, i) => ({
    ...row(i + 1),
    importComments: [],
  }));
  const first = await commit(s, await approve(s, await draft(s, input)));
  assert.equal(first.imported, 1000);
  s.tick('2026-10-30T09:05:00.000Z');
  const updated = input
    .map((r, i) => (i < 200 ? { ...r, company: 'Updated' } : r))
    .concat(
      Array.from({ length: 50 }, (_, i) => ({
        ...row(1001 + i),
        importComments: [],
      })),
    );
  const j = await commit(
    s,
    await approve(
      s,
      await draft(s, updated, {
        duplicateMode: 'update',
        sourceImportId: first.id,
      }),
    ),
  );
  assert.equal(j.updated, 200);
  assert.equal(j.unchanged, 800);
  assert.equal(j.imported, 50);
  assert.equal(await s.store.count(path('leads')), 1050);
  const page = (
    await s.call('get', '/imports/' + j.id + '/rows?limit=1').expect(200)
  ).body;
  assert.equal(page.items.length, 11);
  assert.ok(page.nextCursor);
  assert.deepEqual(
    lifecycleCounts(
      'imports',
      { formatVersion: 3, imported: 2, status: 'Importing' },
      { formatVersion: 3, imported: 5, status: 'Completed' },
    ),
    { import_created: 3, import_completed: 1 },
  );
});

test('explicit optional clears are persisted, reviewed and validated without clearing required contact details', async () => {
  const s = await setup();
  const first = await commit(s, await approve(s, await draft(s, [row()])));
  let next = await draft(s, [row()], {
    duplicateMode: 'update',
    sourceImportId: first.id,
  });
  const url = '/imports/' + next.id + '/rows/0';
  await s
    .call('patch', url, {
      expectedVersion: next.version,
      action: 'accept',
      clearFields: ['name'],
    })
    .expect(400);
  next = (
    await s
      .call('patch', url, {
        expectedVersion: next.version,
        action: 'accept',
        clearFields: ['company'],
      })
      .expect(200)
  ).body;
  const result = (await rows(s, next))[0];
  assert.deepEqual(result.clearFields, ['company']);
  assert.ok(
    result.changes.some(
      (c) => c.key === 'company' && c.incoming === '' && c.explicitClear,
    ),
  );
  next = await commit(s, await approve(s, next));
  assert.equal(next.updated, 1);
  assert.equal((await s.store.query(path('leads')))[0].company, '');
});

test('skip mode requires a name/contact pair, rejects unbounded chunks and preserves optional grant dependencies', async () => {
  const s = await setup();
  await commit(s, await approve(s, await draft(s, [row()])));
  const j = await draft(s, [{ ...row(2), phone: row().phone }], {
    duplicateMode: 'skip',
  });
  assert.equal((await rows(s, j))[0].classification, 'Conflict');
  const many = Array.from({ length: 11 }, (_, i) => ({
    ...row(i + 10),
    importComments: Array.from({ length: 5 }, (_, n) => ({
      sourceColumn: 'Note ' + n,
      sourceIndex: n,
      notes: 'x'.repeat(4000),
    })),
  }));
  const oversized = await s.call('post', '/imports/preview', {
    filename: 'big.csv',
    sheet: 'CSV',
    rows: many,
    reviewed: true,
  });
  assert.equal(oversized.status, 413, JSON.stringify(oversized.body));
  await s
    .call('post', '/invitations', {
      email: 'member@example.com',
      role: 'SDR',
      scope: 'assigned',
      capabilities: ['leads:read', 'imports:write'],
    })
    .expect(400);
});

test('import committed telemetry contains lifecycle counts but no workbook or comparison values', async () => {
  const base = memoryStore();
  const store = observableStore(base, () => ({
    enabled: true,
    span: async (_n, fn) => fn(),
    capture: () => ({}),
  }));
  await store.run(async (tx) => {
    await tx.get(path('imports', 'privacy'));
    tx.set(path('imports', 'privacy'), {
      id: 'privacy',
      formatVersion: 3,
      status: 'Completed',
      imported: 2,
      updated: 1,
      filename: 'PRIVATE-FILENAME',
      row: { name: 'PRIVATE-NAME' },
      changes: [{ current: 'PRIVATE-CURRENT' }],
    });
    tx.set(path('importBaselines', 'private'), {
      id: 'private',
      values: { company: 'PRIVATE-BASELINE' },
    });
  });
  const events = await base.query(path('telemetryOutbox'));
  assert.equal(events.length, 1);
  assert.equal(events[0].event.data['records.import_created'], 2);
  assert.equal(events[0].event.data['records.import_updated'], 1);
  assert.equal(events[0].event.data['records.import_completed'], 1);
  assert.ok(!JSON.stringify(events).includes('PRIVATE-'));
});

test('mapped custom values preserve types and participate in linked source comparisons', async () => {
  const s = await setup();
  const config = (await s.call('get', '/field-options').expect(200)).body;
  await s
    .call('patch', '/field-options', {
      expectedVersion: config.version,
      values: config.values,
      customFields: [
        {
          id: 'cf_budget',
          label: 'Budget',
          type: 'number',
          options: [],
          required: false,
          deleted: false,
        },
        {
          id: 'cf_approved',
          label: 'Approved',
          type: 'checkbox',
          options: [],
          required: false,
          deleted: false,
        },
      ],
    })
    .expect(200);
  const first = await commit(
    s,
    await approve(
      s,
      await draft(s, [{ ...row(), cf_budget: '10', cf_approved: 'true' }]),
    ),
  );
  assert.equal(first.imported, 1);
  const saved = (await s.store.query(path('leads')))[0];
  assert.deepEqual(saved.customFields, { cf_budget: 10, cf_approved: true });
  const next = await commit(
    s,
    await approve(
      s,
      await draft(s, [{ ...row(), cf_budget: '20', cf_approved: 'false' }], {
        duplicateMode: 'update',
        sourceImportId: first.id,
      }),
    ),
  );
  assert.equal(next.updated, 1);
  assert.deepEqual((await s.store.get(path('leads', saved.id))).customFields, {
    cf_budget: 20,
    cf_approved: false,
  });
});

test('comment-heavy chunks commit within a reduced write budget and resume without duplicate notes', async () => {
  const s = await setup();
  const input = Array.from({ length: 11 }, (_, i) => ({
    ...row(i + 50),
    importComments: Array.from({ length: 40 }, (_, n) => ({
      sourceColumn: 'Discussion ' + n,
      sourceIndex: n,
      notes: 'Historical detail ' + n,
    })),
  }));
  let j = await approve(s, await draft(s, input));
  j = (
    await s
      .call('post', '/imports/' + j.id + '/commit', {
        expectedVersion: j.version,
      })
      .expect(200)
  ).body;
  assert.equal(j.offset, 3);
  j = await commit(s, j);
  assert.equal(j.imported, 11);
  assert.equal(await s.store.count(path('activities')), 440);
});

test('legacy owner replay follows renewed previews without cross-owner fingerprint disclosure', async () => {
  const s = await setup();
  const body = {
    filename: 'legacy.csv',
    sheet: 'CSV',
    rows: [row()],
    duplicateMode: 'keep',
  };
  const a = (await s.call('post', '/imports/preview', body).expect(200)).body;
  s.tick('2026-11-02T09:00:00.000Z');
  const b = (await s.call('post', '/imports/preview', body).expect(200)).body;
  assert.notEqual(a.id, b.id);
  const replay = (await s.call('post', '/imports/preview', body).expect(200))
    .body;
  assert.equal(replay.id, b.id);
  const other = (
    await s.call('post', '/imports/preview', body, 'other').expect(200)
  ).body;
  assert.notEqual(other.id, b.id);
  assert.equal(other.createdByUid, 'other');
});

test('history normalizes ISO offsets and private reports obey workspace export policy', async () => {
  const s = await setup();
  const j = await draft(s, [row()]);
  const history = (
    await s
      .call(
        'get',
        '/imports?from=' + encodeURIComponent('2026-10-30T10:00:00+01:00'),
      )
      .expect(200)
  ).body;
  assert.equal(history.items[0].id, j.id);
  await s.store.run((tx) =>
    tx.set(path('settings', 'workspace'), {
      version: 1,
      exportsEnabled: false,
      assignedOnly: true,
    }),
  );
  await s.call('get', '/imports/' + j.id + '/report').expect(403);
});

test('owner API tokens cannot execute reviewed jobs through the legacy commit endpoint', async () => {
  const s = await setup();
  const j = await approve(s, await draft(s, [row()]));
  const token = (
    await s
      .call('post', '/personal-access-tokens', {
        name: 'Synthetic import token',
        scopes: [
          'imports:read',
          'imports:write',
          'leads:read',
          'leads:create',
          'leads:edit',
        ],
        expiresInDays: 30,
      })
      .unset('Idempotency-Key')
      .expect(200)
  ).body.token;
  await s
    .call(
      'post',
      '/imports/' + j.id + '/commit',
      { expectedVersion: j.version },
      token,
    )
    .expect(403);
  await s.call('get', '/imports/' + j.id + '/rows', null, token).expect(403);
  assert.equal(await s.store.count(path('leads')), 0);
});
