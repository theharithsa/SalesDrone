import { test } from "node:test";
import assert from "node:assert/strict";
import { createCursorCodec, requireCursorSecret } from "../src/cursors.js";
import { memoryStore, firestoreStore } from "../src/store.js";
import { rateLimitExpiry } from "../src/rate-limit.js";
import { DEFAULT_GEMINI_MODEL, resolveModel } from "../src/model-config.js";
test("production cursors require stable configuration and survive across app instances", () => {
  for (const value of [undefined, null, "", "   "])
    assert.throws(() => requireCursorSecret(value), /CURSOR_SECRET/);
  assert.throws(() => createCursorCodec(), /CURSOR_SECRET/);
  const first = createCursorCodec("synthetic-stable-key"),
    second = createCursorCodec("synthetic-stable-key");
  const token = first.encode(["one"], "member:v1");
  assert.deepEqual(second.decode(token, "member:v1"), ["one"]);
  for (const [cursor, binding] of [
    [token, "member:v2"],
    [token + ".extra", "member:v1"],
    [token + "x", "member:v1"],
  ])
    assert.throws(
      () => second.decode(cursor, binding),
      (e) => e.code === "CURSOR",
    );
  assert.throws(
    () => createCursorCodec("rotated").decode(token, "member:v1"),
    (e) => e.code === "CURSOR",
  );
  assert.ok(
    createCursorCodec(undefined, { allowEphemeral: true }).encode([], "local"),
  );
  let ready = false;
  const lazy = createCursorCodec(() => {
    assert.ok(ready);
    return "runtime-secret";
  });
  ready = true;
  assert.ok(lazy.encode([], "binding"));
});
test("batch reads preserve positional nulls, clone isolation and Firestore transaction read ordering", async () => {
  const memory = memoryStore({ "rows/a": { id: "a" } });
  const values = await memory.getAll(["rows/a", "rows/missing", "rows/a"]);
  assert.deepEqual(values, [{ id: "a" }, null, { id: "a" }]);
  values[0].id = "changed";
  assert.equal((await memory.get("rows/a")).id, "a");
  const calls = [];
  const tx = {
    getAll: async (...refs) => {
      calls.push("read");
      return refs.map((ref) => ({
        exists: ref === "rows/a",
        data: () => ({ id: "a" }),
      }));
    },
    set: () => calls.push("write"),
  };
  const db = {
    doc: (p) => p,
    runTransaction: (fn) => fn(tx),
    getAll: tx.getAll,
  };
  const store = firestoreStore(db);
  assert.deepEqual(await store.getAll([]), []);
  await store.run(async (r) => {
    r.set("rows/b", { id: "b" });
    assert.deepEqual(await r.getAll(["rows/a", "rows/missing"]), [
      { id: "a" },
      null,
    ]);
  });
  assert.deepEqual(calls, ["read", "write"]);
});
test("expiry uses a serializable timestamp value and model configuration resolves lazily", () => {
  assert.equal(
    rateLimitExpiry("2026-10-30T00:00:00Z").toISOString(),
    "2026-10-31T00:00:00.000Z",
  );
  assert.equal(resolveModel(DEFAULT_GEMINI_MODEL), "gemini-3.5-flash-lite");
  let model = "test-a";
  const fn = () => model;
  assert.equal(resolveModel(fn), "test-a");
  model = "test-b";
  assert.equal(resolveModel(fn), "test-b");
});

test("legacy counter expiry backfill is bounded, resumable and does not reset counts", async () => {
  const { backfillRateLimitExpiry } = await import("../src/rate-limit.js");
  const root = "workspaces/test",
    seed = {};
  for (let i = 0; i < 105; i++)
    seed[`${root}/rateLimits/${String(i).padStart(3, "0")}`] = {
      count: 7,
      expiresAt: "2026-10-29T00:00:00.000Z",
    };
  seed[`${root}/imports/keep`] = { expiresAt: "2026-10-29T00:00:00.000Z" };
  const store = memoryStore(seed);
  assert.deepEqual(await backfillRateLimitExpiry(store, root), {
    scanned: 100,
    converted: 100,
    complete: false,
  });
  assert.deepEqual(await backfillRateLimitExpiry(store, root), {
    scanned: 5,
    converted: 5,
    complete: true,
  });
  assert.deepEqual(await backfillRateLimitExpiry(store, root), {
    scanned: 0,
    converted: 0,
    complete: true,
  });
  assert.equal((await store.get(`${root}/rateLimits/104`)).count, 7);
  assert.ok(
    (await store.get(`${root}/rateLimits/104`)).expiresAt instanceof Date,
  );
  assert.equal(
    typeof (await store.get(`${root}/imports/keep`)).expiresAt,
    "string",
  );
});

test("both Gemini adapters use the runtime model override for every request", async () => {
  const { geminiExtractor } = await import("../src/gemini.js");
  const { intelligenceGemini } = await import("../src/intelligence-gemini.js");
  let model = "synthetic-a";
  const urls = [];
  const options = {
    key: "synthetic-key",
    model: () => model,
    fetchImpl: async (url) => {
      urls.push(url);
      return { ok: false, status: 403 };
    },
  };
  const reminder = geminiExtractor(options),
    intelligence = intelligenceGemini(options);
  for (const next of ["synthetic-a", "synthetic-b"]) {
    model = next;
    await assert.rejects(
      reminder({
        notes: "Synthetic",
        referenceAt: "2026-10-30T00:00:00Z",
        timezone: "UTC",
      }),
    );
    await assert.rejects(intelligence.extract({}));
    await assert.rejects(intelligence.summarize({}));
  }
  assert.deepEqual(
    urls.map((u) => u.match(/models\/([^:]+)/)[1]),
    [
      "synthetic-a",
      "synthetic-a",
      "synthetic-a",
      "synthetic-b",
      "synthetic-b",
      "synthetic-b",
    ],
  );
  assert.ok(urls.every((u) => !u.includes("synthetic-key")));
});

test('Firebase discovery defers secrets but production API initialization rejects a missing key before handling',async()=>{
 const {spawnSync}=await import('node:child_process');
 const code="import assert from 'node:assert/strict';const {api}=await import('./functions/src/index.js');await assert.rejects(api({headers:{}},{}), /CURSOR_SECRET/);";
 const result=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:new URL('../..',import.meta.url),env:{...process.env,GCLOUD_PROJECT:'demo-salesdrone',NODE_ENV:'production',FUNCTION_TARGET:'api',FUNCTIONS_EMULATOR:'false',CURSOR_SECRET:''},encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,result.stderr);
});
