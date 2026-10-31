import { execFileSync } from "node:child_process";
export const RELEASE_REPOSITORY = "theharithsa/SalesDrone";
export function nextReleaseVersion(current, bump) {
  const index = { major: 0, minor: 1, patch: 2 }[bump];
  if (index === undefined || !/^\d+\.\d+\.\d+$/.test(current))
    throw Error("Choose patch, minor or major");
  const parts = current.split(".").map(Number);
  parts[index]++;
  for (let i = index + 1; i < 3; i++) parts[i] = 0;
  return parts.join(".");
}
export function requireMilestoneReference(plan, version = plan.version) {
  if (!/^\d+\.\d+\.\d+$/.test(version) || plan.version !== version)
    throw Error("Release plan version must match the candidate");
  const m = plan.milestone;
  if (
    !m ||
    !Number.isSafeInteger(m.number) ||
    m.number < 1 ||
    typeof m.title !== "string" ||
    !m.title.startsWith("v" + version + " — ") ||
    !Array.isArray(m.issues) ||
    !m.issues.length ||
    m.issues.length > 200 ||
    m.issues.some((n) => !Number.isSafeInteger(n) || n < 1) ||
    new Set(m.issues).size !== m.issues.length ||
    !["planning", "ready"].includes(m.readiness)
  )
    throw Error(
      "Plan the versioned GitHub milestone and its scoped issues before advancing the release version",
    );
  return m;
}
export function closingIssueNumbers(body, repository = RELEASE_REPOSITORY) {
  const escaped = repository.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    "\\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\\s+(?:#(\\d+)|https://github\\.com/" +
      escaped +
      "/issues/(\\d+))\\b",
    "gi",
  );
  return [
    ...new Set(
      [...String(body || "").matchAll(pattern)].map((m) =>
        Number(m[1] || m[2]),
      ),
    ),
  ];
}
export function validateMilestoneSnapshot(
  plan,
  milestone,
  issues,
  { mode = "prepare", closingIssues = [] } = {},
) {
  if (!["prepare", "pull_request", "publication"].includes(mode))
    throw Error("Invalid release verification mode");
  const ref = requireMilestoneReference(plan);
  if (milestone.number !== ref.number || milestone.title !== ref.title)
    throw Error("GitHub milestone does not match the release plan");
  if (mode === "prepare" && milestone.state !== "open")
    throw Error("A new release candidate requires an open planned milestone");
  const actual = issues.filter((i) => !i.pull_request),
    numbers = new Set(actual.map((i) => i.number));
  if (
    numbers.size !== ref.issues.length ||
    ref.issues.some((n) => !numbers.has(n))
  )
    throw Error(
      "Milestone scope changed; reconcile the issue list before publication",
    );
  if (
    actual.some(
      (i) =>
        (typeof i.milestone === "number"
          ? i.milestone
          : i.milestone?.number) !== ref.number,
    )
  )
    throw Error("Every scoped issue must be assigned to the planned milestone");
  if (mode !== "prepare" && ref.readiness !== "ready")
    throw Error(
      "Release milestone is still in planning; expanded requirements are not ready for publication",
    );
  const open = actual
    .filter((i) => String(i.state).toLowerCase() !== "closed")
    .map((i) => i.number);
  if (mode === "pull_request" && open.some((n) => !closingIssues.includes(n)))
    throw Error(
      "Open milestone issues need verified implementation in this PR or a completed linked PR",
    );
  if (mode === "publication" && open.length)
    throw Error(
      "Production publication requires every scoped milestone issue to be completed",
    );
  return {
    milestone: ref.number,
    issues: actual.length,
    open: open.length,
    mode,
  };
}
export function readMilestoneWithGh(number, repository = RELEASE_REPOSITORY) {
  const read = (suffix) =>
    JSON.parse(
      execFileSync("gh", ["api", `repos/${repository}/${suffix}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
  try {
    const milestone = read("milestones/" + number),
      issues = [];
    for (let page = 1; page <= 20; page++) {
      const rows = read(
        `issues?milestone=${number}&state=all&per_page=100&page=${page}`,
      );
      issues.push(...rows);
      if (rows.length < 100) return { milestone, issues };
    }
  } catch {
    throw Error(
      "Cannot verify the planned GitHub milestone; check GitHub CLI access before advancing the version",
    );
  }
  throw Error("Milestone exceeds the bounded release-audit page limit");
}
export async function verifyGitHubMilestone(
  plan,
  {
    repository = RELEASE_REPOSITORY,
    token,
    mode = "publication",
    body = "",
    fetchImpl = fetch,
    apiUrl = "https://api.github.com",
  } = {},
) {
  const ref = requireMilestoneReference(plan);
  if (!token)
    throw Error(
      "Read-only GitHub token is required for release milestone verification",
    );
  const read = async (suffix) => {
    const response = await fetchImpl(
      `${apiUrl}/repos/${repository}/${suffix}`,
      {
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw Error(
        "GitHub milestone verification failed: HTTP " + response.status,
      );
    return response.json();
  };
  const milestone = await read("milestones/" + ref.number),
    issues = [];
  for (let page = 1; page <= 20; page++) {
    const rows = await read(
      `issues?milestone=${ref.number}&state=all&per_page=100&page=${page}`,
    );
    issues.push(...rows);
    if (rows.length < 100)
      return validateMilestoneSnapshot(plan, milestone, issues, {
        mode,
        closingIssues: closingIssueNumbers(body, repository),
      });
  }
  throw Error("Milestone exceeds the bounded release-audit page limit");
}
