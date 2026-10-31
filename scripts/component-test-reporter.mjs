import { createHash } from "node:crypto";
import { mkdir, writeFile, appendFile } from "node:fs/promises";
import { relative } from "node:path";
export function componentCase(test) {
  const file = relative(process.cwd(), test.module.moduleId).replaceAll(
    "\\",
    "/",
  );
  const state = test.result().state;
  if (
    !/^apps\/web\/test\/[a-z0-9.-]+\.test\.tsx$/.test(file) ||
    !["passed", "failed", "skipped"].includes(state)
  )
    return null;
  const duration = test.diagnostic()?.duration;
  return {
    id: createHash("sha256")
      .update(file + ":" + test.fullName)
      .digest("hex"),
    file,
    status: state,
    durationMs: Number.isFinite(duration)
      ? Math.min(86400000, Math.max(0, duration))
      : 0,
    finishedAt: new Date().toISOString(),
  };
}
export default class ComponentReporter {
  async onInit() {
    await mkdir("test-results", { recursive: true });
    await writeFile("test-results/cases-components.ndjson", "");
  }
  async onTestCaseResult(test) {
    const result = componentCase(test);
    if (result)
      await appendFile(
        "test-results/cases-components.ndjson",
        JSON.stringify(result) + "\n",
      );
  }
}
