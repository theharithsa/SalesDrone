import { ESLint } from "eslint";
import { readFile } from "node:fs/promises";
import { warningCounts, newWarnings } from "./lint-policy.mjs";
const eslint = new ESLint();
const results = await eslint.lintFiles([
  "functions/src",
  "scripts",
  "apps/web/src",
]);
const formatter = await eslint.loadFormatter("stylish");
console.log(formatter.format(results));
const baseline = JSON.parse(await readFile("eslint-baseline.json", "utf8"));
const added = newWarnings(
  warningCounts(results, process.cwd()),
  baseline.counts,
);
if (added.length)
  console.error("New lint warnings must be fixed:\n" + added.join("\n"));
process.exitCode = results.some((r) => r.errorCount) || added.length ? 1 : 0;
