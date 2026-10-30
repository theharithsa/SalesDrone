import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, symlink, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkEntrypoint, checkDiscovery } from "../scripts/skill-guard.mjs";
import { pendingTtlPolicies } from "../scripts/index-readiness.mjs";
test("skill budgets reject release history and oversized entrypoints", () => {
  checkEntrypoint("# Module\n\n## Invariants\nCurrent behavior.", "module");
  for (const text of [
    "## v2.4 recovery",
    "## local 2.3 notes",
    Array(112).fill("line").join("\n"),
    "x".repeat(8501),
  ])
    assert.throws(() => checkEntrypoint(text, "module"));
});
test("discovery detects Windows text checkout and refuses unrelated files without mutation", async () => {
  const root = await mkdtemp(join(tmpdir(), "salesdrone-skills-"));
  try {
    await mkdir(join(root, "skills"));
    await mkdir(join(root, ".agents"));
    const p = join(root, ".agents/skills");
    await writeFile(p, "../skills\n");
    await assert.rejects(checkDiscovery(root), /core.symlinks true/);
    await rm(p);
    await writeFile(p, "keep this file");
    await assert.rejects(checkDiscovery(root), /without overwriting/);
    await rm(p);
    await symlink("../skills", p, "dir");
    await checkDiscovery(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("deployment requires configured TTL policies ACTIVE, not merely present or CREATING", () => {
  const expected = [
    { collectionGroup: "rateLimits", fieldPath: "expiresAt", ttl: true },
  ];
  const field = {
    name: "projects/demo/databases/(default)/collectionGroups/rateLimits/fields/expiresAt",
  };
  assert.equal(pendingTtlPolicies(expected, []).length, 1);
  assert.equal(
    pendingTtlPolicies(expected, [
      { ...field, ttlConfig: { state: "CREATING" } },
    ]).length,
    1,
  );
  assert.deepEqual(
    pendingTtlPolicies(expected, [
      { ...field, ttlConfig: { state: "ACTIVE" } },
    ]),
    [],
  );
});

test("component test events include hashed identity and bounded results without names or error text", async () => {
  const { componentCase } = await import(
    "../scripts/component-test-reporter.mjs"
  );
  const raw = {
    module: {
      moduleId: join(process.cwd(), "apps/web/test/workflows.test.tsx"),
    },
    fullName: "PRIVATE TITLE",
    result: () => ({ state: "failed", errors: [{ message: "PRIVATE ERROR" }] }),
    diagnostic: () => ({ duration: 10 }),
  };
  const result = componentCase(raw);
  assert.equal(result.status, "failed");
  assert.equal(result.id.length, 64);
  assert.ok(!JSON.stringify(result).includes("PRIVATE"));
  assert.equal(
    componentCase({ ...raw, module: { moduleId: "/outside/test.tsx" } }),
    null,
  );
});

test("lint ratchet rejects additional or new warning categories while allowing reductions", async () => {
  const { newWarnings } = await import("../scripts/lint-policy.mjs");
  const baseline = { "a::rule": 2 };
  assert.deepEqual(newWarnings({ "a::rule": 1 }, baseline), []);
  assert.equal(newWarnings({ "a::rule": 3 }, baseline).length, 1);
  assert.equal(newWarnings({ "b::rule": 1 }, baseline).length, 1);
});
