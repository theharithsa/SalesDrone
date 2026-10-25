import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { path, canReadLead, effectiveMember } from './policy.js';
import { makeTask, queueTask } from './tasks.js';
export const AUTO_DEFAULTS = {
  automaticReminders: true,
  reminderTime: '10:00',
  nextWeekRule: 'seven_days',
  moveWeekends: false,
};
export const Extraction = z
  .object({
    intent: z.enum(['none', 'schedule', 'review']),
    action: z.enum([
      'call',
      'email',
      'message',
      'meeting',
      'proposal',
      'follow_up',
    ]),
    evidence: z.string().max(1000),
    conditional: z.boolean(),
    multiple: z.boolean(),
    timing: z.enum(['none', 'minutes', 'days', 'date', 'weekday', 'next_week']),
    minutes: z.number().int().min(1).max(10080).nullable(),
    days: z.number().int().min(0).max(365).nullable(),
    date: z.string().nullable(),
    weekday: z.number().int().min(0).max(6).nullable(),
    time: z.string().nullable(),
  })
  .strict();
const titles = {
  call: 'Call this lead',
  email: 'Email this lead',
  message: 'Message this lead',
  meeting: 'Follow up on meeting',
  proposal: 'Send proposal',
  follow_up: 'Follow up with this lead',
};
export function localParts(iso, timezone) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .filter((x) => x.type !== 'literal')
      .map((x) => [x.type, x.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}
// Resolve the local wall time server-side. Reject both DST gaps and folds.
export function zonedInstant(date, time, timezone) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  )
    throw Error('Choose a valid date and time.');
  const wall = Date.parse(date + 'T' + time + ':00Z');
  if (
    !Number.isFinite(wall) ||
    new Date(wall).toISOString().slice(0, 10) !== date
  )
    throw Error('Choose a valid date.');
  const offsets = new Set();
  for (const h of [-36, -12, 0, 12, 36]) {
    const probe = wall + h * 3600000,
      p = localParts(probe, timezone);
    offsets.add(Date.parse(p.date + 'T' + p.time + ':00Z') - probe);
  }
  const matches = [...offsets]
    .map((o) => new Date(wall - o).toISOString())
    .filter((iso) => {
      const p = localParts(iso, timezone);
      return p.date === date && p.time === time;
    });
  if (matches.length !== 1)
    throw Error(
      'This time is missing or ambiguous during a clock change. Choose another time.',
    );
  return matches[0];
}
export function resolveExtraction(
  raw,
  { notes, referenceAt, timezone, settings = {}, now },
) {
  const x = Extraction.parse(raw),
    prefs = { ...AUTO_DEFAULTS, ...settings };
  if (x.intent === 'none')
    return { status: 'NoAction', message: 'No dated follow-up found.' };
  const review = (message) => ({ status: 'NeedsReview', message });
  if (x.intent === 'review' || x.conditional || x.multiple)
    return review(
      'Choose a date for this unclear, conditional, or multiple follow-up.',
    );
  if (!x.evidence.trim() || !notes.includes(x.evidence))
    return review(
      'The follow-up instruction could not be verified in this note.',
    );
  if (
    /\b(if|unless|depending|provided that)\b/i.test(x.evidence) ||
    /\b(don['’]?t|do not|never|not to|no need to)\s+(call|contact|email|follow|send|message)/i.test(
      notes,
    )
  )
    return review(
      'Confirm the follow-up because this note contains a condition or contact restriction.',
    );
  if (x.timing === 'minutes') {
    if (x.minutes === null)
      return review('Choose a duration for this follow-up.');
    const dueAt = new Date(
      Date.parse(referenceAt) + x.minutes * 60000,
    ).toISOString();
    if (Date.parse(dueAt) <= Date.parse(now))
      return review('This follow-up time has passed. Choose a future time.');
    return {
      status: 'Scheduled',
      title: titles[x.action],
      dueAt,
      timezone,
      evidence: x.evidence,
      message: 'Reminder scheduled from this note.',
    };
  }
  if (
    /\b(?:UTC|GMT|IST|PST|PDT|EST|EDT|CST|CDT|MST|MDT|CET|CEST|BST|AEST|AEDT)\b|\b[A-Za-z_]+\/[A-Za-z_]+\b|[+-]\d{2}:\d{2}/.test(
      x.evidence,
    )
  )
    return review(
      'This instruction specifies a timezone. Set the date manually to confirm it.',
    );
  const base = localParts(referenceAt, timezone).date;
  let d = new Date(base + 'T12:00:00Z');
  if (x.timing === 'days' && x.days !== null)
    d.setUTCDate(d.getUTCDate() + x.days);
  else if (x.timing === 'weekday' && x.weekday !== null)
    d.setUTCDate(d.getUTCDate() + ((x.weekday - d.getUTCDay() + 7) % 7 || 7));
  else if (x.timing === 'next_week')
    d.setUTCDate(
      d.getUTCDate() +
        (prefs.nextWeekRule === 'next_monday'
          ? (1 - d.getUTCDay() + 7) % 7 || 7
          : 7),
    );
  else if (x.timing === 'date' && x.date) d = new Date(x.date + 'T12:00:00Z');
  else return review('Add a date to schedule this follow-up.');
  if (!Number.isFinite(d.valueOf())) return review('Choose a valid date.');
  if (
    prefs.moveWeekends &&
    !x.time &&
    ['days', 'next_week'].includes(x.timing)
  ) {
    if (d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 2);
    else if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  }
  let dueAt;
  try {
    dueAt = zonedInstant(
      x.timing === 'date' ? x.date : d.toISOString().slice(0, 10),
      x.time || prefs.reminderTime,
      timezone,
    );
  } catch (e) {
    return review(e.message);
  }
  if (Date.parse(dueAt) <= Date.parse(now))
    return review('The interpreted time has passed. Choose a future time.');
  if (Date.parse(dueAt) > Date.parse(now) + 366 * 86400000)
    return review('Confirm follow-ups more than a year away.');
  return {
    status: 'Scheduled',
    title: titles[x.action],
    dueAt,
    timezone,
    evidence: x.evidence,
    message: 'Reminder scheduled from this note.',
  };
}
export async function enqueueAnalysis(
  tx,
  activity,
  member,
  lead,
  now,
  { manual = false, preserveManual = false } = {},
) {
  const prefs = { ...AUTO_DEFAULTS, ...(await tx.get(`users/${member.uid}`)) };
  const status = manual
    ? 'Manual'
    : preserveManual
      ? 'NeedsReview'
      : !prefs.automaticReminders
        ? 'Disabled'
        : !member.capabilities.includes('tasks:write')
          ? 'Disabled'
          : !activity.notes?.trim()
            ? 'NoAction'
            : 'Pending';
  const id = activity.id + '_r' + activity.revision;
  const summary = {
    id,
    status,
    ownerUid: member.uid,
    taskId: null,
    message: manual
      ? 'Manual reminder takes priority.'
      : preserveManual
        ? 'A previous reminder was edited. Review it before scheduling another.'
        : status === 'Pending'
          ? 'Checking this note for a follow-up.'
          : status === 'Disabled'
            ? 'Automatic scheduling is off.'
            : 'No note to analyze.',
  };
  const updated = { ...activity, autoReminder: summary };
  tx.set(path('activities', activity.id), updated);
  if (status === 'Pending')
    tx.set(path('noteAnalyses', id), {
      id,
      activityId: activity.id,
      revision: activity.revision,
      ownerUid: member.uid,
      leadId: lead.id,
      assignedToUid: lead.assignedToUid ?? null,
      status: 'Pending',
      attemptCount: 0,
      nextAttemptAt: now,
      referenceAt: now,
      timezone: prefs.timezone || 'Asia/Kolkata',
      settings: {
        reminderTime: prefs.reminderTime,
        nextWeekRule: prefs.nextWeekRule,
        moveWeekends: prefs.moveWeekends,
      },
      createdAt: now,
    });
  return updated;
}
async function eligible(tx, job) {
  const [activity, member, lead, prefs] = await Promise.all([
    tx.get(path('activities', job.activityId)),
    tx.get(path('members', job.ownerUid)).then((m) => effectiveMember(tx, m)),
    tx.get(path('leads', job.leadId)),
    tx.get(`users/${job.ownerUid}`),
  ]);
  const current =
    activity?.revision === job.revision &&
    activity.autoReminder?.id === job.id &&
    activity.autoReminder.status === 'Pending';
  const allowed =
    current &&
    activity.disposition !== 'Do not contact' &&
    member?.active &&
    member.capabilities.includes('activities:write') &&
    member.capabilities.includes('tasks:write') &&
    member.capabilities.includes('leads:read') &&
    lead &&
    !lead.archived &&
    !lead.doNotContact &&
    !lead.needsReview &&
    canReadLead(member, lead) &&
    (lead.assignedToUid ?? null) === job.assignedToUid &&
    prefs?.automaticReminders !== false;
  return { current, allowed, activity, member, lead };
}
export async function analyzeNotes({
  store,
  extract,
  now = () => new Date().toISOString(),
  limit = 5,
}) {
  const stats = {
    claimed: 0,
    scheduled: 0,
    review: 0,
    noAction: 0,
    failed: 0,
    cancelled: 0,
  };
  const jobs = await store.query(path('noteAnalyses'), {
    filters: [
      ['status', '==', 'Pending'],
      ['nextAttemptAt', '<=', now()],
    ],
    order: 'nextAttemptAt',
    limit,
  });
  for (const candidate of jobs) {
    const lease = randomUUID();
    const claimed = await store.run(async (tx) => {
      const job = await tx.get(path('noteAnalyses', candidate.id));
      if (job?.status !== 'Pending' || job.nextAttemptAt > now()) return null;
      const context = await eligible(tx, job);
      if (!context.allowed) {
        tx.set(path('noteAnalyses', job.id), { ...job, status: 'Cancelled' });
        if (context.current)
          tx.set(path('activities', job.activityId), {
            ...context.activity,
            autoReminder: {
              ...context.activity.autoReminder,
              status: 'Cancelled',
              message:
                'Automatic scheduling stopped because access, lead, or settings changed.',
            },
          });
        return null;
      }
      const updated = {
        ...job,
        lease,
        attemptCount: job.attemptCount + 1,
        nextAttemptAt: new Date(Date.parse(now()) + 180000).toISOString(),
      };
      tx.set(path('noteAnalyses', job.id), updated);
      return { ...updated, notes: context.activity.notes };
    });
    if (!claimed) continue;
    stats.claimed++;
    let result, errorCode;
    try {
      result = resolveExtraction(
        await extract({
          notes: claimed.notes,
          referenceAt: claimed.referenceAt,
          timezone: claimed.timezone,
        }),
        { ...claimed, now: now() },
      );
    } catch (e) {
      errorCode =
        e.code === 'GEMINI_RATE_LIMIT'
          ? 'GEMINI_RATE_LIMIT'
          : e.code === 'GEMINI_CONFIG'
            ? 'GEMINI_CONFIG'
            : 'ANALYSIS_FAILED';
    }
    await store.run(async (tx) => {
      const job = await tx.get(path('noteAnalyses', claimed.id));
      if (job?.lease !== lease || job.status !== 'Pending') return;
      const c = await eligible(tx, job);
      if (!c.allowed) {
        tx.set(path('noteAnalyses', job.id), { ...job, status: 'Cancelled' });
        if (c.current)
          tx.set(path('activities', job.activityId), {
            ...c.activity,
            autoReminder: {
              ...c.activity.autoReminder,
              status: 'Cancelled',
              message:
                'Scheduling stopped because this lead or your access changed.',
            },
          });
        stats.cancelled++;
        return;
      }
      if (errorCode) {
        const terminal = job.attemptCount >= 3 || errorCode === 'GEMINI_CONFIG';
        tx.set(path('noteAnalyses', job.id), {
          ...job,
          status: terminal ? 'Failed' : 'Pending',
          errorCode,
          nextAttemptAt: new Date(
            Date.parse(now()) + 60000 * 2 ** job.attemptCount,
          ).toISOString(),
        });
        tx.set(path('activities', job.activityId), {
          ...c.activity,
          autoReminder: {
            ...c.activity.autoReminder,
            status: terminal ? 'Failed' : 'Pending',
            message: terminal
              ? 'Automatic scheduling failed. Retry or schedule manually.'
              : 'Scheduling is delayed. Retrying automatically.',
          },
        });
        stats.failed++;
        return;
      }
      let taskId = null;
      if (result.status === 'Scheduled') {
        taskId = 'auto_' + job.id;
        const prior = await tx.get(path('tasks', taskId));
        if (!prior) {
          const task = makeTask(
            {
              title: result.title,
              dueAt: result.dueAt,
              timezone: result.timezone,
              kind: 'outreach',
            },
            c.member,
            taskId,
            job.leadId,
            now(),
          );
          queueTask(tx, {
            ...task,
            sourceActivityId: job.activityId,
            sourceRevision: job.revision,
            automatic: true,
          });
        }
        stats.scheduled++;
      } else if (result.status === 'NeedsReview') stats.review++;
      else stats.noAction++;
      const summary = {
        ...c.activity.autoReminder,
        ...result,
        taskId,
        processedAt: now(),
      };
      tx.set(path('activities', job.activityId), {
        ...c.activity,
        autoReminder: summary,
      });
      tx.set(path('noteAnalyses', job.id), {
        ...job,
        status: result.status,
        taskId,
        finishedAt: now(),
      });
      tx.set(path('auditEvents', 'analysis_' + job.id), {
        id: 'analysis_' + job.id,
        actorUid: job.ownerUid,
        action: 'automaticReminder.' + result.status,
        activityId: job.activityId,
        taskId,
        createdAt: now(),
      });
    });
  }
  return stats;
}
