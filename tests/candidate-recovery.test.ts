import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateCandidateRecovery,
  verifyCandidateRecovery,
} from "../scripts/candidate-recovery.mjs";
import { assertUniqueIndexes } from "../scripts/index-readiness.mjs";
const base = "a".repeat(40),
  prior = "b".repeat(40);
const record = {
  schemaVersion: 1,
  version: "2.6.0",
  baseCommit: base,
  priorPublishedVersion: "2.5.3",
  priorPublishedCommit: prior,
  failedRun: 12,
  failedJob: 34,
  reason: "Duplicate index blocked unpublished candidate",
};
const expected = { version: "2.6.0", baseCommit: base };
const evidence = () => ({
  run: {
    id: 12,
    status: "completed",
    conclusion: "failure",
    head_sha: base,
    head_branch: "main",
  },
  job: {
    id: 34,
    run_id: 12,
    name: "deploy",
    conclusion: "failure",
    steps: [
      { name: "Deploy Firestore rules and indexes", conclusion: "failure" },
      { name: "Deploy Cloud Functions", conclusion: "skipped" },
      { name: "Deploy Firebase Hosting", conclusion: "skipped" },
    ],
  },
  live: { version: "2.5.3", commit: prior },
  tagStatus: 404,
  releaseStatus: 404,
});
test("unpublished recovery binds failed main execution, skipped app deploy, older live release and absent tag/release", () => {
  assert.equal(validateCandidateRecovery(record, expected, evidence()), true);
  for (const change of [
    (e) => (e.run.head_sha = "c".repeat(40)),
    (e) => (e.run.status = "in_progress"),
    (e) => (e.job.steps[1].conclusion = "success"),
    (e) => (e.live.commit = base),
    (e) => (e.tagStatus = 200),
    (e) => (e.releaseStatus = 200),
  ]) {
    const e = evidence();
    change(e);
    assert.throws(() => validateCandidateRecovery(record, expected, e));
  }
  assert.throws(() =>
    validateCandidateRecovery(
      record,
      { ...expected, baseCommit: "c".repeat(40) },
      evidence(),
    ),
  );
  assert.throws(() =>
    validateCandidateRecovery(
      { ...record, priorPublishedVersion: "2.6.1" },
      expected,
      evidence(),
    ),
  );
});
test("verification never sends GitHub credentials to Hosting and fails closed on unavailable evidence", async () => {
  const data = evidence();
  let calls = 0;
  const fetchImpl = async (url, options) => {
    calls++;
    if (url.includes("firebaseapp")) {
      assert.equal(options.headers.Authorization, undefined);
      return { ok: true, status: 200, json: async () => data.live };
    }
    assert.equal(options.headers.Authorization, "Bearer synthetic");
    if (url.includes("/git/ref/") || url.includes("/releases/tags/"))
      return { ok: false, status: 404 };
    return {
      ok: true,
      status: 200,
      json: async () => (url.includes("/jobs/") ? data.job : data.run),
    };
  };
  assert.equal(
    await verifyCandidateRecovery(record, expected, {
      token: "synthetic",
      fetchImpl,
    }),
    true,
  );
  assert.equal(calls, 5);
  await assert.rejects(
    verifyCandidateRecovery(record, expected, {
      token: "synthetic",
      fetchImpl: async () => ({ ok: false, status: 503 }),
    }),
  );
});
test("duplicate index guard canonicalizes object keys while preserving query field order", () => {
  const a = {
    collectionGroup: "assistantRequests",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "jobId", order: "ASCENDING" },
      { fieldPath: "id", order: "DESCENDING" },
    ],
  };
  assert.throws(
    () =>
      assertUniqueIndexes([
        a,
        {
          fields: a.fields,
          queryScope: "COLLECTION",
          collectionGroup: "assistantRequests",
        },
      ]),
    /Duplicate/,
  );
  assert.equal(
    assertUniqueIndexes([a, { ...a, fields: [...a.fields].reverse() }]),
    2,
  );
});
