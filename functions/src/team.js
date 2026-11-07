import { assertAdmin } from "./personal-access-tokens.js";
import { AppError } from "./contracts.js";
import { path, requireMember, sameAccess, scopeFilters } from "./policy.js";

export function teamDays(raw = "30") {
  if (!["7", "30", "90"].includes(String(raw)))
    throw new AppError(400, "TEAM_PERIOD", "Choose 7, 30 or 90 days");
  return Number(raw);
}
export const teamSince = (now, days) =>
  new Date(
    Date.parse(now.slice(0, 10) + "T00:00:00Z") - (days - 1) * 86400000,
  ).toISOString();
export function teamWindow(now, query) {
  if (query.from === undefined && query.to === undefined) {
    const days = teamDays(query.days);
    return { since: teamSince(now, days), until: now, days, explicit: false };
  }
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  const from = Date.parse(query.from), to = Date.parse(query.to);
  if (!iso.test(query.from) || !iso.test(query.to) || !Number.isFinite(from) ||
      !Number.isFinite(to) || new Date(from).toISOString() !== query.from ||
      new Date(to).toISOString() !== query.to || to <= from || to - from > 90 * 86400000)
    throw new AppError(400, "TEAM_PERIOD", "Choose a valid date range of up to 90 days");
  const since = query.from;
  const until = query.to;
  const days = 1 + Math.round((Date.parse(until.slice(0, 10)) - Date.parse(since.slice(0, 10))) / 86400000);
  return { since, until, days, explicit: true };
}
export async function assertTeamAccess(store, identity, before) {
  const current = await requireMember(store, identity, identity.personalAccess ? "leads:read" : "members:write");
  assertAdmin(current);
  if (before && !sameAccess(current, before))
    throw new AppError(409, "TEAM_STALE", "Access changed. Refresh Team.");
  return current;
}
async function scan(store, collection, filters, max, fields, order = "id") {
  const rows = [];
  let after;
  while (rows.length <= max) {
    const limit = Math.min(250, max + 1 - rows.length);
    const page = await store.query(path(collection), {
      filters,
      fields,
      order,
      direction: "asc",
      limit,
      after,
    });
    rows.push(...page);
    if (rows.length > max)
      throw new AppError(
        413,
        "TEAM_LIMIT",
        "Team data exceeds the safe reporting limit. Choose a shorter period or contact an administrator.",
      );
    if (page.length < limit) break;
    const last = page.at(-1);
    after = order === "id" ? [last.id] : [last[order], last.id];
  }
  return rows;
}
const memberView = (m) => ({
  id: m.uid || m.id,
  name:
    typeof m.name === "string" && !m.name.includes("@")
      ? m.name
      : "Member unavailable",
  role: m.role,
  active: !!m.active,
});
export async function teamSnapshot(store, member, now, period) {
  const { since, until, days } = typeof period === "number" ? teamWindow(now, { days: period }) : period;
  const [members, leads, activities, tasks, transitions] = await Promise.all([
    scan(store, "members", [], 200, ["id", "uid", "name", "role", "active"]),
    scan(store, "leads", scopeFilters(member), 5000, [
      "id",
      "name",
      "stage",
      "assignedToUid",
      "archived",
    ]),
    scan(
      store,
      "activities",
      [["createdAt", ">=", since], ["createdAt", "<=", until]],
      10000,
      [
        "id",
        "leadId",
        "actorUid",
        "type",
        "outcome",
        "createdAt",
        "imported",
        "importId",
      ],
      "createdAt",
    ),
    scan(store, "tasks", [], 5000, [
      "id",
      "leadId",
      "recipientUid",
      "state",
      "dueAt",
      "deleted",
      "completedAt",
    ]),
    scan(
      store,
      "leadTransitions",
      [["createdAt", ">=", since], ["createdAt", "<=", until]],
      10000,
      ["id", "leadId", "actorUid", "from", "createdAt", "reason"],
      "createdAt",
    ),
  ]);
  const leadMap = new Map(leads.map((l) => [l.id, l]));
  const rows = members.map((m) => ({
    ...memberView(m),
    assigned: 0,
    comments: 0,
    calls: 0,
    connected: 0,
    leadsWorked: 0,
    stageChanges: 0,
    pending: 0,
    overdue: 0,
    completed: 0,
    lastActivityAt: null,
    stages: [],
  }));
  const byId = new Map(rows.map((r) => [r.id, r])),
    worked = new Map(),
    stages = new Map();
  const trend = Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.parse(since.slice(0, 10)) + i * 86400000)
      .toISOString()
      .slice(0, 10),
    comments: 0,
    calls: 0,
  }));
  const touch = (r, a) => {
    if (!worked.has(r.id)) worked.set(r.id, new Set());
    worked.get(r.id).add(a.leadId);
    if (!r.lastActivityAt || a.createdAt > r.lastActivityAt)
      r.lastActivityAt = a.createdAt;
  };
  let unassigned = 0,
    unlistedAssigned = 0;
  for (const l of leads.filter((l) => !l.archived)) {
    const r = byId.get(l.assignedToUid);
    if (!r) {
      if (l.assignedToUid) unlistedAssigned++;
      else unassigned++;
      continue;
    }
    r.assigned++;
    if (!stages.has(r.id)) stages.set(r.id, new Map());
    const s = stages.get(r.id),
      label = l.stage || "Not recorded";
    s.set(label, (s.get(label) || 0) + 1);
  }
  for (const a of activities) {
    const r = byId.get(a.actorUid);
    if (
      !r ||
      !leadMap.has(a.leadId) ||
      a.imported ||
      a.importId ||
      a.createdAt > until || a.createdAt > now ||
      !["note", "call"].includes(a.type)
    )
      continue;
    touch(r, a);
    const key = a.type === "call" ? "calls" : "comments";
    r[key]++;
    if (a.type === "call" && a.outcome === "Connected") r.connected++;
    const bucket = trend.find((t) => t.date === a.createdAt.slice(0, 10));
    if (bucket) bucket[key]++;
  }
  for (const a of transitions) {
    const r = byId.get(a.actorUid);
    if (
      r &&
      leadMap.has(a.leadId) &&
      a.from &&
      a.createdAt <= until && a.createdAt <= now &&
      !String(a.reason).startsWith("import")
    ) {
      r.stageChanges++;
      touch(r, a);
    }
  }
  for (const t of tasks) {
    if (t.deleted || !t.leadId || !leadMap.has(t.leadId)) continue;
    const r = byId.get(t.recipientUid);
    if (!r) continue;
    if (t.state === "Pending") {
      r.pending++;
      if (t.dueAt < now) r.overdue++;
    }
    if (
      t.state === "Completed" &&
      t.completedAt >= since &&
      t.completedAt <= until && t.completedAt <= now
    )
      r.completed++;
  }
  for (const r of rows) {
    r.leadsWorked = worked.get(r.id)?.size || 0;
    r.stages = [...(stages.get(r.id) || [])].map(([label, value]) => ({
      label,
      value,
    }));
  }
  rows.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return {
    generatedAt: now,
    since,
    until,
    days,
    timezone: "UTC",
    members: rows,
    unassigned,
    unlistedAssigned,
    trend,
    limits: {
      members: 200,
      leads: 5000,
      activities: 10000,
      tasks: 5000,
      transitions: 10000,
    },
  };
}
export function authoredActivity(a) {
  return ["note", "call"].includes(a.type) && !a.imported && !a.importId;
}
