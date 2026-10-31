import { RESET_STATE } from "./lead-data-reset.js";
import { randomUUID } from "node:crypto";
import { ROOT, hash, path } from "./policy.js";
export const RESEARCH_TASK_EPOCH_PATH = path(
  "maintenance",
  "leadResearchTasks",
);
export const RESEARCH_EPOCH_PATH = path("maintenance", "leadResearchEpoch");
// Independent of telemetry: every source mutation invalidates derived answers
// and queues index maintenance atomically with the business write, even offline.
export function researchStore(base, getTrace = () => null) {
  if (base.researchWrapped) return base;
  return {
    ...base,
    researchWrapped: true,
    run: (fn) =>
      base.run(async (tx) => {
        const epoch = await tx.get(RESEARCH_EPOCH_PATH);
        const taskEpoch = await tx.get(RESEARCH_TASK_EPOCH_PATH);
        let taskChanged = false;
        const reset = await tx.get(RESET_STATE);
        const sources = new Map();
        const track = (p, value) => {
          if (!p.startsWith(ROOT + "/")) return;
          const [, , collection, id] = p.split("/");
          if (collection === "tasks") {
            taskChanged = true;
            return;
          }
          if (!["leads", "activities"].includes(collection)) return;
          sources.set(collection + ":" + id, {
            collection,
            sourceId: id,
            leadId: collection === "leads" ? id : value?.leadId || null,
          });
        };
        const result = await fn({
          ...tx,
          set: (p, v) => {
            track(p, v);
            tx.set(p, v);
          },
          delete: (p) => {
            track(p);
            tx.delete(p);
          },
        });
        if (taskChanged)
          tx.set(RESEARCH_TASK_EPOCH_PATH, {
            version: (taskEpoch?.version || 0) + 1,
          });
        if (sources.size) {
          tx.set(RESEARCH_EPOCH_PATH, { version: (epoch?.version || 0) + 1 });
          for (const [key, source] of reset?.active ? [] : sources) {
            const id = hash(key);
            let traceparent = null;
            try {
              traceparent = getTrace() || null;
            } catch {}
            tx.set(path("researchIndexJobs", id), {
              id,
              ...source,
              traceparent,
              revision: randomUUID(),
              status: "Pending",
              after: null,
            });
          }
        }
        return result;
      }),
  };
}
