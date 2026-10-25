import { readAISettings } from './ai-settings.js';
import { readFieldOptions } from './field-options.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import {
  path,
  hash,
  scopeFilters,
  requireMember,
  sameAccess,
} from './policy.js';
import { AppError } from './contracts.js';
import { readScoring, scoreView } from './scoring.js';
import { localParts } from './automatic-reminders.js';
async function scan(
  store,
  collection,
  filters,
  limit,
  order = 'id',
  direction = 'asc',
) {
  const items = [];
  let after;
  while (items.length < limit) {
    const page = await store.query(path(collection), {
      filters,
      order,
      direction,
      after,
      limit: Math.min(250, limit - items.length),
    });
    items.push(...page);
    if (page.length < Math.min(250, limit - (items.length - page.length)))
      break;
    const last = page.at(-1);
    if (!last) break;
    after = order === 'id' ? [last.id] : [last[order], last.id];
  }
  return { items, truncated: items.length === limit };
}
const counts = (items, key) =>
  Object.entries(
    items.reduce((acc, item) => {
      const label =
        String(item[key] || 'Not recorded').trim() || 'Not recorded';
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {}),
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
export async function dashboardSnapshot(
  store,
  member,
  now = new Date().toISOString(),
) {
  const [leadScan, taskScan, callScan, totalLeads, config, prefs, fields] =
    await Promise.all([
      scan(
        store,
        'leads',
        [...scopeFilters(member), ['archived', '==', false]],
        2000,
      ),
      scan(
        store,
        'tasks',
        [
          ['recipientUid', '==', member.uid],
          ['state', '==', 'Pending'],
        ],
        1000,
        'dueAt',
      ),
      scan(
        store,
        'activities',
        [
          ['actorUid', '==', member.uid],
          ['type', '==', 'call'],
        ],
        2000,
        'id',
        'desc',
      ),
      store.count(path('leads'), [
        ...scopeFilters(member),
        ['archived', '==', false],
      ]),
      readScoring(store),
      store.get('users/' + member.uid),
      readFieldOptions(store),
    ]);
  const leads = leadScan.items,
    map = new Map(leads.map((l) => [l.id, l]));
  const tasks = taskScan.items.filter(
    (t) => !t.deleted && (!t.leadId || map.has(t.leadId)),
  );
  const timezone = prefs?.timezone || 'Asia/Kolkata',
    today = localParts(now, timezone).date;
  const day = (offset) =>
    new Date(Date.parse(today + 'T12:00:00Z') + offset * 86400000)
      .toISOString()
      .slice(0, 10);
  const trend = Array.from({ length: 14 }, (_, i) => ({
    date: day(i - 13),
    calls: 0,
    connected: 0,
    newLeads: 0,
  }));
  const recentCalls = callScan.items.filter(
    (a) =>
      map.has(a.leadId) &&
      a.createdAt >= new Date(Date.parse(now) - 14 * 86400000).toISOString(),
  );
  for (const a of recentCalls) {
    const bucket = trend.find(
      (t) => t.date === localParts(a.createdAt, timezone).date,
    );
    if (bucket) {
      bucket.calls++;
      if (a.outcome === 'Connected') bucket.connected++;
    }
  }
  for (const l of leads) {
    if (!l.createdAt) continue;
    const bucket = trend.find(
      (t) => t.date === localParts(l.createdAt, timezone).date,
    );
    if (bucket) bucket.newLeads++;
  }
  const workload = [
    { label: 'Overdue', value: 0 },
    { label: 'Later today', value: 0 },
    { label: 'Tomorrow', value: 0 },
    { label: 'Next 7 days', value: 0 },
    { label: 'Later', value: 0 },
  ];
  for (const t of tasks) {
    const due = localParts(t.dueAt, timezone).date;
    workload[
      Date.parse(t.dueAt) < Date.parse(now)
        ? 0
        : due === today
          ? 1
          : due === day(1)
            ? 2
            : due <= day(7)
              ? 3
              : 4
    ].value++;
  }
  const records = [];
  for (let i = 0; i < leads.length; i += 100)
    records.push(
      ...(await Promise.all(
        leads.slice(i, i + 100).map((l) => store.get(path('leadScores', l.id))),
      )),
    );
  const scores = leads.map((l, i) => ({
    ...scoreView(config, l, records[i]),
    name: l.name,
    stage: l.stage,
    doNotContact: !!l.doNotContact,
    needsReview: !!l.needsReview,
  }));
  const ready = scores.filter((s) => s.status === 'Ready' && s.score !== null);
  const distribution = [
    {
      label: 'High priority',
      value: ready.filter((s) => s.score >= 70).length,
    },
    {
      label: 'Warm',
      value: ready.filter((s) => s.score >= 40 && s.score < 70).length,
    },
    {
      label: 'Developing',
      value: ready.filter((s) => s.score < 40 && !s.hasRisk).length,
    },
    {
      label: 'Review risks',
      value: ready.filter((s) => s.score < 40 && s.hasRisk).length,
    },
    { label: 'Not scored / unknown', value: leads.length - ready.length },
  ];
  const priority = ready
    .filter((s) => !s.doNotContact && !s.needsReview)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((s) => ({
      leadId: s.leadId,
      name: s.name,
      score: s.score,
      band: s.band,
      hasRisk: s.hasRisk,
    }));
  const calls14 = trend.reduce((n, d) => n + d.calls, 0),
    connected14 = trend.reduce((n, d) => n + d.connected, 0);
  const facts = {
    overdueTasks: workload[0].value,
    dueToday: workload[1].value,
    pendingTasks: tasks.length,
    calls14,
    connected14,
    knownScores: ready.length,
    highPriorityLeads: distribution[0].value,
    unscoredLeads: leads.length - ready.length,
  };
  const taskContext = tasks.slice(0, 25).map((t) => ({
    id: t.id,
    title: t.title,
    dueAt: t.dueAt,
    kind: t.kind,
    leadId: t.leadId,
    contactBlocked: !!(
      t.leadId &&
      (map.get(t.leadId)?.doNotContact || map.get(t.leadId)?.needsReview)
    ),
  }));
  const fingerprint = hash(
    JSON.stringify([
      member.uid,
      member.version,
      member.scope,
      member.accessPolicyVersion || 1,
      config.version,
      leads.map((l) => [l.id, l.version]),
      tasks.map((t) => [t.id, t.version]),
      recentCalls.map((a) => [a.id, a.revision]),
      records.map((r) => [r?.scoredAt || null, r?.status || null]),
      facts,
      today,
    ]),
  );
  return {
    asOf: now,
    timezone,
    fingerprint,
    facts,
    coverage: {
      leadsScanned: leads.length,
      totalLeads,
      leadsTruncated: leadScan.truncated && totalLeads > leads.length,
      tasksScanned: taskScan.items.length,
      tasksTruncated: taskScan.truncated,
      callsScanned: callScan.items.length,
      callsTruncated: callScan.truncated,
    },
    stageOrder: fields.values.stage,
    stages: counts(leads, 'stage'),
    sectors: counts(leads, 'zone'),
    cities: counts(leads, 'location'),
    outcomes: counts(recentCalls, 'outcome'),
    trend,
    workload,
    scoreDistribution: distribution,
    priority,
    tasks: taskContext.map((t) => ({
      ...t,
      leadName: map.get(t.leadId)?.name || null,
    })),
    aiContext: {
      asOf: now,
      timezone,
      facts,
      tasks: taskContext,
      priority: priority.map(({ name, ...p }) => p),
    },
  };
}
export const BriefOutput = z
  .object({
    headline: z.string().min(1).max(120),
    summary: z.string().max(600),
    insights: z
      .array(
        z
          .object({
            title: z.string().max(90),
            detail: z.string().max(450),
            type: z.enum(['priority', 'opportunity', 'hygiene']),
            taskIds: z.array(z.string()).max(4),
            leadIds: z.array(z.string()).max(4),
            facts: z
              .array(z.object({ key: z.string(), value: z.number() }).strict())
              .max(4),
          })
          .strict(),
      )
      .max(4),
  })
  .strict();
export function verifyBrief(raw, context) {
  const result = BriefOutput.parse(raw);
  const taskIds = new Set(context.tasks.map((t) => t.id)),
    leadIds = new Set([
      ...context.priority.map((p) => p.leadId),
      ...context.tasks.map((t) => t.leadId).filter(Boolean),
    ]);
  for (const insight of result.insights) {
    if (
      insight.taskIds.some((id) => !taskIds.has(id)) ||
      insight.leadIds.some((id) => !leadIds.has(id)) ||
      insight.facts.some((f) => context.facts[f.key] !== f.value)
    )
      throw new AppError(
        502,
        'AI_GROUNDING',
        'AI references could not be checked',
      );
    if (
      !insight.taskIds.length &&
      !insight.leadIds.length &&
      !insight.facts.length
    )
      throw new AppError(502, 'AI_GROUNDING', 'AI insight needs a source');
  }
  return result;
}
export async function dashboardBrief({
  store,
  member,
  snapshot,
  summarize,
  now = () => new Date().toISOString(),
}) {
  const p = `users/${member.uid}/insights/dashboard`,
    lease = randomUUID();
  const claim = await store.run(async (tx) => {
    const current = await requireMember(tx, member, 'leads:read');
    if (!sameAccess(current, member))
      throw new AppError(
        409,
        'SCOPE_CHANGED',
        'Workspace access changed; refresh',
      );
    const preferences = await readAISettings(tx);
    const fingerprint = hash(
      JSON.stringify([
        snapshot.fingerprint,
        preferences.version,
        preferences.instructions || preferences.defaultInstructions,
      ]),
    );
    const old = await tx.get(p);
    if (
      old?.fingerprint === fingerprint &&
      old.memberVersion === member.version &&
      old.status === 'Ready' &&
      old.expiresAt > now()
    )
      return { cached: old };
    if (
      old?.status === 'Processing' &&
      old.fingerprint === fingerprint &&
      old.leaseUntil > now()
    )
      return { cached: { status: 'Processing' } };
    const budgetPath = `users/${member.uid}/aiBudgets/${now().slice(0, 16).replaceAll(':', '-')}`;
    const budget = await tx.get(budgetPath);
    if ((budget?.count || 0) >= 2)
      throw new AppError(
        429,
        'AI_RATE_LIMIT',
        'Please wait a minute before generating another brief',
      );
    tx.set(budgetPath, { count: (budget?.count || 0) + 1 });
    tx.set(p, {
      status: 'Processing',
      lease,
      leaseUntil: new Date(Date.parse(now()) + 120000).toISOString(),
      fingerprint,
      memberVersion: member.version,
    });
    return {
      fingerprint,
      settingsVersion: preferences.version,
      instructions: preferences.instructions || preferences.defaultInstructions,
    };
  });
  if (claim.cached) return claim.cached;
  try {
    const raw = await summarize({
      ...snapshot.aiContext,
      workspaceGuidance: claim.instructions,
    });
    const brief = verifyBrief(raw, snapshot.aiContext);
    return await store.run(async (tx) => {
      const current = await requireMember(tx, member, 'leads:read'),
        old = await tx.get(p);
      if (!sameAccess(current, member) || old?.lease !== lease)
        throw new AppError(
          409,
          'SCOPE_CHANGED',
          'Workspace access changed; refresh',
        );
      const preferences = await readAISettings(tx);
      if (preferences.version !== claim.settingsVersion)
        throw new AppError(
          409,
          'AI_SETTINGS_CHANGED',
          'AI instructions changed. Get insights again.',
        );
      const value = {
        status: 'Ready',
        fingerprint: claim.fingerprint,
        memberVersion: member.version,
        brief,
        asOf: snapshot.asOf,
        generatedAt: now(),
        expiresAt: new Date(Date.parse(now()) + 900000).toISOString(),
      };
      tx.set(p, value);
      const id = randomUUID();
      tx.set(path('auditEvents', id), {
        id,
        actorUid: member.uid,
        action: 'dashboard.brief.generate',
        createdAt: now(),
      });
      return value;
    });
  } catch (e) {
    await store.run(async (tx) => {
      const old = await tx.get(p);
      if (old?.lease === lease)
        tx.set(p, {
          ...old,
          status: 'Failed',
          errorCode: e.code || 'AI_UNAVAILABLE',
          leaseUntil: now(),
        });
    });
    throw e;
  }
}
