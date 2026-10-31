import { z } from "zod";
import { AppError } from "./contracts.js";
import { path, hash, scopeFilters } from "./policy.js";
import { documentKey } from "./store.js";
import { readFieldOptions, validateCustomValues } from "./field-options.js";
import { normalizeLead } from "./leads.js";
import { researchMember, researchAccessKey } from "./lead-research-access.js";
import { readResearchSettings } from "./lead-research-settings.js";
import {
  RESEARCH_EPOCH_PATH,
  RESEARCH_TASK_EPOCH_PATH,
} from "./lead-research-store.js";
export const ScanInput = z
  .object({ includeArchived: z.boolean().default(false) })
  .strict();
export const ResearchVersion = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();
export const scanEpoch = async (store) =>
  (await store.get(RESEARCH_EPOCH_PATH))?.version || 0;
const missing = () => new AppError(404, "NOT_FOUND", "Report not found");
export async function createHygieneScan(tx, identity, id, at, options = {}) {
  const m = await researchMember(tx, identity, ["hygiene:read", "hygiene:run"]);
  const recent = await tx.query(path("hygieneScans"), {
    filters: [["ownerUid", "==", m.uid]],
    order: "createdAt",
    direction: "desc",
    limit: 5,
  });
  const queue = await tx.query(path("hygieneScans"), {
    filters: [["status", "in", ["Pending", "Running"]]],
    limit: 10,
  });
  if (queue.length >= 10)
    throw new AppError(
      429,
      "WORKSPACE_BUSY",
      "Hygiene is busy. Please try again after a report finishes.",
    );
  const sourceEpoch = await scanEpoch(tx);
  if (
    recent.some(
      (r) =>
        ["Pending", "Running"].includes(r.status) &&
        r.epoch === sourceEpoch &&
        r.access === researchAccessKey(m),
    )
  )
    throw new AppError(409, "SCAN_PENDING", "A scan is already running");
  if (
    recent.length === 5 &&
    Date.parse(at) - Date.parse(recent[4].createdAt) < 3600000
  )
    throw new AppError(429, "RATE_LIMIT", "Run at most five scans per hour");
  const settings = await readResearchSettings(tx),
    fields = await readFieldOptions(tx);
  const job = {
    id,
    ownerUid: m.uid,
    scope: m.scope,
    reportingTimezone: settings.timezone,
    traceparent: options.traceparent || null,
    includeArchived: options.includeArchived === true,
    scanningArchived: false,
    activeScanned: 0,
    archivedScanned: 0,
    access: researchAccessKey(m),
    epoch: sourceEpoch,
    taskEpoch: (await tx.get(RESEARCH_TASK_EPOCH_PATH))?.version || 0,
    status: "Pending",
    phase: "Leads",
    after: null,
    scanned: 0,
    findings: 0,
    version: 1,
    createdAt: at,
    updatedAt: at,
    settingsVersion: settings.version,
    fieldsVersion: fields.version,
    archiveReviewConfigured:
      settings.inactivityDays !== null &&
      settings.archiveReviewStages.length > 0,
    summary: null,
  };
  tx.set(path("hygieneScans", id), job);
  return job;
}
export async function readHygieneScan(store, identity, id) {
  const m = await researchMember(store, identity, ["hygiene:read"]);
  const job = await store.get(path("hygieneScans", id));
  // Reports are private even between Admins. Admin deletion is a separate action.
  if (!job || job.ownerUid !== m.uid || job.status === "Deleting")
    throw missing();
  if (job.access !== researchAccessKey(m))
    throw new AppError(
      409,
      "STALE_ACCESS",
      "Access changed. Run a new report.",
    );
  const settings = await readResearchSettings(store),
    fields = await readFieldOptions(store);
  const stale =
    job.epoch !== (await scanEpoch(store)) ||
    (job.taskEpoch || 0) !==
      ((await store.get(RESEARCH_TASK_EPOCH_PATH))?.version || 0) ||
    settings.version !== job.settingsVersion ||
    fields.version !== job.fieldsVersion;
  return stale
    ? {
        ...job,
        status: "Stale",
        scanned: null,
        activeScanned: null,
        archivedScanned: null,
        after: null,
        findings: null,
        summary: null,
        summaryStatus: null,
      }
    : job;
}
export function inspectLead(lead, fields) {
  const issues = [];
  if (!String(lead.name || "").trim()) issues.push("missing_name");
  if (!z.iso.date().safeParse(lead.enquiryDate).success)
    issues.push("invalid_enquiry_date");
  if (!lead.phone && !lead.email) issues.push("missing_contact");
  const contacts = [];
  if (lead.phone) {
    try {
      const l = normalizeLead({
        phone: lead.phone,
        countryCode: lead.countryCode || "+91",
        needsReview: true,
      });
      contacts.push({ field: "phone", value: l.phoneNormalized });
    } catch {
      issues.push("invalid_phone");
    }
  }
  if (lead.email) {
    if (z.email().safeParse(lead.email).success)
      contacts.push({ field: "email", value: lead.email.toLowerCase() });
    else issues.push("invalid_email");
  }
  if (lead.needsReview) issues.push("needs_review");
  if (!fields.values.stage.includes(lead.stage)) issues.push("retired_stage");
  try {
    validateCustomValues(
      fields,
      Object.fromEntries(
        Object.entries(lead.customFields || {}).filter(
          ([id]) => !fields.customFields.some((f) => f.id === id && f.deleted),
        ),
      ),
      {},
      true,
    );
  } catch {
    issues.push("custom_fields_need_review");
  }
  return { issues, contacts };
}
export async function stepHygiene({
  store,
  id,
  now = () => new Date().toISOString(),
}) {
  return store.run(async (tx) => {
    const job = await tx.get(path("hygieneScans", id));
    if (!job || !["Pending", "Running"].includes(job.status))
      return { processed: 0 };
    let m;
    try {
      m = await researchMember(
        tx,
        { uid: job.ownerUid },
        ["hygiene:read", "hygiene:run"],
        job.access,
      );
    } catch (e) {
      if (!["FORBIDDEN", "DEMO_ONLY", "STALE_ACCESS"].includes(e.code)) throw e;
      tx.set(path("hygieneScans", id), {
        ...job,
        status: "Stale",
        summary: null,
        version: job.version + 1,
        updatedAt: now(),
      });
      return { processed: 0, stale: 1 };
    }
    const settings = await readResearchSettings(tx),
      fields = await readFieldOptions(tx);
    if (
      (await scanEpoch(tx)) !== job.epoch ||
      (job.taskEpoch || 0) !==
        ((await tx.get(RESEARCH_TASK_EPOCH_PATH))?.version || 0) ||
      settings.version !== job.settingsVersion ||
      fields.version !== job.fieldsVersion
    ) {
      tx.set(path("hygieneScans", id), {
        ...job,
        status: "Stale",
        summary: null,
        version: job.version + 1,
        updatedAt: now(),
      });
      return { processed: 0, stale: 1 };
    }
    if (job.phase === "Dedupe") {
      const keys = await tx.scan(path("dedupeKeys"), {
        after: job.after,
        limit: 5,
      });
      let findings = job.findings;
      for (const { id: key, data } of keys) {
        const ids = Array.isArray(data.leadIds)
          ? data.leadIds.slice(0, 100)
          : [];
        const records = await tx.getAll(
          ids.map((id) => path("leads", id)),
          [
            "id",
            "name",
            "company",
            "phone",
            "email",
            "countryCode",
            "assignedToUid",
            "archived",
            "version",
          ],
        );
        const accessible = [],
          invalid = [];
        for (let i = 0; i < ids.length; i++) {
          const lead = records[i];
          if (!lead) {
            if (m.role === "Admin" && m.scope === "all") invalid.push(ids[i]);
            continue;
          }
          if (m.scope !== "all" && lead.assignedToUid !== m.uid) continue;
          accessible.push({
            id: ids[i],
            version: lead.version,
            name: lead.name || "",
            company: lead.company || "",
          });
          const contacts = inspectLead(lead, fields).contacts;
          if (!contacts.some((c) => hash(c.field + ":" + c.value) === key))
            invalid.push(ids[i]);
        }
        if (
          invalid.length ||
          (data.leadIds?.length > 100 &&
            (m.scope === "all" || accessible.length))
        ) {
          const fid = job.id + "_index_" + key;
          tx.set(path("hygieneFindings", fid), {
            id: fid,
            jobId: job.id,
            kind: "IndexReview",
            count: invalid.length,
            issues: [
              ...(invalid.length ? ["contact_index_needs_review"] : []),
              ...(data.leadIds?.length > 100
                ? ["contact_index_verification_limited"]
                : []),
            ],
            leadIds: accessible.slice(0, 20).map((l) => l.id),
            leads: accessible.slice(0, 20),
            verificationLimited: (data.leadIds?.length || 0) > 100,
          });
          findings++;
        }
      }
      const complete = keys.length < 5,
        at = now();
      tx.set(path("hygieneScans", id), {
        ...job,
        status: complete ? "Completed" : "Running",
        after: keys.at(-1)?.id || job.after,
        findings,
        version: job.version + 1,
        updatedAt: at,
        ...(complete ? { completedAt: at } : {}),
      });
      return { processed: keys.length, completed: Number(complete) };
    }
    const rows = await tx.query(path("leads"), {
      filters: [
        ...scopeFilters(m),
        ["archived", "==", job.scanningArchived === true],
      ],
      order: "__name__",
      after: job.after ? [job.after] : undefined,
      limit: 25,
    });
    // Multiple records in the page may share a key. Stage updates locally, then
    // flush once per key; reading a buffered write is not a supported store API.
    const indexKeys = new Map();
    const groups = new Map(),
      evidence = [];
    let findings = job.findings;
    for (const lead of rows) {
      const leadId = documentKey(lead),
        ref = {
          id: leadId,
          version: lead.version,
          name: lead.name || "",
          company: lead.company || "",
          stage: lead.stage || "",
          source: lead.source || "",
          enquiryDate: lead.enquiryDate || "",
          imported: !!lead.importId,
        };
      const { issues, contacts } = inspectLead(lead, fields);
      let archiveEvidence = null;
      if (
        !job.scanningArchived &&
        settings.inactivityDays !== null &&
        fields.values.stage.includes(lead.stage) &&
        settings.archiveReviewStages.includes(lead.stage)
      ) {
        // Creation/import time is not evidence of inactivity. Require actual
        // recorded contact and no pending task; expose only eligibility, no tasks.
        const last = Date.parse(lead.lastContactAt);
        if (
          Number.isFinite(last) &&
          Date.parse(now()) - last >= settings.inactivityDays * 86400000
        ) {
          const tasks = await tx.query(path("tasks"), {
            filters: [
              ["leadId", "==", leadId],
              ["state", "==", "Pending"],
            ],
            limit: 1,
          });
          if (!tasks.length) {
            issues.push("archive_review");
            archiveEvidence = {
              lastContactAt: lead.lastContactAt,
              inactivityDays: settings.inactivityDays,
              stage: lead.stage,
              noPendingTasks: true,
            };
          }
        }
      }
      for (const contact of contacts) {
        const contactKey = hash(contact.field + ":" + contact.value);
        if (!indexKeys.has(contactKey))
          indexKeys.set(
            contactKey,
            await tx.get(path("dedupeKeys", contactKey)),
          );
        const key = indexKeys.get(contactKey);
        if (
          !key?.leadIds?.includes(leadId) &&
          !issues.includes("contact_index_missing")
        )
          issues.push("contact_index_missing");
      }
      if (issues.length) {
        const fid = id + "_lead_" + hash(leadId);
        evidence.push([
          path("hygieneFindings", fid),
          {
            id: fid,
            jobId: id,
            kind: "Review",
            leadIds: [leadId],
            leads: [ref],
            issues,
            count: 1,
            archived: job.scanningArchived === true,
            archiveEvidence,
          },
        ]);
        findings++;
      }
      for (const contact of contacts) {
        const key = hash(contact.field + ":" + contact.value),
          fid =
            id +
            "_contact_" +
            (job.scanningArchived ? "archive_" : "active_") +
            key;
        if (!groups.has(fid))
          groups.set(
            fid,
            (await tx.get(path("hygieneFindings", fid))) || {
              id: fid,
              jobId: id,
              kind: "SharedContact",
              archived: job.scanningArchived === true,
              firstName: String(lead.name || "")
                .normalize("NFKC")
                .trim()
                .toLowerCase(),
              sameName: true,
              hasUnnamed: false,
              field: contact.field,
              value: contact.value,
              count: 0,
              leadIds: [],
              leads: [],
            },
          );
        const g = groups.get(fid);
        g.count++;
        const normalizedName = String(lead.name || "")
          .normalize("NFKC")
          .trim()
          .toLowerCase();
        g.sameName &&= !!normalizedName && normalizedName === g.firstName;
        g.hasUnnamed ||= !normalizedName;
        g.comparison = g.hasUnnamed
          ? "Includes unnamed enquiries"
          : g.sameName
            ? "Matching names and contact — possible duplicates"
            : "Different named enquiries share this contact";
        if (g.count === 2) findings++;
        if (g.leadIds.length < 20) {
          g.leadIds.push(leadId);
          g.leads.push(ref);
        }
        const eid =
          id +
          "_" +
          (job.scanningArchived ? "archive_" : "active_") +
          key +
          "_" +
          hash(leadId);
        evidence.push([
          path("hygieneEvidence", eid),
          { id: eid, jobId: id, findingId: fid, leadId, lead: ref },
        ]);
      }
    }
    for (const [p, v] of evidence) tx.set(p, v);
    for (const [fid, v] of groups) tx.set(path("hygieneFindings", fid), v);
    const endLeads = rows.length < 25,
      at = now();
    tx.set(path("hygieneScans", id), {
      ...job,
      status: "Running",
      phase:
        endLeads && !(job.includeArchived && !job.scanningArchived)
          ? "Dedupe"
          : "Leads",
      scanningArchived:
        endLeads && job.includeArchived && !job.scanningArchived
          ? true
          : job.scanningArchived,
      after: endLeads ? null : documentKey(rows.at(-1)),
      scanned: job.scanned + rows.length,
      activeScanned:
        (job.activeScanned || 0) + (job.scanningArchived ? 0 : rows.length),
      archivedScanned:
        (job.archivedScanned || 0) + (job.scanningArchived ? rows.length : 0),
      findings,
      version: job.version + 1,
      updatedAt: at,
    });
    return { processed: rows.length, completed: 0 };
  });
}
export async function deleteHygieneScan(tx, identity, id, expectedVersion, at) {
  const m = await researchMember(tx, identity, ["hygiene:read"]);
  if (m.role !== "Admin")
    throw new AppError(403, "FORBIDDEN", "Only Admins can delete reports");
  const job = await tx.get(path("hygieneScans", id));
  if (!job) throw missing();
  if (job.version !== expectedVersion)
    throw new AppError(409, "STALE_VERSION", "Refresh before deleting");
  tx.set(path("hygieneScans", id), {
    ...job,
    status: "Deleting",
    summary: null,
    version: job.version + 1,
    updatedAt: at,
  });
  return { id, status: "Deleting" };
}
export async function cleanupResearchJob(store, collection, job) {
  return store.run(async (tx) => {
    const current = await tx.get(path(collection, job.id));
    if (!current || current.status !== "Deleting") return;
    const children =
      collection === "hygieneScans"
        ? ["hygieneFindings", "hygieneEvidence"]
        : ["assistantMessages", "assistantRequests", "assistantContributions"];
    for (const child of children) {
      const rows = await tx.query(path(child), {
        filters: [["jobId", "==", job.id]],
        limit: 50,
      });
      if (rows.length) {
        for (const row of rows) tx.delete(path(child, row.id));
        return;
      }
    }
    tx.delete(path(collection, job.id));
  });
}
export async function summarizeHygiene({
  store,
  job,
  provider,
  now = () => new Date().toISOString(),
}) {
  const current = await readHygieneScan(store, { uid: job.ownerUid }, job.id);
  await researchMember(
    store,
    { uid: job.ownerUid },
    ["hygiene:read", "hygiene:ai"],
    job.access,
  );
  if (current.status !== "Completed") return;
  const rows = await store.query(path("hygieneFindings"), {
    filters: [["jobId", "==", job.id]],
    limit: 20,
  });
  const sources = rows
    .filter((r) => r.kind !== "SharedContact" || r.count > 1)
    .slice(0, 8)
    .map((r) => ({
      id: r.id,
      text:
        r.kind === "SharedContact"
          ? `${r.count} ${r.archived ? "archived" : "active"} enquiries share a ${r.field}. Shared contact is not proof of duplicate enquiries.`
          : `Review flags: ${r.issues.join(", ")}.`,
    }));
  const raw = await provider.themes({
    question:
      "Describe the reported data-quality findings. Do not recommend automatic archive, deletion or merging. These are a bounded sample of findings.",
    evidence: sources,
  });
  const themes = raw.themes.filter(
    (t) =>
      !/[0-9]/.test(t.label) &&
      t.evidence.every((e) =>
        sources.some((s) => s.id === e.sourceId && s.text.includes(e.quote)),
      ),
  );
  await store.run(async (tx) => {
    const latest = await readHygieneScan(tx, { uid: job.ownerUid }, job.id);
    await researchMember(
      tx,
      { uid: job.ownerUid },
      ["hygiene:read", "hygiene:ai"],
      job.access,
    );
    if (latest.status !== "Completed" || latest.version !== job.version) return;
    tx.set(path("hygieneScans", job.id), {
      ...latest,
      summaryStatus: "Completed",
      summary: {
        themes,
        sampledFindings: sources.length,
        totalFindings: job.findings,
      },
      version: latest.version + 1,
      updatedAt: now(),
    });
  });
}
