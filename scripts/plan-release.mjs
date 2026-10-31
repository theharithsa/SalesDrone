import { readFile, writeFile, access } from "node:fs/promises";
import {
  nextReleaseVersion,
  requireMilestoneReference,
  readMilestoneWithGh,
  validateMilestoneSnapshot,
} from "./milestone-policy.mjs";
const args = process.argv.slice(2),
  bump = args.shift();
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const number = Number(option("--milestone")),
  issues = String(option("--issues") || "")
    .split(",")
    .map(Number);
if (!number || !issues.length || issues.some((n) => !n))
  throw Error(
    "Usage: npm run release:plan -- patch|minor|major --milestone NUMBER --issues 95,96",
  );
const current = JSON.parse(await readFile("package.json", "utf8")).version,
  version = nextReleaseVersion(current, bump),
  file = `releases/${version}.json`;
try {
  await access(file);
  throw Error(
    "Existing release plan is preserved: edit " +
      file +
      " instead of overwriting it",
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const snapshot = readMilestoneWithGh(number),
  plan = JSON.parse(
    await readFile(
      "skills/salesdrone-release-readiness/assets/release-plan.template.json",
      "utf8",
    ),
  );
plan.version = version;
plan.api.contractVersion = JSON.parse(
  await readFile("docs/openapi.json", "utf8"),
).info.version;
plan.milestone = {
  number,
  title: snapshot.milestone.title,
  issues,
  readiness: "planning",
};
requireMilestoneReference(plan);
validateMilestoneSnapshot(plan, snapshot.milestone, snapshot.issues, {
  mode: "prepare",
});
await writeFile(file, JSON.stringify(plan, null, 2) + "\n", { flag: "wx" });
console.log(
  `Planned ${version} in milestone #${number}. Package versions are unchanged; complete the scoped work before publication.`,
);
