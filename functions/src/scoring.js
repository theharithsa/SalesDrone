import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { AppError } from './contracts.js';
import { path, hash } from './policy.js';
const factor = (id, label, group, weight, description) => ({
  id,
  label,
  group,
  weight,
  description,
  enabled: true,
});
export const DEFAULT_FACTORS = [
  factor(
    'account_type',
    'Commercial business profile',
    'fit',
    15,
    'Explicitly reported general contractor, major concrete/MEP subcontractor, developer or commercial builder. Never infer business size from a name.',
  ),
  factor(
    'capacity',
    'Project / bonding capacity',
    'fit',
    10,
    'Explicitly reported large commercial project volume or documented substantial bonding/project capacity. Do not invent a currency threshold.',
  ),
  factor(
    'proximity',
    'Within delivery coverage',
    'fit',
    10,
    'Explicit confirmation that the project is within the business delivery radius. A city alone does not establish proximity; no delivery-yard location has been supplied by default.',
  ),
  factor(
    'credit',
    'Commercial credit approved',
    'fit',
    10,
    'A note explicitly reports the company passed its commercial credit check or has approved payment terms. An application alone does not qualify. This is a reported claim, not verification.',
  ),
  factor(
    'licensing',
    'Licensing / certification',
    'fit',
    5,
    'Explicitly reported active contracting licence or relevant certification/safety rating. A job title or business name is not evidence of valid licensing.',
  ),
  factor(
    'bidding',
    'Active bidding / project award',
    'intent',
    12,
    'Explicit report of an active construction bid or newly awarded project; a generic enquiry is not sufficient.',
  ),
  factor(
    'rfq',
    'Detailed material RFQ',
    'intent',
    12,
    'Explicit request for a material quote with plans, take-offs, a bill of materials, quantities or detailed specifications.',
  ),
  factor(
    'samples',
    'Material samples requested',
    'intent',
    8,
    'Explicit request for physical material samples or mock-up/client approval samples.',
  ),
  factor(
    'application',
    'Credit application submitted',
    'intent',
    8,
    'Explicit report of submitting or completing a commercial credit account application. An intention to apply is not submission.',
  ),
  factor(
    'urgency',
    'Inbound supply urgency',
    'intent',
    10,
    'Explicit immediate material need due to supplier delays, shortages or an urgent project deadline.',
  ),
  factor(
    'outside_radius',
    'Outside delivery coverage',
    'risk',
    35,
    'Explicit report that a project is outside service/freight capability or delivery is unprofitable. Do not infer from a city without a stated service area.',
  ),
  factor(
    'poor_credit',
    'Reported payment / credit risk',
    'risk',
    30,
    'Explicit company-level report of slow payment, liens, declined commercial credit or adverse payment history. Never infer personal creditworthiness.',
  ),
  factor(
    'retail',
    'Retail / DIY volume mismatch',
    'risk',
    20,
    'Explicitly reported homeowner, DIY, single-pallet or small residential requirement incompatible with a commercial wholesale offer.',
  ),
  factor(
    'disputes',
    'Returns / disputes history',
    'risk',
    20,
    'Explicit company-level history of excessive returns or recurring material quantity/quality disputes. A single ordinary product question is not a dispute history.',
  ),
];
export const SCORING_PATH = path('settings', 'scoring');
export const ScoringFactor = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_]{0,59}$/),
    label: z.string().trim().min(1).max(80),
    group: z.enum(['fit', 'intent', 'risk']),
    weight: z.number().int().min(1).max(100),
    description: z.string().trim().min(10).max(600),
    enabled: z.boolean(),
  })
  .strict();
export const ScoringPatch = z
  .object({
    expectedVersion: z.number().int().positive(),
    enabled: z.boolean(),
    factors: z.array(ScoringFactor).max(30),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      new Set(v.factors.map((f) => f.id)).size !== v.factors.length ||
      new Set(v.factors.map((f) => f.label.normalize('NFKC').toLowerCase()))
        .size !== v.factors.length
    )
      c.addIssue({
        code: 'custom',
        message: 'Factor IDs and names must be unique',
        path: ['factors'],
      });
    if (v.enabled && !v.factors.some((f) => f.enabled && f.group !== 'risk'))
      c.addIssue({
        code: 'custom',
        message: 'Keep at least one enabled Fit or Intent factor',
        path: ['factors'],
      });
  });
export async function readScoring(store) {
  const c = await store.get(SCORING_PATH);
  return c || { version: 1, enabled: true, factors: DEFAULT_FACTORS };
}
export const ruleHash = (c) =>
  hash(
    JSON.stringify(
      c.factors
        .filter((f) => f.enabled)
        .map((f) => [f.id, f.group, f.description]),
    ),
  );
export const ScoreExtraction = z
  .object({
    signals: z
      .array(
        z
          .object({
            factorId: z.string(),
            state: z.enum(['present', 'not_met', 'unknown', 'conflict']),
            evidence: z
              .array(
                z
                  .object({
                    sourceId: z.string(),
                    quote: z.string().min(1).max(900),
                  })
                  .strict(),
              )
              .max(2),
          })
          .strict(),
      )
      .max(30),
  })
  .strict();
export function verifySignals(config, raw, sources) {
  const result = ScoreExtraction.parse(raw),
    seen = new Set();
  for (const s of result.signals) {
    if (
      seen.has(s.factorId) ||
      !config.factors.some((f) => f.enabled && f.id === s.factorId)
    )
      throw new AppError(502, 'AI_EVIDENCE', 'Invalid scoring factor response');
    seen.add(s.factorId);
  }
  return config.factors
    .filter((f) => f.enabled)
    .map((f) => {
      const s = result.signals.find((s) => s.factorId === f.id);
      const valid =
        s?.evidence.filter((e) =>
          sources.some((v) => v.id === e.sourceId && v.text.includes(e.quote)),
        ) || [];
      return {
        factorId: f.id,
        state:
          s &&
          s.state !== 'unknown' &&
          valid.length === s.evidence.length &&
          valid.length
            ? s.state
            : 'unknown',
        evidence:
          s && s.state !== 'unknown' && valid.length === s.evidence.length
            ? valid
            : [],
      };
    });
}
export function calculateScore(config, signals) {
  const positive = config.factors
    .filter((f) => f.enabled && f.group !== 'risk')
    .reduce((n, f) => n + f.weight, 0);
  const factors = config.factors
    .filter((f) => f.enabled)
    .map((f) => {
      const s = signals.find((s) => s.factorId === f.id) || {
        state: 'unknown',
        evidence: [],
      };
      return {
        ...f,
        state: s.state,
        evidence: s.evidence,
        points:
          s.state === 'present'
            ? f.group === 'risk'
              ? -f.weight
              : f.weight
            : 0,
      };
    });
  const known = factors.filter((f) => f.state !== 'unknown').length,
    fit = factors
      .filter((f) => f.group === 'fit')
      .reduce((n, f) => n + f.points, 0),
    intent = factors
      .filter((f) => f.group === 'intent')
      .reduce((n, f) => n + f.points, 0),
    penalty = -factors
      .filter((f) => f.group === 'risk')
      .reduce((n, f) => n + f.points, 0);
  const score = known
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round(((fit + intent) / Math.max(1, positive)) * 100 - penalty),
        ),
      )
    : null;
  const hasRisk = factors.some(
    (f) => f.group === 'risk' && f.state === 'present',
  );
  return {
    score,
    fit,
    intent,
    penalty,
    positiveWeight: positive,
    knownFactors: known,
    totalFactors: factors.length,
    coverage: Math.round((known / Math.max(1, factors.length)) * 100),
    hasRisk,
    band:
      score === null
        ? 'Not enough evidence'
        : hasRisk && score < 40
          ? 'Review risks'
          : score >= 70
            ? 'High priority'
            : score >= 40
              ? 'Warm'
              : score > 0
                ? 'Developing'
                : 'Low fit',
    factors,
  };
}
export function scoreView(config, lead, record) {
  if (!config.enabled)
    return { leadId: lead.id, status: 'Disabled', score: null };
  if (!record) return { leadId: lead.id, status: 'Pending', score: null };
  const current =
    record.sourceVersion === lead.version &&
    record.ruleHash === ruleHash(config) &&
    record.status === 'Ready';
  if (!current)
    return {
      leadId: lead.id,
      status:
        record.status === 'Failed'
          ? 'Failed'
          : record.status === 'Processing'
            ? 'Processing'
            : 'Stale',
      score: null,
      scoredAt: record.scoredAt || null,
    };
  return {
    leadId: lead.id,
    status: 'Ready',
    ...calculateScore(config, record.signals),
    scoredAt: record.scoredAt,
    sourceVersion: record.sourceVersion,
    configVersion: config.version,
    notesIncluded: record.notesIncluded,
    sourcesTruncated: record.sourcesTruncated,
  };
}
export async function scoreSources(store, lead) {
  const notes = await store.query(path('activities'), {
    filters: [['leadId', '==', lead.id]],
    direction: 'desc',
    limit: 17,
  });
  const choices = await store.get(path('settings', 'fields'));
  const custom = (choices?.customFields || [])
    .filter(
      (f) => !f.deleted && !/email|phone|contact name|personal/i.test(f.label),
    )
    .map(
      (f) =>
        `${f.label}: ${String(lead.customFields?.[f.id] ?? 'Not recorded')}`,
    )
    .join('\n');
  const profile = [
    ['Sector', lead.zone],
    ['City', lead.location],
    ['Business role', lead.jobTitle],
    ['Enquiry status', lead.legacyStatus],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  const sources = [];
  if (profile || custom)
    sources.push({
      id: 'profile',
      text: (profile + '\n' + custom).slice(0, 1500),
    });
  let remaining = 8000,
    notesIncluded = 0,
    truncated = notes.length > 16;
  for (const note of notes.slice(0, 16)) {
    if (!note.notes) continue;
    const text = String(note.notes).slice(0, Math.min(1800, remaining));
    if (!text) {
      truncated = true;
      break;
    }
    sources.push({
      id: 'note:' + note.id,
      text,
      recordedAt: note.createdAt || null,
      occurredAt: note.occurredAt || null,
      historical: !!note.imported,
    });
    notesIncluded++;
    remaining -= text.length;
    if (text.length < note.notes.length) truncated = true;
  }
  return { sources, notesIncluded, sourcesTruncated: truncated };
}
export async function processLeadScore({
  store,
  leadId,
  extract,
  now = () => new Date().toISOString(),
}) {
  const lease = randomUUID();
  const claim = await store.run(async (tx) => {
    const [lead, config, old] = await Promise.all([
      tx.get(path('leads', leadId)),
      readScoring(tx),
      tx.get(path('leadScores', leadId)),
    ]);
    if (!lead || lead.archived || !config.enabled) return null;
    const view = scoreView(config, lead, old);
    if (view.status === 'Ready') return { cached: view };
    const same =
      old?.sourceVersion === lead.version && old?.ruleHash === ruleHash(config);
    if (
      same &&
      ((old.status === 'Processing' && old.leaseUntil > now()) ||
        (old.status === 'Failed' && old.nextAttemptAt > now()))
    )
      return { cached: view };
    const record = {
      id: lead.id,
      sourceVersion: lead.version,
      ruleHash: ruleHash(config),
      configVersion: config.version,
      status: 'Processing',
      lease,
      leaseUntil: new Date(Date.parse(now()) + 120000).toISOString(),
      attemptCount: same ? (old.attemptCount || 0) + 1 : 1,
    };
    tx.set(path('leadScores', lead.id), record);
    return { lead, config, record };
  });
  if (!claim) return { status: 'Disabled', score: null };
  if (claim.cached) return claim.cached;
  try {
    const sources = await scoreSources(store, claim.lead);
    const raw = sources.sources.length
      ? await extract({
          asOf: now(),
          factors: claim.config.factors
            .filter((f) => f.enabled)
            .map(({ id, group, description }) => ({ id, group, description })),
          sources: sources.sources,
        })
      : { signals: [] };
    const signals = verifySignals(claim.config, raw, sources.sources);
    return await store.run(async (tx) => {
      const [current, lead, config] = await Promise.all([
        tx.get(path('leadScores', leadId)),
        tx.get(path('leads', leadId)),
        readScoring(tx),
      ]);
      if (current?.lease !== lease)
        return { status: 'Processing', score: null };
      if (
        !lead ||
        lead.archived ||
        lead.version !== claim.lead.version ||
        ruleHash(config) !== claim.record.ruleHash ||
        !config.enabled
      ) {
        tx.set(path('leadScores', leadId), { ...current, status: 'Stale' });
        return { status: 'Stale', score: null };
      }
      const result = {
        ...current,
        status: 'Ready',
        signals,
        ...sources,
        sources: undefined,
        notesIncluded: sources.notesIncluded,
        sourcesTruncated: sources.sourcesTruncated,
        scoredAt: now(),
        configVersion: config.version,
      };
      delete result.sources;
      tx.set(path('leadScores', leadId), result);
      return scoreView(config, lead, result);
    });
  } catch (error) {
    await store.run(async (tx) => {
      const current = await tx.get(path('leadScores', leadId));
      if (current?.lease === lease)
        tx.set(path('leadScores', leadId), {
          ...current,
          status: 'Failed',
          errorCode: error.code || 'AI_UNAVAILABLE',
          nextAttemptAt: new Date(
            Date.parse(now()) + (current.attemptCount >= 3 ? 86400000 : 300000),
          ).toISOString(),
        });
    });
    return { leadId, status: 'Failed', score: null };
  }
}
export async function scoreLeads({
  store,
  extract,
  now = () => new Date().toISOString(),
}) {
  const lease = randomUUID(),
    workerPath = path('settings', 'score-worker');
  const claimed = await store.run(async (tx) => {
    const old = await tx.get(workerPath);
    if (old?.leaseUntil > now()) return null;
    const value = {
      ...old,
      lease,
      leaseUntil: new Date(Date.parse(now()) + 180000).toISOString(),
    };
    tx.set(workerPath, value);
    return value;
  });
  if (!claimed) return { busy: true, processed: 0 };
  const config = await readScoring(store);
  if (!config.enabled) {
    await store.run(async (tx) =>
      tx.set(workerPath, { leaseUntil: now(), after: null }),
    );
    return { disabled: true, processed: 0 };
  }
  const leads = await store.query(path('leads'), {
    filters: [['archived', '==', false]],
    after: claimed.after ? [claimed.after] : undefined,
    limit: 40,
  });
  const records = await Promise.all(
    leads.map((l) => store.get(path('leadScores', l.id))),
  );
  const candidates = leads
    .filter((l, i) => {
      const r = records[i],
        s = scoreView(config, l, r);
      return (
        s.status !== 'Ready' &&
        !(
          r?.sourceVersion === l.version &&
          r.ruleHash === ruleHash(config) &&
          ((r.status === 'Processing' && r.leaseUntil > now()) ||
            (r.status === 'Failed' && r.nextAttemptAt > now()))
        )
      );
    })
    .slice(0, 12);
  const results = [];
  for (let i = 0; i < candidates.length; i += 4)
    results.push(
      ...(await Promise.all(
        candidates
          .slice(i, i + 4)
          .map((l) => processLeadScore({ store, leadId: l.id, extract, now })),
      )),
    );
  const last =
    candidates.length === 12
      ? candidates.at(-1).id
      : leads.length === 40
        ? leads.at(-1).id
        : null;
  await store.run(async (tx) => {
    const current = await tx.get(workerPath);
    if (current?.lease === lease)
      tx.set(workerPath, { after: last, leaseUntil: now(), lastRunAt: now() });
  });
  return {
    processed: results.length,
    ready: results.filter((r) => r.status === 'Ready').length,
    failed: results.filter((r) => r.status === 'Failed').length,
  };
}
