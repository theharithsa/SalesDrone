import { AppError } from './contracts.js';
import { path, hash, canReadLead } from "./policy.js";
import { readResearchSettings } from "./lead-research-settings.js";
import { researchMember } from "./lead-research-access.js";
import { scanEpoch } from "./lead-hygiene.js";
export const INDEX_STATE_PATH = path("maintenance", "leadResearchIndex");
export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768;
// Remove obvious contact tokens before embedding; exact contact matching is a
// deterministic Hygiene operation, never a semantic vector lookup.
const redact = (text) =>
  text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\+?\d[\d ()-]{6,}\d/g, "[number]");
export function sourceChunks(collection, source) {
  const text = redact(
    collection === "leads"
      ? [
          source.company,
          source.jobTitle,
          source.source,
          source.location,
          source.zone,
          source.legacyStatus,
          source.initialDiscussion,
          source.comments,
          ...Object.values(source.customFields || {}).filter(
            (v) => typeof v === "string",
          ),
        ]
          .filter(Boolean)
          .join("\n")
      : String(source.notes || ""),
  );
  const chunks = [];
  let current = [],
    bytes = 0,
    sourceBytes = 0,
    truncated = false;
  // UTF-8 byte limits bound worst-case token counts for multilingual notes,
  // rather than assuming English characters have a fixed token ratio.
  for (const char of text) {
    const size = Buffer.byteLength(char);
    if (sourceBytes + size > 12000) {
      truncated = true;
      break;
    }
    sourceBytes += size;
    if (bytes + size > 1400) {
      chunks.push(current.join(""));
      current = current.slice(-50);
      bytes = Buffer.byteLength(current.join(""));
    }
    current.push(char);
    bytes += size;
  }
  if (current.length) chunks.push(current.join(""));
  return { chunks, truncated };
}
export const sourceFingerprint = (source) => hash(JSON.stringify(source));
export async function queueIndexBackfill(tx, identity) {
  const m = await researchMember(tx, identity, ["assistant:query"]);
  if (m.role !== "Admin" || m.scope!=="all")throw new AppError(403,"FORBIDDEN","Workspace-wide Admin access is required to build the knowledge index");
  const state = await tx.get(INDEX_STATE_PATH);
  if (state?.status === "Running") return state;
  const next = {
    status: "Running",
    collection: "leads",
    after: null,
    scanned: 0,
    truncatedSources: 0,
    epoch: await scanEpoch(tx),
    ownerUid: m.uid,
  };
  tx.set(INDEX_STATE_PATH, next);
  return next;
}
export async function advanceIndexBackfill(store) {
  const settings = await readResearchSettings(store);
  if (!settings.indexingEnabled) return { queued: 0 };
  return store.run(async (tx) => {
    const state = await tx.get(INDEX_STATE_PATH);
    if (state?.status !== "Running") return { queued: 0 };
    const rows = await tx.scan(path(state.collection), {
      after: state.after,
      limit: 25,
    });
    for (const { id, data } of rows) {
      const key = hash(state.collection + ":" + id);
      tx.set(path("researchIndexJobs", key), {
        id: key,
        collection: state.collection,
        sourceId: id,
        leadId: state.collection === "leads" ? id : data.leadId || null,
        revision: sourceFingerprint(data),
        status: "Pending",
        after: null,
      });
    }
    const next = {
      ...state,
      after: rows.at(-1)?.id || state.after,
      scanned: state.scanned + rows.length,
    };
    if (rows.length < 25) {
      if (state.collection === "leads") {
        next.collection = "activities";
        next.after = null;
      } else next.status = "Queued";
    }
    tx.set(INDEX_STATE_PATH, next);
    return { queued: rows.length };
  });
}
export async function processIndexJob({
  store,
  job,
  embed,
  now = () => new Date().toISOString(),
}) {
  const settings = await readResearchSettings(store);
  if (!settings.indexingEnabled) return { processed: 0 };
  if (job.collection === "leads" && job.phase === "ACL")
    return store.run(async (tx) => {
      const current = await tx.get(path("researchIndexJobs", job.id));
      if (!current || current.revision !== job.revision)
        return { processed: 0 };
      const lead = await tx.get(path("leads", job.sourceId));
      const rows = await tx.query(path("researchChunks"), {
        filters: [["leadId", "==", job.sourceId]],
        after: job.after ? [job.after] : undefined,
        limit: 50,
      });
      for (const row of rows) {
        if (!lead || lead.archived) tx.delete(path("researchChunks", row.id));
        else {
          const vector = row.embedding;
          tx.set(path("researchChunks", row.id), {
            ...row,
            embedding: Array.isArray(vector) ? vector : vector.toArray(),
            assignedToUid: lead.assignedToUid || null,
            stage: lead.stage,
            leadVersion: lead.version,
          });
        }
      }
      if (rows.length < 50) tx.delete(path("researchIndexJobs", job.id));
      else
        tx.set(path("researchIndexJobs", job.id), {
          ...current,
          after: rows.at(-1).id,
        });
      return { processed: 1, chunks: rows.length };
    });
  const source = await store.get(path(job.collection, job.sourceId));
  const lead =
    job.collection === "leads"
      ? source
      : source?.leadId
        ? await store.get(path("leads", source.leadId))
        : null;
  const revision = source ? sourceFingerprint(source) : null;
  const data =
    source && lead && !lead.archived
      ? sourceChunks(job.collection, source)
      : { chunks: [], truncated: false };
  const baseId = hash(job.collection + ":" + job.sourceId);
  const prior = await store.query(path("researchChunks"), {
    filters: [["sourceKey", "==", baseId]],
    limit: 20,
  });
  const contentHash = hash(JSON.stringify(data.chunks));
  // Assignment/stage changes reuse embeddings; source text edits embed only changed chunks.
  const changed = data.chunks
    .map((text, i) => ({ text, i }))
    .filter(
      ({ text, i }) =>
        !prior.some(
          (p) =>
            p.part === i && p.text === text && p.contentHash === contentHash,
        ),
    );
  const embedded = changed.length
    ? await embed(
        changed.map((c) => c.text),
        "RETRIEVAL_DOCUMENT",
      )
    : [];
  const vectors = data.chunks.map((_, i) => {
    const j = changed.findIndex((c) => c.i === i);
    return j < 0 ? null : embedded[j];
  });
  return store.run(async (tx) => {
    const current = await tx.get(path("researchIndexJobs", job.id));
    const fresh = await tx.get(path(job.collection, job.sourceId));
    const freshLead =
      job.collection === "leads"
        ? fresh
        : fresh?.leadId
          ? await tx.get(path("leads", fresh.leadId))
          : null;
    if (
      !current ||
      current.revision !== job.revision ||
      (fresh ? sourceFingerprint(fresh) : null) !== revision ||
      (lead?.version || null) !== (freshLead?.version || null)
    )
      return { processed: 0, stale: 1 };
    if (!(await readResearchSettings(tx)).indexingEnabled)
      return { processed: 0 };
    const keep = new Set();
    for (let i = 0; i < data.chunks.length; i++) {
      const id = baseId + "_" + i;
      keep.add(id);
      const record = {
        id,
        sourceKey: baseId,
        collection: job.collection,
        sourceId: job.sourceId,
        sourceHash: revision,
        leadId: job.collection === "leads" ? job.sourceId : fresh.leadId,
        leadVersion: freshLead.version,
        assignedToUid: freshLead.assignedToUid || null,
        stage: freshLead.stage,
        active: !freshLead.archived,
        part: i,
        text: data.chunks[i],
        contentHash,
        model: EMBEDDING_MODEL,
        updatedAt: now(),
        truncated: data.truncated,
      };
      if (vectors[i]) record.embedding = vectors[i];
      else {
        // VectorValue stays at the Firestore adapter boundary. Read a reusable
        // vector only when needed; never serialize it into prompts/responses.
        const existing = await tx.get(path("researchChunks", id));
        const vector = existing?.embedding;
        record.embedding = Array.isArray(vector) ? vector : vector?.toArray?.();
        if (!record.embedding) return { processed: 0, stale: 1 };
      }
      tx.set(path("researchChunks", id), record);
    }
    for (const row of prior)
      if (!keep.has(row.id)) tx.delete(path("researchChunks", row.id));
    if (job.collection === "leads")
      tx.set(path("researchIndexJobs", job.id), {
        ...current,
        phase: "ACL",
        after: null,
      });
    else tx.delete(path("researchIndexJobs", job.id));
    return {
      processed: 1,
      chunks: data.chunks.length,
      truncated: Number(data.truncated),
    };
  });
}
export async function retrieveEvidence({
  store,
  identity,
  access,
  question,
  embed,
  stages = [],
  matchLead = () => true,
}) {
  const m = await researchMember(store, identity, ["assistant:query"], access);
  const filters = [
    ["active", "==", true],
    ...(m.scope === "assigned" ? [["assignedToUid", "==", m.uid]] : []),
    ...(stages.length ? [["stage", "in", stages]] : []),
  ];
  const vector = await embed(question, "RETRIEVAL_QUERY");
  const candidates = await store.nearest(path("researchChunks"), {
    filters,
    vector,
    limit: 16,
  });
  const evidence = [];
  for (const row of candidates) {
    const lead = await store.get(path("leads", row.leadId));
    if (
      !canReadLead(m, lead) ||
      lead.archived || !matchLead(lead) ||
      (stages.length && !stages.includes(lead.stage))
    )
      continue;
    const source =
      row.collection === "leads"
        ? lead
        : await store.get(path("activities", row.sourceId));
    if (!source || sourceFingerprint(source) !== row.sourceHash) continue;
    if (row.collection === "activities" && source.leadId !== row.leadId)
      continue;
    evidence.push({
      id: row.id,
      leadId: row.leadId,
      leadVersion: lead.version,
      name: lead.name || "Unnamed enquiry",
      text: row.text,
      sourceId: row.sourceId,
      collection: row.collection,
      sourceHash: row.sourceHash,
      truncated: row.truncated === true,
    });
    if (evidence.length === 8) break;
  }
  await researchMember(store, identity, ["assistant:query"], access);
  return evidence;
}
