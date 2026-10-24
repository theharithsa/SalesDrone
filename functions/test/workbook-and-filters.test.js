import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { memoryStore } from '../src/store.js';
import { path } from '../src/policy.js';
import { previewRows } from '../src/imports.js';
import { contactKeys, normalizeLead } from '../src/leads.js';
import { analyzeNotes } from '../src/automatic-reminders.js';
const time = '2026-10-24T12:00:00.000Z';
const row = (n = 1) => ({
  serial: String(n),
  source: 'PAC',
  name: 'Synthetic ' + n,
  phone: '+1202555' + String(1000 + n),
  company: 'Example',
  location: 'Bengaluru',
  zone: 'Education',
  enquiryDate: '2026-04-18',
  legacyStatus: 'Quoted',
  initialDiscussion: 'Initial source note',
  followUp1: 'First source follow up',
  followUp2: 'Second source follow up',
  followUp3: 'Third source follow up',
  followUp4: 'Fourth source follow up',
});
async function setup() {
  const store = memoryStore();
  const app = createApp({
    store,
    now: () => time,
    verifyToken: async (uid) => ({
      uid,
      email: uid === 'admin' ? 'spraghav@gmail.com' : 'sdr@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    }),
  });
  const call = (method, url, body, uid = 'admin', key = randomUUID()) => {
    const r = request(app)
      [method]('/api/v1' + url)
      .set('Authorization', 'Bearer ' + uid)
      .set('Idempotency-Key', key);
    return body ? r.send(body) : r;
  };
  await call('get', '/me').expect(200);
  return { store, call };
}
const query = (filters, more = '') =>
  '/leads?filters=' + encodeURIComponent(JSON.stringify(filters)) + more;
test('first-sheet columns survive validation, including blank legacy names/dates and Excel serial dates', () => {
  const input = {
    rows: [
      row(),
      {
        ...row(2),
        name: '',
        enquiryDate: '',
        phone: 'two numbers / unconfirmed',
      },
      { ...row(3), enquiryDate: '46097' },
    ],
    dateOrder: 'DMY',
    statusMap: { Quoted: 'Qualified' },
  };
  const result = previewRows(input);
  assert.equal(result.filter((x) => x.error).length, 0);
  assert.equal(result[0].row.followUp4, '');
  assert.equal(
    result[0].comments.find((c) => c.sourceColumn === '4th follow up').notes,
    'Fourth source follow up',
  );
  assert.equal(result[0].row.legacyStatus, 'Quoted');
  assert.equal(result[1].row.name, '');
  assert.equal(result[1].row.enquiryDate, '');
  assert.equal(result[1].row.needsReview, true);
  assert.equal(result[1].row.originalPhone, 'two numbers / unconfirmed');
  assert.match(result[2].row.enquiryDate, /^2026-03-\d\d$/);
});
test('imports preserve each discussion in the same lead without fabricated occurrence dates or AI jobs', async () => {
  const s = await setup();
  let j = (
    await s
      .call('post', '/imports/preview', {
        filename: 'synthetic.xlsx',
        sheet: 'Sheet1',
        rows: [row()],
        statusMap: { Quoted: 'Qualified' },
      })
      .expect(200)
  ).body;
  j = (await s.call('post', '/imports/' + j.id + '/commit', {}).expect(200))
    .body;
  assert.equal(j.imported, 1);
  const leads = await s.store.query(path('leads'));
  const a = await s.store.query(path('activities'));
  assert.equal(a.length, 5);
  assert.ok(
    a.every(
      (x) => x.leadId === leads[0].id && x.imported && x.occurredAt === null,
    ),
  );
  assert.deepEqual(
    a.map((x) => x.sourceColumn).sort(),
    [
      'Initial discussion',
      '1st follow up',
      '2nd follow up',
      '3rd follow up',
      '4th follow up',
    ].sort(),
  );
  assert.equal((await s.store.query(path('noteAnalyses'))).length, 0);
  await s.call('post', '/imports/' + j.id + '/commit', {}).expect(200);
  assert.equal((await s.store.query(path('activities'))).length, 5);
});
test('keep mode preserves duplicate-contact enquiries, all discussions, and every dedupe identity', async () => {
  const s = await setup(),
    a = row(),
    b = { ...row(2), phone: a.phone };
  let j = (
    await s
      .call('post', '/imports/preview', {
        filename: 'synthetic.xlsx',
        sheet: 'Sheet1',
        duplicateMode: 'keep',
        rows: [a, b],
        statusMap: { Quoted: 'Qualified' },
      })
      .expect(200)
  ).body;
  j = (await s.call('post', '/imports/' + j.id + '/commit', {}).expect(200))
    .body;
  assert.equal(j.imported, 2);
  assert.equal(j.duplicates, 0);
  assert.equal((await s.store.query(path('activities'))).length, 10);
  const leads = await s.store.query(path('leads'));
  const d = await s.store.get(path('dedupeKeys', contactKeys(leads[0])[0]));
  assert.equal(d.leadIds.length, 2);
});
test('initial new-lead comments queue analysis, with a revision, and later detail comments append to history', async () => {
  const s = await setup();
  const l = (
    await s
      .call('post', '/leads', {
        ...row(),
        legacyStatus: '',
        initialDiscussion: '',
        followUp1: '',
        followUp2: '',
        followUp3: '',
        followUp4: '',
        comments: 'Call in 5 minutes.',
      })
      .expect(200)
  ).body;
  const a = (await s.store.query(path('activities')))[0];
  assert.equal(a.revision, 1);
  assert.equal(a.autoReminder.status, 'Pending');
  await analyzeNotes({
    store: s.store,
    now: () => time,
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
  const tasks = await s.store.query(path('tasks'));
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].dueAt, '2026-10-24T12:05:00.000Z');
  await s
    .call('patch', '/leads/' + l.id, {
      expectedVersion: 1,
      comments: 'A later comment.',
    })
    .expect(200);
  const notes = (await s.store.query(path('activities'))).filter(
    (x) => x.type === 'note',
  );
  assert.equal(notes.length, 2);
  assert.ok(notes.some((x) => x.notes === 'Call in 5 minutes.'));
  assert.ok(notes.some((x) => x.notes === 'A later comment.'));
});
test('new Initial discussion also schedules and duplicate legacy Comments text creates only one entry', async () => {
  const s = await setup();
  await s
    .call('post', '/leads', {
      ...row(),
      initialDiscussion: 'Call tomorrow.',
      comments: 'Call tomorrow.',
    })
    .expect(200);
  assert.equal((await s.store.query(path('noteAnalyses'))).length, 1);
  assert.equal((await s.store.query(path('activities'))).length, 5);
});
test('column filters combine case-insensitive city, sector, status, name, discussion and date conditions', async () => {
  const s = await setup();
  await s.store.run(async (tx) => {
    for (let i = 0; i < 12; i++)
      tx.set(path('leads', 'l' + String(i).padStart(3, '0')), {
        ...row(i),
        id: 'l' + String(i).padStart(3, '0'),
        assignedToUid: 'admin',
        archived: false,
        stage: 'New',
        zone: i % 2 ? 'Education' : 'Retail',
        location: i % 3 ? 'Bengaluru' : 'Mumbai',
      });
  });
  const filters = [
    { field: 'zone', op: 'equals', value: 'education' },
    { field: 'location', op: 'contains', value: 'BENGALURU' },
    { field: 'name', op: 'startsWith', value: 'Synthetic' },
    { field: 'legacyStatus', op: 'equals', value: 'quoted' },
    { field: 'followUp1', op: 'contains', value: 'first' },
    { field: 'enquiryDate', op: 'before', value: '2026-05-01' },
  ];
  const r = (await s.call('get', query(filters)).expect(200)).body;
  assert.equal(r.items.length, 4);
  assert.ok(
    r.items.every((l) => l.zone === 'Education' && l.location === 'Bengaluru'),
  );
  await s
    .call('get', query([{ field: 'notAField', op: 'equals', value: 'x' }]))
    .expect(400);
  await s
    .call('get', query([{ field: 'name', op: 'after', value: '2026-01-01' }]))
    .expect(400);
});
test('sparse filters continue after the scan budget and cursors cannot be reused for different filters', async () => {
  const s = await setup();
  await s.store.run(async (tx) => {
    for (let i = 0; i < 1030; i++) {
      const id = 'row' + String(i).padStart(4, '0');
      tx.set(path('leads', id), {
        ...row(i),
        id,
        assignedToUid: 'admin',
        archived: false,
        zone: i < 3 ? 'Target' : 'Other',
      });
    }
  });
  const f = [{ field: 'zone', op: 'equals', value: 'target' }];
  const a = (await s.call('get', query(f, '&limit=2')).expect(200)).body;
  assert.equal(a.items.length, 0);
  assert.equal(a.scanLimited, true);
  assert.ok(a.nextCursor);
  const b = (
    await s
      .call(
        'get',
        query(f, '&limit=2&cursor=' + encodeURIComponent(a.nextCursor)),
      )
      .expect(200)
  ).body;
  assert.equal(b.items.length, 2);
  const c = (
    await s
      .call(
        'get',
        query(f, '&limit=2&cursor=' + encodeURIComponent(b.nextCursor)),
      )
      .expect(200)
  ).body;
  assert.equal(c.items.length, 1);
  assert.equal(c.nextCursor, null);
  assert.equal(new Set([...b.items, ...c.items].map((x) => x.id)).size, 3);
  await s
    .call(
      'get',
      query(
        [{ field: 'zone', op: 'equals', value: 'other' }],
        '&cursor=' + encodeURIComponent(a.nextCursor),
      ),
    )
    .expect(400);
});
test('column-filter scans stay inside assigned scope and the permitted archived boundary', async () => {
  const s = await setup();
  await s.store.run(async (tx) => {
    tx.set(path('members', 'sdr'), {
      id: 'sdr',
      uid: 'sdr',
      role: 'SDR',
      active: true,
      scope: 'assigned',
      version: 1,
      capabilities: ['leads:read'],
    });
    for (const id of ['own', 'other', 'archived'])
      tx.set(path('leads', id), {
        ...row(),
        id,
        assignedToUid: id === 'other' ? 'admin' : 'sdr',
        archived: id === 'archived',
      });
  });
  const r = (
    await s
      .call(
        'get',
        query([{ field: 'zone', op: 'contains', value: 'edu' }]),
        null,
        'sdr',
      )
      .expect(200)
  ).body;
  assert.deepEqual(
    r.items.map((x) => x.id),
    ['own'],
  );
});

test('selected spreadsheet columns become separate ordered timeline comments, with repeated text retained and replay safe', async () => {
  const s = await setup();
  const input = {
    filename: 'multiple-comments.xlsx',
    sheet: 'Sheet1',
    rows: [
      {
        name: 'Comment import',
        phone: '+12025550169',
        enquiryDate: '2026-10-24',
        importComments: [
          {
            sourceColumn: 'Next conversation',
            sourceIndex: 12,
            notes: 'Same note',
          },
          {
            sourceColumn: 'Initial discussion',
            sourceIndex: 8,
            notes: 'Same note',
          },
          { sourceColumn: 'Second follow-up', sourceIndex: 10, notes: '   ' },
          {
            sourceColumn: 'Customer response',
            sourceIndex: 9,
            notes: 'Requested a quote',
          },
        ],
      },
    ],
  };
  let job = (await s.call('post', '/imports/preview', input).expect(200)).body;
  assert.equal(job.commentCount, 3);
  assert.equal(job.chunkSize, 11);
  job = (await s.call('post', '/imports/' + job.id + '/commit', {}).expect(200))
    .body;
  const lead = (await s.store.query(path('leads')))[0];
  const notes = (await s.store.query(path('activities'))).sort(
    (a, b) => a.sourceOrder - b.sourceOrder,
  );
  assert.equal(lead.followUp1, '');
  assert.equal(lead.initialDiscussion, '');
  assert.equal(lead.comments, '');
  assert.equal(lead.importComments, undefined);
  assert.deepEqual(
    notes.map((n) => n.notes),
    ['Same note', 'Requested a quote', 'Same note'],
  );
  assert.deepEqual(
    notes.map((n) => n.sourceColumnIndex),
    [8, 9, 12],
  );
  assert.ok(
    notes.every(
      (n) =>
        n.leadId === lead.id &&
        n.imported &&
        n.occurredAt === null &&
        n.revision === 1,
    ),
  );
  assert.equal((await s.store.query(path('noteAnalyses'))).length, 0);
  assert.equal(
    (await s.call('post', '/imports/preview', input).expect(200)).body.id,
    job.id,
  );
  await s.call('post', '/imports/' + job.id + '/commit', {}).expect(200);
  assert.equal((await s.store.query(path('activities'))).length, 3);
});
test('malformed, duplicate-source, oversized and nonliteral comment imports are reported as row errors', () => {
  const base = {
    name: 'Invalid comment',
    phone: '+12025550168',
    enquiryDate: '2026-10-24',
  };
  const comment = { sourceColumn: 'Comment', sourceIndex: 0, notes: 'A note' };
  for (const comments of [
    [comment, comment],
    [{ ...comment, sourceIndex: 40 }],
    [{ ...comment, notes: { text: 'x' } }],
    [{ ...comment, notes: 'x'.repeat(4001) }],
    Array.from({ length: 7 }, (_, sourceIndex) => ({
      ...comment,
      sourceIndex,
      notes: 'x'.repeat(4000),
    })),
  ]) {
    const result = previewRows({
      rows: [{ ...base, importComments: comments }],
      dateOrder: 'DMY',
      statusMap: {},
    });
    assert.ok(result[0].error);
    assert.equal(result[0].row, null);
  }
});
test('forty comment columns commit safely across multiple bounded chunks', async () => {
  const s = await setup();
  const rows = Array.from({ length: 12 }, (_, i) => ({
    name: 'Batch ' + i,
    email: 'batch.' + i + '@example.com',
    phone: '+1202555' + String(2000 + i),
    enquiryDate: '2026-10-24',
    importComments: Array.from({ length: 40 }, (_, j) => ({
      sourceColumn: 'Comment ' + j,
      sourceIndex: j,
      notes: 'Entry ' + i + '/' + j,
    })),
  }));
  let job = (
    await s
      .call('post', '/imports/preview', {
        filename: 'bounded.xlsx',
        sheet: 'Sheet1',
        rows,
      })
      .expect(200)
  ).body;
  job = (await s.call('post', '/imports/' + job.id + '/commit', {}).expect(200))
    .body;
  assert.equal(job.offset, 11);
  assert.equal(job.status, 'Importing');
  assert.equal(
    (await s.store.query(path('activities'), { limit: 1000 })).length,
    440,
  );
  job = (await s.call('post', '/imports/' + job.id + '/commit', {}).expect(200))
    .body;
  assert.equal(job.imported, 12);
  assert.equal(job.status, 'Completed');
  assert.equal(
    (await s.store.query(path('activities'), { limit: 1000 })).length,
    480,
  );
});

test('pre-existing previews with 25-row chunks resume using their original discussion fields', async () => {
  const s = await setup();
  const id = 'legacy-preview';
  const rows = Array.from({ length: 26 }, (_, i) => ({
    index: i,
    row: normalizeLead(row(500 + i)),
    error: null,
  }));
  await s.store.run(async (tx) => {
    tx.set(path('imports', id), {
      id,
      status: 'Preview',
      total: 26,
      offset: 0,
      imported: 0,
      duplicates: 0,
      failed: 0,
      expiresAt: '2026-10-25T12:00:00.000Z',
      duplicateMode: 'skip',
    });
    tx.set(path('importChunks', id + '_0'), {
      id: id + '_0',
      importId: id,
      rows: rows.slice(0, 25),
    });
    tx.set(path('importChunks', id + '_1'), {
      id: id + '_1',
      importId: id,
      rows: rows.slice(25),
    });
  });
  let job = (await s.call('post', '/imports/' + id + '/commit', {}).expect(200))
    .body;
  assert.equal(job.offset, 25);
  job = (await s.call('post', '/imports/' + id + '/commit', {}).expect(200))
    .body;
  assert.equal(job.status, 'Completed');
  assert.equal(job.imported, 26);
  assert.equal(
    (await s.store.query(path('activities'), { limit: 1000 })).length,
    130,
  );
});
