import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import { memoryStore } from "../src/store.js";
import { path } from "../src/policy.js";
import { PRESETS } from "../src/contracts.js";
import { teamSnapshot } from "../src/team.js";
import { generateToken } from "../src/personal-access-tokens.js";
const now = "2026-11-03T12:00:00.000Z";
async function fixture() {
  const store = memoryStore();
  const put = async (c, id, v) =>
    store.run(async (tx) => tx.set(path(c, id), { id, ...v }));
  await put("members", "admin", {
    uid: "admin",
    role: "Admin",
    active: true,
    scope: "all",
    version: 1,
    capabilities: PRESETS.Admin,
    name: "Admin Person",
  });
  await put("members", "sdr", {
    uid: "sdr",
    role: "SDR",
    active: true,
    scope: "assigned",
    version: 1,
    capabilities: ["leads:read"],
    name: "Casey SDR",
    email: "private@example.com",
  });
  await put("members", "inactive", {
    uid: "inactive",
    role: "SDR",
    active: false,
    scope: "assigned",
    version: 1,
    capabilities: ["leads:read"],
    name: "Former Member",
  });
  await put("leads", "a", {
    name: "Alpha",
    assignedToUid: "sdr",
    stage: "Custom stage",
    archived: false,
  });
  await put("leads", "b", {
    name: "Beta",
    assignedToUid: null,
    stage: "New",
    archived: false,
  });
  await put("leads", "old", {
    name: "Archived",
    assignedToUid: "sdr",
    stage: "Old",
    archived: true,
  });
  const a = {
    leadId: "a",
    actorUid: "sdr",
    createdAt: "2026-11-02T10:00:00.000Z",
  };
  await put("activities", "note", {
    ...a,
    type: "note",
    notes: "Current corrected text",
    revision: 2,
  });
  await put("activities", "call", {
    ...a,
    leadId: "b",
    type: "call",
    outcome: "Connected",
    notes: "Recorded call",
  });
  await put("activities", "import", {
    ...a,
    type: "note",
    notes: "Historic imported text",
    imported: true,
  });
  await put("activities", "removed", {
    ...a,
    leadId: "missing",
    type: "note",
    notes: "Do not publish",
  });
  await put("activities", "old", {
    ...a,
    type: "note",
    createdAt: "2025-01-01T00:00:00.000Z",
  });
  await put("activities", "future", {
    ...a,
    type: "note",
    createdAt: "2026-12-01T00:00:00.000Z",
  });
  await put("leadTransitions", "transition", {
    ...a,
    from: "New",
    reason: "edited",
  });
  await put("leadTransitions", "import", {
    ...a,
    from: null,
    reason: "imported",
  });
  await put("tasks", "pending", {
    leadId: "a",
    recipientUid: "sdr",
    state: "Pending",
    dueAt: "2026-11-02T10:00:00.000Z",
  });
  await put("tasks", "complete", {
    leadId: "a",
    recipientUid: "sdr",
    state: "Completed",
    completedAt: "2026-11-02T10:00:00.000Z",
  });
  await put("tasks", "private", {
    leadId: null,
    recipientUid: "sdr",
    state: "Pending",
    title: "PRIVATE",
    dueAt: "2026-11-02T10:00:00.000Z",
  });
  const app = createApp({
    store,
    now: () => now,
    verifyToken: async (uid) => ({
      uid,
      email: uid + "@example.com",
      email_verified: true,
      firebase: { sign_in_provider: "google.com" },
    }),
  });
  const get = (url, uid = "admin") =>
    request(app)
      .get("/api/v1" + url)
      .set("Authorization", "Bearer " + uid);
  const pat = async (scopes) => {
    const issued = generateToken('admin', {name:'Synthetic read adapter', scopes, expiresInDays:7}, now);
    await put('personalAccessTokens', issued.record.id, issued.record);
    return issued;
  };
  return { store, put, get, app, pat };
}
test("Team aggregates current workload separately from authored activity and private reminders", async () => {
  const { get } = await fixture();
  const r = await get("/team?days=7").expect(200),
    m = r.body.members.find((m) => m.id === "sdr");
  assert.equal(m.assigned, 1);
  assert.equal(m.comments, 1);
  assert.equal(m.calls, 1);
  assert.equal(m.connected, 1);
  assert.equal(m.leadsWorked, 2);
  assert.equal(m.stageChanges, 1);
  assert.equal(m.pending, 1);
  assert.equal(m.overdue, 1);
  assert.equal(m.completed, 1);
  assert.equal(r.body.unassigned, 1);
  assert.deepEqual(m.stages, [{ label: "Custom stage", value: 1 }]);
  assert.equal(r.body.members.find((m) => m.id === "inactive").active, false);
  assert.equal(
    r.body.trend.reduce((n, t) => n + t.comments + t.calls, 0),
    2,
  );
  assert.equal(JSON.stringify(r.body).includes("private@example.com"), false);
  assert.equal(JSON.stringify(r.body).includes("PRIVATE"), false);
});
test("Team activity pages preserve author, current corrected text and lead links; cursors bind member and period", async () => {
  const { get } = await fixture();
  let cursor,
    items = [];
  do {
    const r = await get(
      "/team/members/sdr/activities?days=7&limit=1" +
        (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""),
    ).expect(200);
    items.push(...r.body.items);
    cursor = r.body.nextCursor;
    if (cursor) {
      await get(
        "/team/members/admin/activities?days=7&limit=1&cursor=" +
          encodeURIComponent(cursor),
      ).expect(400);
      await get(
        "/team/members/sdr/activities?days=30&limit=1&cursor=" +
          encodeURIComponent(cursor),
      ).expect(400);
    }
  } while (cursor);
  assert.deepEqual(items.map((i) => i.id).sort(), ["call", "note"]);
  assert.equal(
    items.find((i) => i.id === "note").notes,
    "Current corrected text",
  );
  assert.equal(items.find((i) => i.id === "note").revision, 2);
  await get("/team/members/missing/activities").expect(404);
});
test("Team denies non-admin members and invalid query windows; minimal assignee directory supports inactive names", async () => {
  const { get } = await fixture();
  await get("/team", "sdr").expect(403);
  await get("/team/members/admin/activities", "sdr").expect(403);
  await get("/lead-assignees", "sdr").expect(403);
  await get("/team?days=365").expect(400);
  await get("/team?unexpected=x").expect(400);
  const r = await get("/lead-assignees").expect(200);
  assert.deepEqual(Object.keys(r.body.items[0]).sort(), [
    "active",
    "id",
    "name",
  ]);
  assert.equal(r.body.items.length, 3);
});
test("Named and unassigned lead filters compose and bind pagination without broadening scope", async () => {
  const { get, put } = await fixture();
  await put("leads", "c", {
    name: "Gamma",
    assignedToUid: "sdr",
    archived: false,
    stage: "New",
  });
  const one = await get("/leads?assignedToUid=sdr&filters=[]&limit=1").expect(
    200,
  );
  assert.equal(one.body.items.length, 1);
  assert.ok(one.body.nextCursor);
  await get(
    "/leads?assignedToUid=__unassigned__&filters=[]&limit=1&cursor=" +
      encodeURIComponent(one.body.nextCursor),
  ).expect(400);
  const unassigned = await get(
    "/leads?assignedToUid=__unassigned__&filters=[]",
  ).expect(200);
  assert.deepEqual(
    unassigned.body.items.map((l) => l.id),
    ["b"],
  );
  await get("/leads?assignedToUid=admin&filters=[]", "sdr").expect(403);
  const legacy = await get("/leads?assignedToUid=__unassigned__").expect(200);
  assert.deepEqual(
    legacy.body.items.map((l) => l.id),
    ["b"],
  );
});
test("Team bounded scans fail rather than publish partial totals", async () => {
  const { store, put } = await fixture();
  for (let i = 0; i < 200; i++)
    await put("members", "extra" + i, {
      uid: "extra" + i,
      name: "Synthetic",
      active: true,
      role: "SDR",
    });
  await assert.rejects(
    () => teamSnapshot(store, { uid: "admin", scope: "all" }, now, 30),
    (e) => e.code === "TEAM_LIMIT",
  );
});
test("Team rechecks membership before publishing a completed report", async () => {
  const { store } = await fixture();
  const original = store.query;
  let revoked = false;
  store.query = async (...args) => {
    const rows = await original(...args);
    if (!revoked && args[0] === path("tasks")) {
      revoked = true;
      await store.run(async (tx) => {
        const m = await tx.get(path("members", "admin"));
        tx.set(path("members", "admin"), { ...m, active: false, version: 2 });
      });
    }
    return rows;
  };
  const app = createApp({
    store,
    now: () => now,
    verifyToken: async () => ({
      uid: "admin",
      email: "admin@example.com",
      email_verified: true,
      firebase: { sign_in_provider: "google.com" },
    }),
  });
  await request(app)
    .get("/api/v1/team")
    .set("Authorization", "Bearer admin")
    .expect(403);
});

test("Assigned lead report export preserves literal member IDs and unassigned selection", async () => {
  const { app, put } = await fixture();
  await put("leads", "case-sensitive", {
    name: "Different UID",
    assignedToUid: "SDR",
    stage: "New",
    archived: false,
  });
  const exportPage = async (assignedToUid) =>
    (
      await request(app)
        .post("/api/v1/leads/export")
        .set("Authorization", "Bearer admin")
        .send({ columns: ["name"], filters: [], assignedToUid })
        .expect(200)
    ).body;
  assert.deepEqual(
    (await exportPage("sdr")).rows.map((i) => i.id),
    ["a"],
  );
  assert.deepEqual(
    (await exportPage("__unassigned__")).rows.map((i) => i.id),
    ["b"],
  );
});

test('read adapter scopes permit only Admin Team and minimal people reads', async () => {
  const {get,app,pat}=await fixture();
  const team=await pat(['team:read']),people=await pat(['people:read']),lead=await pat(['leads:read']);
  const snapshot=await get('/team?days=7',team.token).expect(200);
  assert.equal(snapshot.body.members.find(m=>m.id==='sdr').calls,1);
  await get('/team/members/sdr/activities?days=7',team.token).expect(200);
  const directory=await get('/lead-assignees',people.token).expect(200);
  assert.ok(directory.body.items.every(m=>Object.keys(m).sort().join(',')==='active,id,name'));
  for(const [token,url] of [[lead.token,'/team'],[lead.token,'/lead-assignees'],[team.token,'/lead-assignees'],[people.token,'/team'],[team.token,'/leads']]) await get(url,token).expect(403);
  for(const url of ['/members','/personal-access-tokens','/invitations']) await get(url,team.token).expect(403);
  await request(app).patch('/api/v1/leads/a').set('Authorization','Bearer '+team.token).send({expectedVersion:1,stage:'New'}).expect(403);
});
test('read adapter preserves assigned scope, owner role and token revocation during reads', async () => {
  const {store,get,pat}=await fixture();
  const issued=await pat(['team:read','people:read']);
  await store.run(async tx=>{const m=await tx.get(path('members','admin'));tx.set(path('members','admin'),{...m,scope:'assigned',version:2});});
  const scoped=await get('/team',issued.token).expect(200);
  assert.equal(scoped.body.members.reduce((n,m)=>n+m.assigned,0),0);
  const original=store.query;
  let revoked=false;
  store.query=async(...args)=>{const result=await original(...args);if(!revoked&&args[0]===path('tasks')){revoked=true;await store.run(async tx=>{const token=await tx.get(path('personalAccessTokens',issued.record.id));tx.set(path('personalAccessTokens',issued.record.id),{...token,active:false});});}return result;};
  const revocationApp=createApp({store,now:()=>now,verifyToken:async()=>{throw Error('No browser auth');}});
  await request(revocationApp).get('/api/v1/team').set('Authorization','Bearer '+issued.token).expect(401);
  const next=await pat(['team:read']);
  await store.run(async tx=>{const m=await tx.get(path('members','admin'));tx.set(path('members','admin'),{...m,role:'SDR',version:3});});
  await get('/team',next.token).expect(401);
});
test('read-only task scope can read shared lead work but cannot change it',async()=>{
 const {app,get,pat}=await fixture();const issued=await pat(['tasks:read']);
 const tasks=await get('/leads/a/tasks',issued.token).expect(200);
 assert.ok(tasks.body.items.every(t=>t.leadId==='a'&&!t.canManage));
 assert.ok(!JSON.stringify(tasks.body).includes('PRIVATE'));
 await request(app).patch('/api/v1/leads/a/tasks/pending').set('Authorization','Bearer '+issued.token).set('Idempotency-Key','11111111-1111-4111-8111-111111111111').send({expectedVersion:1,state:'Completed'}).expect(403);
});
