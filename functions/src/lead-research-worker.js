import { path } from "./policy.js";
import {
  stepHygiene,
  cleanupResearchJob,
  summarizeHygiene,
} from "./lead-hygiene.js";
import { processAssistantRequest } from "./lead-assistant.js";
import {
  advanceIndexBackfill,
  processIndexJob,
} from "./lead-research-index.js";
import { RESET_STATE, resetActive } from "./lead-data-reset.js";
export async function researchWork({
  store,
  provider,
  now = () => new Date().toISOString(),
  budgetMs = 45000,
  observe = (_name, fn) => fn(),
}) {
  if (resetActive(await store.get(RESET_STATE)))
    return { processed: 0, skipped: 1 };
  const until = Date.now() + budgetMs;
  const stats = { processed: 0, failed: 0, indexed: 0 };
  // One request/page per turn for fairness; scanning cannot starve the existing
  // scoring worker. Durable cursors survive function restarts.
  for (let turn = 0; turn < 32 && Date.now() < until; turn++) {
    let work = false;
    for (const collection of ["hygieneScans", "assistantConversations"]) {
      const deleted = await store.query(path(collection), {
        filters: [["status", "==", "Deleting"]],
        limit: 1,
      });
      if (deleted.length) {
        await cleanupResearchJob(store, collection, deleted[0]);
        work = true;
      }
    }
    const scans = await store.query(path("hygieneScans"), {
      filters: [["status", "in", ["Pending", "Running"]]],
      limit: 1,
    });
    if (scans.length) {
      await observe(
        "hygiene.step",
        () => stepHygiene({ store, id: scans[0].id, now }),
        scans[0].traceparent,
      );
      stats.processed++;
      work = true;
    }
    if (turn === 0) {
      const summaries = await store.query(path("hygieneScans"), {
        filters: [["summaryStatus", "==", "Pending"]],
        limit: 1,
      });
      if (summaries.length) {
        const job = summaries[0];
        try {
          await summarizeHygiene({ store, job, provider, now });
        } catch {
          await store.run(async (tx) => {
            const j = await tx.get(path("hygieneScans", job.id));
            if (j?.version === job.version)
              tx.set(path("hygieneScans", j.id), {
                ...j,
                summaryStatus: "Failed",
                version: j.version + 1,
                updatedAt: now(),
              });
          });
          stats.failed++;
        }
        work = true;
      }
    }
    const requests = await store.query(path("assistantRequests"), {
      filters: [["status", "==", "Pending"]],
      limit: 1,
    });
    if (requests.length) {
      const r = requests[0];
      try {
        await observe(
          "assistant.step",
          () => processAssistantRequest({ store, id: r.id, provider, now }),
          r.traceparent,
        );
        stats.processed++;
      } catch {
        await store.run(async (tx) => {
          const current = await tx.get(path("assistantRequests", r.id));
          if (current?.status === "Pending")
            tx.set(path("assistantRequests", r.id), {
              ...current,
              status: "Failed",
              answer: {
                state: "Unavailable",
                text: "A verified answer is temporarily unavailable. Please ask again.",
              },
              version: current.version + 1,
              updatedAt: now(),
            });
        });
        stats.failed++;
      }
      work = true;
    }
    // Backfill is explicitly enabled by an Admin. Avoid unbounded inference at deploy.
    if (turn === 0) {
      const backfill = await advanceIndexBackfill(store);
      work ||= backfill.queued > 0;
    }
    if (Date.now() < until - 22000) {
      const jobs = await store.query(path("researchIndexJobs"), {
        filters: [["status", "==", "Pending"]],
        limit: 1,
      });
      if (jobs.length) {
        try {
          const result = await observe(
            "index.step",
            () =>
              processIndexJob({
                store,
                job: jobs[0],
                embed: provider.embed,
                now,
              }),
            jobs[0].traceparent,
          );
          stats.indexed += result.processed;
          work ||= result.processed > 0;
        } catch {
          await store.run(async (tx) => {
            const j = await tx.get(path("researchIndexJobs", jobs[0].id));
            if (j?.revision === jobs[0].revision)
              tx.set(path("researchIndexJobs", j.id), {
                ...j,
                attempts: (j.attempts || 0) + 1,
                status: (j.attempts || 0) >= 2 ? "Failed" : "Pending",
              });
          });
          stats.failed++;
          work = true;
        }
      }
    }
    if (!work) break;
  }
  return stats;
}
