// Model proposals are data. Only these server-validated read operations execute.
import { z } from "zod";
import { AppError } from "./contracts.js";
import { path, canReadLead, scopeFilters, hash } from "./policy.js";
import { documentKey } from "./store.js";
import {
  reportingDate,
  calendarMonthWindow,
} from "./lead-research-settings.js";
export const AgentPlan = z
  .object({
    tool: z.enum([
      "find_leads",
      "find_own_followups",
      "aggregate_leads",
      "aggregate_stage_history",
      "retrieve_evidence",
      "read_hygiene_findings",
      "clarify",
      "out_of_scope",
    ]),
    filters: z
      .array(
        z
          .object({
            field: z.string().max(100),
            operator: z.enum(["equals", "contains", "before", "after"]),
            value: z.string().max(200),
          })
          .strict(),
      )
      .max(8),
    groupBy: z.string().max(100),
    outcome: z.enum(["none", "converted", "failed"]),
    period: z
      .object({
        unit: z.enum(["none", "day", "week", "month", "range"]),
        offset: z.number().int().min(-120).max(120),
        startDate: z.string().max(10),
        endDate: z.string().max(10),
      })
      .strict(),
    dateField: z.string().max(100),
  })
  .strict();
const standard = {
  name: "text",
  company: "text",
  source: "select",
  location: "select",
  zone: "select",
  legacyStatus: "select",
  stage: "select",
  enquiryDate: "date",
  createdAt: "date",
  updatedAt: "date",
};
export function assistantFields(config) {
  const fields = Object.entries(standard)
    .filter(([id]) => id === "stage" || !config.hiddenFields.includes(id))
    .map(([id, type]) => ({
      id,
      label: config.labels[id] || id,
      type,
      options: config.values[id] || [],
    }));
  return [
    ...fields,
    ...config.customFields
      .filter((f) => !f.deleted)
      .map((f) => ({
        id: "customFields." + f.id,
        label: f.label,
        type: f.type,
        options: f.options || [],
      })),
  ];
}
const valueAt = (lead, field) =>
  field.startsWith("customFields.")
    ? lead.customFields?.[field.slice(13)]
    : lead[field];
const normalize = (v) =>
  String(v ?? "")
    .normalize("NFKC")
    .toLowerCase();
function dateOnly(v) {
  try {
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v
    );
  } catch {
    return false;
  }
}
function shift(date, days) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function agentWindow(period, at, timezone) {
  if (period.unit === "none") return null;
  if (period.unit === "range") {
    if (
      !dateOnly(period.startDate) ||
      !dateOnly(period.endDate) ||
      period.endDate < period.startDate ||
      Date.parse(period.endDate) - Date.parse(period.startDate) > 366 * 86400000
    )
      throw new AppError(
        400,
        "AGENT_CLARIFY",
        "Choose a valid date range of at most one year.",
      );
    return {
      startDate: period.startDate,
      endDate: shift(period.endDate, 1),
      timezone,
    };
  }
  if (period.unit === "month") {
    if (period.offset <= 0)
      return calendarMonthWindow(at, timezone, period.offset);
    const day = reportingDate(at, timezone);
    const d = new Date(day.slice(0, 7) + "-01T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + period.offset);
    const startDate = d.toISOString().slice(0, 10);
    d.setUTCMonth(d.getUTCMonth() + 1);
    return { startDate, endDate: d.toISOString().slice(0, 10), timezone };
  }
  const today = reportingDate(at, timezone);
  const days = period.unit === "week" ? 7 : 1;
  const weekday = (new Date(today + "T12:00:00Z").getUTCDay() + 6) % 7;
  const start = shift(
    today,
    period.offset * days - (period.unit === "week" ? weekday : 0),
  );
  return { startDate: start, endDate: shift(start, days), timezone };
}
export function validateAgentPlan(
  plan,
  fields,
  config,
  at,
  question = null,
  history = [],
) {
  if(question!==null && /\b(not|except|exclude|excluding|without)\b/i.test(question))throw new AppError(400,'AGENT_CLARIFY','This query supports positive AND filters. Please specify the exact field values to include.');
  if(question!==null && /approv/i.test(question) && plan.period.unit!=='none' && ['createdAt','updatedAt'].includes(plan.dateField))throw new AppError(400,'AGENT_CLARIFY','Approval timing requires an actual approval-date field, not creation or last-edit dates.');
  const known = assistantFields(fields),
    byId = new Map(known.map((f) => [f.id, f]));
  for (const filter of plan.filters) {
    const f = byId.get(filter.field);
    if (
      question !== null &&
      !history.some((h) =>
        h.plan?.filters?.some(
          (old) => JSON.stringify(old) === JSON.stringify(filter),
        ),
      ) &&
      !normalize(question).includes(normalize(filter.value))
    )
      throw new AppError(
        400,
        "AGENT_CLARIFY",
        "Please state the exact configured filter value. Active means unarchived; it does not mean the New sales stage.",
      );
    if (
      !f ||
      !["text", "textarea", "select", "date", "number", "checkbox"].includes(
        f.type,
      )
    )
      throw new AppError(
        400,
        "AGENT_CLARIFY",
        "Choose a currently configured lead field.",
      );
    if (
      ["before", "after"].includes(filter.operator) &&
      !["date", "number"].includes(f.type)
    )
      throw new AppError(
        400,
        "AGENT_CLARIFY",
        "Date/number comparisons need a compatible field.",
      );
    if (f.type === "number" && !Number.isFinite(Number(filter.value)))
      throw new AppError(
        400,
        "AGENT_CLARIFY",
        "Choose a numeric comparison value.",
      );
    if (f.type === "date" && !dateOnly(filter.value))
      throw new AppError(400, "AGENT_CLARIFY", "Choose a valid calendar date.");
    if (f.type === "checkbox" && !["true", "false"].includes(filter.value))
      throw new AppError(
        400,
        "AGENT_CLARIFY",
        "Checkbox values must be true or false.",
      );
  }
  if (
    plan.tool === "read_hygiene_findings" &&
    (plan.filters.length ||
      plan.groupBy ||
      plan.period.unit !== "none" ||
      plan.outcome !== "none")
  )
    throw new AppError(
      400,
      "AGENT_CLARIFY",
      "Open Hygiene for individual finding details; this tool reads your current complete report summary.",
    );
  if (
    ["find_own_followups", "aggregate_stage_history"].includes(plan.tool) &&
    plan.dateField
  )
    throw new AppError(
      400,
      "AGENT_CLARIFY",
      "Reminder and conversion periods use actual task or transition dates.",
    );
  if (plan.groupBy && !byId.has(plan.groupBy))
    throw new AppError(
      400,
      "AGENT_CLARIFY",
      "Choose a configured grouping field.",
    );
  if (plan.outcome !== "none") {
    const stages =
      config[plan.outcome === "converted" ? "convertedStages" : "failedStages"];
    if (!stages.length || stages.some((s) => !fields.values.stage.includes(s)))
      throw new AppError(
        400,
        "AGENT_CLARIFY",
        "Setup required: an Admin must review outcome stages in Lead research settings.",
      );
  }
  if (
    plan.tool === "aggregate_stage_history" &&
    (plan.outcome !== "converted" || plan.period.unit === "none")
  )
    throw new AppError(
      400,
      "AGENT_CLARIFY",
      "Historical analytics currently require a conversion period. Other event dates need an explicit recorded field.",
    );
  if (plan.tool === "find_own_followups" && plan.period.unit === "none")
    throw new AppError(
      400,
      "AGENT_CLARIFY",
      "Choose the date range for your recorded reminders.",
    );
  if (
    plan.period.unit !== "none" &&
    !["find_own_followups", "aggregate_stage_history"].includes(plan.tool) &&
    byId.get(plan.dateField)?.type !== "date"
  )
    throw new AppError(
      400,
      "AGENT_CLARIFY",
      "Which recorded date field should define this period? A current status or last edit cannot establish when an order was approved.",
    );
  return {
    ...plan,
    filterSummary: plan.filters.map(
      (f) =>
        (byId.get(f.field)?.label || f.field) +
        " " +
        f.operator +
        " " +
        f.value,
    ),
    window: agentWindow(plan.period, at, config.timezone),
  };
}
export function matchesAgentLead(lead, plan, config) {
  if (
    plan.outcome !== "none" &&
    !config[
      plan.outcome === "converted" ? "convertedStages" : "failedStages"
    ].includes(lead.stage)
  )
    return false;
  for (const f of plan.filters) {
    const actual = valueAt(lead, f.field),
      a = normalize(actual),
      b = normalize(f.value);
    if (f.operator === "equals" && a !== b) return false;
    if (f.operator === "contains" && !a.includes(b)) return false;
    if (f.operator === "before" && !(actual < f.value)) return false;
    if (f.operator === "after" && !(actual > f.value)) return false;
  }
  if (plan.window && plan.dateField) {
    const date = String(valueAt(lead, plan.dateField) || "").slice(0, 10);
    if (!date || date < plan.window.startDate || date >= plan.window.endDate)
      return false;
  }
  return true;
}
export function leadResult(lead, detail = "") {
  return {
    id: lead.id,
    name: lead.name || "Unnamed enquiry",
    company: lead.company || "",
    stage: lead.stage || "",
    detail,
  };
}
export async function agentPage(tx, r, m, config) {
  const plan = r.agentPlan,
    followups = plan.tool === "find_own_followups",
    history = plan.tool === "aggregate_stage_history",
    hygiene = plan.tool === "read_hygiene_findings";
  if (followups && !m.capabilities.includes("tasks:read"))
    throw new AppError(
      403,
      "FORBIDDEN",
      "Task access is required to read your reminders.",
    );
  if (hygiene && !m.capabilities.includes("hygiene:read"))
    throw new AppError(
      403,
      "FORBIDDEN",
      "Hygiene access is required to read findings.",
    );
  if (hygiene) {
    const scans = await tx.query(path("hygieneScans"), {
      filters: [["ownerUid", "==", m.uid]],
      limit: 100,
    });
    const current = scans
      .filter(
        (s) =>
          s.status === "Completed" &&
          s.epoch === r.epoch &&
          s.access === r.access &&
          s.settingsVersion === r.settingsVersion &&
          s.fieldsVersion === r.fieldsVersion &&
          s.taskEpoch === r.taskEpoch,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return {
      ...r,
      phase: "Answer",
      hygiene: current
        ? {
            id: current.id,
            scanned: current.scanned,
            findings: current.findings || 0,
          }
        : null,
    };
  }
  const collection = followups
    ? "tasks"
    : history
      ? "leadTransitions"
      : "leads";
  const rows = await tx.query(path(collection), {
    filters: followups
      ? [["recipientUid", "==", m.uid]]
      : history
        ? []
        : [...scopeFilters(m), ["archived", "==", false]],
    order: "__name__",
    after: r.after ? [r.after] : undefined,
    limit: 100,
  });
  const next = {
    ...r,
    scanned: r.scanned + rows.length,
    after: rows.length ? documentKey(rows.at(-1)) : r.after,
  };
  const groups = { ...r.groups },
    pageSeen = new Set();
  for (const row of rows) {
    let lead = row,
      detail = "";
    if (followups) {
      if (
        row.recipientUid !== m.uid ||
        row.state !== "Pending" ||
        row.kind !== "outreach" ||
        !row.leadId
      )
        continue;
      const date = reportingDate(row.dueAt, config.timezone);
      if (date < plan.window.startDate || date >= plan.window.endDate) continue;
      lead = await tx.get(path("leads", row.leadId));
      detail = date;
      if (!lead || lead.doNotContact || lead.needsReview) continue;
    }
    if (history) {
      const date = reportingDate(row.createdAt, config.timezone);
      if (
        !row.from ||
        !config.convertedStages.includes(row.to) ||
        config.convertedStages.includes(row.from) ||
        date < plan.window.startDate ||
        date >= plan.window.endDate
      )
        continue;
      lead = await tx.get(path("leads", row.leadId));
      detail = date;
    }
    if (
      !lead ||
      lead.archived ||
      !canReadLead(m, lead) ||
      !matchesAgentLead(
        lead,
        { ...plan, ...(history ? { outcome: "none" } : {}) },
        config,
      )
    )
      continue;
    const key = r.id + "_" + hash(lead.id),
      existing = await tx.get(path("assistantContributions", key));
    if (existing || pageSeen.has(lead.id)) continue;
    pageSeen.add(lead.id);
    tx.set(path("assistantContributions", key), {
      id: key,
      jobId: r.jobId,
      requestId: r.id,
      leadId: lead.id,
      lead: leadResult(lead, detail),
    });
    next.matched = (next.matched || 0) + 1;
    if (plan.groupBy) {
      const label = String(valueAt(lead, plan.groupBy) ?? "Not recorded").slice(
          0,
          200,
        ),
        groupKey = hash(label);
      if (groups[groupKey])
        groups[groupKey] = { label, count: groups[groupKey].count + 1 };
      else if (Object.keys(groups).length < 100)
        groups[groupKey] = { label, count: 1 };
      else next.groupOverflow = (next.groupOverflow || 0) + 1;
    }
  }
  next.groups = groups;
  if (rows.length < 100) {
    next.phase = "Answer";
    next.after = null;
  }
  return next;
}
export function agentAnswer(r, config) {
  const p = r.agentPlan;
  const coverage = {
    scanned: r.scanned,
    asOf: r.createdAt,
    timezone: config.timezone,
    cohort:
      p.tool === "find_own_followups"
        ? "Your pending outreach reminders joined to eligible accessible leads"
        : "Currently active leads within your current access",
    ...(p.window ? { window: p.window } : {}),
    filters: p.filters,
    filterSummary: p.filterSummary,
  };
  if (p.tool === "read_hygiene_findings")
    return {
      state: r.hygiene ? "Grounded" : "Insufficient",
      text: r.hygiene
        ? `Your current Hygiene report reviewed ${r.hygiene.scanned} leads and recorded ${r.hygiene.findings} findings. Open Hygiene to review record-level findings.`
        : "No current completed private Hygiene report was found. Run a new scan.",
      report: r.hygiene,
      coverage,
    };
  const partial = p.tool === "aggregate_stage_history";
  return {
    state: partial ? "Partial" : "Grounded",
    text: partial
      ? `${r.matched || 0} distinct leads have a recorded conversion in this period. Imported history may be incomplete; this is an observed count.`
      : `${r.matched || 0} matching ${p.tool === "find_own_followups" ? "leads with recorded pending outreach reminders" : "active leads"}.`,
    count: r.matched || 0,
    groups: Object.fromEntries(
      Object.values(r.groups || {}).map((g) => [g.label, g.count]),
    ),
    groupOverflow: r.groupOverflow || 0,
    hasResults: [
      "find_leads",
      "find_own_followups",
      "aggregate_stage_history",
    ].includes(p.tool),
    coverage,
  };
}
