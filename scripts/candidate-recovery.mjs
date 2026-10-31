// A failed unpublished candidate is different from maintenance of a published release.
export function validateCandidateRecovery(
  record,
  { version, baseCommit },
  evidence,
) {
  const sha = /^[a-f0-9]{40}$/;
  if (
    !record ||
    record.schemaVersion !== 1 ||
    record.version !== version ||
    record.baseCommit !== baseCommit ||
    !sha.test(baseCommit) ||
    !sha.test(record.priorPublishedCommit) ||
    !/^\d+\.\d+\.\d+$/.test(record.priorPublishedVersion) ||
    !Number.isSafeInteger(record.failedRun) ||
    record.failedRun < 1 ||
    !Number.isSafeInteger(record.failedJob) ||
    record.failedJob < 1 ||
    typeof record.reason !== "string" ||
    record.reason.length < 20
  )
    throw Error(
      "Candidate recovery must pin the exact failed base/run/job and prior published identity",
    );
  const next = version.split(".").map(Number),
    old = record.priorPublishedVersion.split(".").map(Number);
  if (
    !next.some(
      (n, i) => n > old[i] && next.slice(0, i).every((x, j) => x === old[j]),
    )
  )
    throw Error("Recovery only permits an older live release");
  const { run, job, live, tagStatus, releaseStatus } = evidence;
  if (
    run.status !== "completed" ||
    run.conclusion !== "failure" ||
    run.head_sha !== baseCommit ||
    run.id !== record.failedRun ||
    run.head_branch !== "main" ||
    job.run_id !== record.failedRun ||
    job.id !== record.failedJob ||
    job.name !== "deploy" ||
    job.conclusion !== "failure"
  )
    throw Error("Recovery requires the exact failed main deployment");
  const steps = new Map((job.steps || []).map((s) => [s.name, s.conclusion]));
  if (
    steps.get("Deploy Firestore rules and indexes") !== "failure" ||
    steps.get("Deploy Cloud Functions") !== "skipped" ||
    steps.get("Deploy Firebase Hosting") !== "skipped"
  )
    throw Error(
      "Candidate recovery cannot authorize partially published application code",
    );
  if (
    live.version !== record.priorPublishedVersion ||
    live.commit !== record.priorPublishedCommit ||
    tagStatus !== 404 ||
    releaseStatus !== 404
  )
    throw Error(
      "Candidate has been published or live identity changed; use a forward version",
    );
  return true;
}
export async function verifyCandidateRecovery(
  record,
  expected,
  { repository = "theharithsa/SalesDrone", token, fetchImpl = fetch } = {},
) {
  if (!token || repository !== "theharithsa/SalesDrone")
    throw Error(
      "Read-only GitHub access is required to verify unpublished recovery",
    );
  const request = async (url, allowMissing = false) => {
    const github = url.startsWith("https://api.github.com/");
    const r = await fetchImpl(url, {
      headers: github
        ? {
            Authorization: "Bearer " + token,
            Accept: "application/vnd.github+json",
          }
        : {},
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (r.status === 404 && allowMissing) return { status: 404 };
    if (!r.ok)
      throw Error("Cannot verify candidate recovery: HTTP " + r.status);
    return { status: r.status, data: await r.json() };
  };
  const root = "https://api.github.com/repos/" + repository;
  const [run, job, live, tag, release] = await Promise.all([
    request(root + "/actions/runs/" + record.failedRun),
    request(root + "/actions/jobs/" + record.failedJob),
    request(
      "https://sales-drone-avinya.firebaseapp.com/version.json?candidate-recovery=" +
        record.baseCommit,
    ),
    request(
      root + "/git/ref/tags/v" + encodeURIComponent(expected.version),
      true,
    ),
    request(
      root + "/releases/tags/v" + encodeURIComponent(expected.version),
      true,
    ),
  ]);
  return validateCandidateRecovery(record, expected, {
    run: run.data,
    job: job.data,
    live: live.data,
    tagStatus: tag.status,
    releaseStatus: release.status,
  });
}
