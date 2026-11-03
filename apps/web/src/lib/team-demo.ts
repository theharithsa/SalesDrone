import type { Lead } from "./types";
export const demoAssignees = [
  { id: "demo", name: "Alex Morgan", active: true },
  { id: "demo-maya", name: "Maya Chen", active: true },
  { id: "demo-jordan", name: "Jordan Lee", active: true },
];
export function teamDemo(leads: Lead[], days: number, member?: string) {
  const now = new Date().toISOString(),
    since = new Date(
      Date.parse(now.slice(0, 10) + "T00:00:00Z") - (days - 1) * 86400000,
    ).toISOString();
  const activities = Array.from({ length: 18 }, (_, i) => ({
    id: "fictional-team-" + i,
    type: i % 3 ? "note" : "call",
    notes:
      i % 3
        ? "Confirmed the requirement and agreed to share a sample."
        : "Spoke about the next step. Follow up with the sample options.",
    outcome: i % 3 ? null : "Connected",
    createdAt: new Date(Date.now() - ((i + 1) * 86400000) / 2).toISOString(),
    revision: 1,
    actorUid: demoAssignees[i % 3].id,
    lead: {
      id: leads[i % leads.length]?.id || "demo-0",
      name: leads[i % leads.length]?.name || "Sample lead",
    },
  })).filter((a) => a.createdAt >= since);
  if (member)
    return {
      items: activities.filter((a) => a.actorUid === member),
      nextCursor: null,
    };
  const members = demoAssignees.map((m, i) => {
    const assigned = leads.filter((l) => l.assignedToUid === m.id),
      mine = activities.filter((a) => a.actorUid === m.id);
    return {
      ...m,
      role: i ? "SDR" : "Admin",
      assigned: assigned.length,
      comments: mine.filter((a) => a.type === "note").length,
      calls: mine.filter((a) => a.type === "call").length,
      connected: mine.filter((a) => a.type === "call").length,
      leadsWorked: new Set(mine.map((a) => a.lead.id)).size,
      stageChanges: 0,
      pending: i + 1,
      overdue: i === 1 ? 1 : 0,
      completed: 2 + i,
      lastActivityAt: mine[0]?.createdAt || null,
      stages: [...new Set(assigned.map((l) => l.stage))].map((label) => ({
        label,
        value: assigned.filter((l) => l.stage === label).length,
      })),
    };
  });
  return {
    generatedAt: now,
    since,
    days,
    timezone: "UTC",
    members,
    unassigned: leads.filter((l) => !l.assignedToUid).length,
    unlistedAssigned: 0,
    trend: Array.from({ length: days }, (_, i) => {
      const date = new Date(Date.now() - (days - 1 - i) * 86400000)
          .toISOString()
          .slice(0, 10),
        today = activities.filter((a) => a.createdAt.slice(0, 10) === date);
      return {
        date,
        comments: today.filter((a) => a.type === "note").length,
        calls: today.filter((a) => a.type === "call").length,
      };
    }),
  };
}
