import { pendingTtlPolicies } from "./index-readiness.mjs";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const project = process.env.GCP_PROJECT_ID || "sales-drone-avinya",
  config = JSON.parse(readFileSync("firestore.indexes.json")),
  expected = config.indexes;
const key = (i) =>
  JSON.stringify([
    i.collectionGroup || i.name?.split("/collectionGroups/")[1]?.split("/")[0],
    i.queryScope,
    i.fields.filter((f) => f.fieldPath !== "__name__"),
  ]);
const until = Date.now() + 15 * 60_000;
while (true) {
  const r = spawnSync(
    "gcloud",
    [
      "firestore",
      "indexes",
      "composite",
      "list",
      "--project",
      project,
      "--format=json",
    ],
    { encoding: "utf8" },
  );
  if (r.status) throw Error("Could not check index readiness");
  const values = JSON.parse(r.stdout),
    ready = new Set(values.filter((i) => i.state === "READY").map(key)),
    missing = expected.filter((i) => !ready.has(key(i)));
  const ttl = spawnSync(
    "gcloud",
    [
      "firestore",
      "fields",
      "ttls",
      "list",
      "--project",
      project,
      "--format=json",
    ],
    { encoding: "utf8" },
  );
  if (ttl.status) throw Error("Could not check TTL readiness");
  const pending = pendingTtlPolicies(
    config.fieldOverrides,
    JSON.parse(ttl.stdout),
  );
  if (!missing.length && !pending.length) {
    console.log(
      "All " +
        expected.length +
        " required indexes are READY and TTL policies ACTIVE.",
    );
    break;
  }
  if (Date.now() > until)
    throw Error(
      missing.length +
        " indexes / " +
        pending.length +
        " TTL policies are not ready",
    );
  console.log(
    "Waiting for " +
      missing.length +
      " indexes and " +
      pending.length +
      " TTL policies.",
  );
  await new Promise((r) => setTimeout(r, 10_000));
}
