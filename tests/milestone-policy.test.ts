import { test } from "node:test";
import assert from "node:assert/strict";
import {
  requireMilestoneReference,
  validateMilestoneSnapshot,
  closingIssueNumbers,
  nextReleaseVersion,
  verifyGitHubMilestone,
} from "../scripts/milestone-policy.mjs";
const plan = () => ({
  version: "2.6.0",
  milestone: {
    number: 5,
    title: "v2.6.0 — Lead research",
    issues: [95, 96],
    readiness: "planning",
  },
});
const milestone = { number: 5, title: "v2.6.0 — Lead research", state: "open" };
const issues = () =>
  [95, 96].map((number) => ({
    number,
    state: "open",
    milestone: { number: 5 },
  }));
test("a release candidate needs a version-matched milestone with distinct assigned scope", () => {
  const p = plan();
  assert.equal(requireMilestoneReference(p).number, 5);
  for (const milestone of [
    null,
    { ...p.milestone, number: 0 },
    { ...p.milestone, title: "v2.7.0 — Different release" },
    { ...p.milestone, issues: [] },
    { ...p.milestone, issues: [95, 95] },
  ])
    assert.throws(() => requireMilestoneReference({ ...p, milestone }));
  assert.equal(nextReleaseVersion("2.5.3", "minor"), "2.6.0");
  assert.equal(nextReleaseVersion("2.5.3", "patch"), "2.5.4");
});
test("planning does not permit publication or silently changed milestone scope", () => {
  const p = plan();
  assert.doesNotThrow(() =>
    validateMilestoneSnapshot(p, milestone, issues(), { mode: "prepare" }),
  );
  assert.throws(
    () =>
      validateMilestoneSnapshot(p, milestone, issues(), {
        mode: "publication",
      }),
    /planning/,
  );
  assert.throws(
    () =>
      validateMilestoneSnapshot(p, milestone, [
        ...issues(),
        { number: 98, state: "open", milestone: { number: 5 } },
      ]),
    /scope changed/,
  );
  assert.throws(
    () =>
      validateMilestoneSnapshot(p, milestone, [
        { ...issues()[0], milestone: { number: 4 } },
        issues()[1],
      ]),
    /assigned/,
  );
});
test("PR verification allows only covered open issues; publication requires closed milestone issues", () => {
  const p = plan();
  p.milestone.readiness = "ready";
  assert.throws(
    () =>
      validateMilestoneSnapshot(p, milestone, issues(), {
        mode: "pull_request",
        closingIssues: [95],
      }),
    /Open milestone/,
  );
  assert.doesNotThrow(() =>
    validateMilestoneSnapshot(p, milestone, issues(), {
      mode: "pull_request",
      closingIssues: [95, 96],
    }),
  );
  assert.throws(
    () =>
      validateMilestoneSnapshot(p, milestone, issues(), {
        mode: "publication",
      }),
    /completed/,
  );
  assert.doesNotThrow(() =>
    validateMilestoneSnapshot(
      p,
      milestone,
      issues().map((i) => ({ ...i, state: "closed" })),
      { mode: "publication" },
    ),
  );
  assert.throws(
    () =>
      validateMilestoneSnapshot(
        p,
        { ...milestone, state: "closed" },
        issues(),
        { mode: "prepare" },
      ),
    /open planned/,
  );
});
test("closing references are repository-specific and do not treat ordinary mentions as completion", () => {
  assert.deepEqual(
    closingIssueNumbers(
      "Refs #95. Closes #96. Fixes https://github.com/theharithsa/SalesDrone/issues/98. Fixes https://github.com/someone/else/issues/99.",
    ),
    [96, 98],
  );
});
test("GitHub verification uses bounded pages and current issue state without logging response content", async () => {
  const p = plan();
  p.milestone.readiness = "ready";
  const seen = [];
  const fetchImpl = async (url, options) => {
    seen.push({ url, options });
    return {
      ok: true,
      json: async () =>
        url.includes("/milestones/")
          ? milestone
          : issues().map((i) => ({ ...i, state: "closed" })),
    };
  };
  const result = await verifyGitHubMilestone(p, {
    token: "synthetic-token",
    fetchImpl,
  });
  assert.equal(result.open, 0);
  assert.equal(seen.length, 2);
  await assert.rejects(
    verifyGitHubMilestone(p, {
      token: "synthetic-token",
      fetchImpl: async () => ({ ok: false, status: 403 }),
    }),
    /HTTP 403/,
  );
  await assert.rejects(verifyGitHubMilestone(p, { fetchImpl }), /token/);
});
