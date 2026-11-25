import { z } from 'zod';
import { localParts, zonedInstant } from './automatic-reminders.js';
import { AppError } from './contracts.js';
import { hash, path, validateTimezone } from './policy.js';

export const EMAIL_EVENTS = [
  'invitation', 'access_ready', 'lead_assigned', 'lead_converted', 'lead_failed',
  'task_assigned', 'task_completed', 'task_rescheduled', 'task_reopened', 'daily', 'weekly',
];
export const MAIL_SETTINGS = path('settings', 'email');
export const EMAIL_TEMPLATES = [...EMAIL_EVENTS, 'test'];
export const DIGESTS = ['daily', 'weekly'];
export const EMAIL_MILLIS = { minute: 60_000, day: 86_400_000 };
const defaultEvents = Object.fromEntries(EMAIL_EVENTS.map(event => [event, true]));
const versions = z.number().int().positive();
const scheduleTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const uidSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_.:-]+$/);
export const EmailSettingsPatch = z.object({
  expectedVersion: versions,
  enabled: z.boolean(),
  events: z.object(Object.fromEntries(EMAIL_EVENTS.map(event => [event, z.boolean()]))).strict(),
  outcomeRecipientUid: uidSchema.nullable(),
}).strict();
export const EmailPreferencesPatch = z.object({
  expectedVersion: versions,
  leadUpdates: z.boolean(),
  taskUpdates: z.boolean(),
  dailyEnabled: z.boolean(),
  dailyTime: scheduleTime,
  weeklyEnabled: z.boolean(),
  weeklyTime: scheduleTime,
  weeklyDay: z.number().int().min(0).max(6),
  timezone: z.string().min(1).max(100),
  digestInsights: z.boolean(),
}).strict();
export const EmailInvitationResend = z.object({ expectedVersion: versions }).strict();
export const EmailPreview = z.object({ template: z.enum(EMAIL_TEMPLATES) }).strict();
export const EmailTest = EmailPreview.extend({
  scenario: z.enum(['delivery', 'bounce']).default('delivery'),
}).strict();

export const emailPreferencePath = uid => path('emailPreferences', uid);
export function emailSettings(value) {
  return {
    version: value?.version || 1,
    enabled: value?.enabled === true,
    events: { ...defaultEvents, ...value?.events },
    outcomeRecipientUid: value?.outcomeRecipientUid || null,
  };
}
export function emailPreferences(value, timezone = 'Asia/Kolkata') {
  return {
    version: value?.version || 1,
    leadUpdates: value?.leadUpdates === true,
    taskUpdates: value?.taskUpdates === true,
    dailyEnabled: value?.dailyEnabled === true,
    dailyTime: value?.dailyTime || '09:00',
    weeklyEnabled: value?.weeklyEnabled === true,
    weeklyTime: value?.weeklyTime || '09:00',
    weeklyDay: value?.weeklyDay ?? 1,
    timezone: value?.timezone || timezone,
    digestInsights: value?.digestInsights === true,
  };
}
export async function readEmailSettings(store) {
  return emailSettings(await store.get(MAIL_SETTINGS));
}
export async function readEmailPreferences(store, uid) {
  const [value, user] = await store.getAll([emailPreferencePath(uid), 'users/' + uid]);
  return emailPreferences(value, user?.timezone);
}
export const datePlus = (date, days) =>
  new Date(Date.parse(date + 'T00:00:00Z') + days * EMAIL_MILLIS.day).toISOString().slice(0, 10);
export const weekday = date => new Date(date + 'T00:00:00Z').getUTCDay();
export const weekStart = date => datePlus(date, -((weekday(date) + 6) % 7));
export const scheduleKey = (at, id) => at + '_' + id;

export function nextDigestSlot(type, prefs, after) {
  const today = localParts(after, prefs.timezone).date;
  for (let offset = 0; offset <= 14; offset++) {
    const date = datePlus(today, offset);
    if (type === 'weekly' && weekday(date) !== prefs.weeklyDay) continue;
    // Keep the same local time and skip a day whose selected wall time is ambiguous or absent.
    let instant;
    try {
      instant = zonedInstant(date, prefs[type + 'Time'], prefs.timezone);
    } catch {
      continue;
    }
    if (instant > after) return { at: instant, date };
  }
  throw new AppError(400, 'EMAIL_SCHEDULE', 'Choose another digest time.');
}
export function writeDigestSchedule(tx, uid, type, prefs, after, previous) {
  if (previous) tx.delete(path('emailSchedules', previous));
  if (!prefs[type + 'Enabled']) return null;
  const slot = nextDigestSlot(type, prefs, after);
  const id = scheduleKey(slot.at, hash(uid + ':' + type));
  tx.set(path('emailSchedules', id), { id, uid, type, ...slot, preferenceVersion: prefs.version });
  return id;
}
export async function saveEmailPreferences(tx, uid, input, at) {
  validateTimezone(input.timezone);
  const prior = await tx.get(emailPreferencePath(uid));
  const current = emailPreferences(prior);
  if (current.version !== input.expectedVersion)
    throw new AppError(409, 'VERSION', 'Your email preferences changed. Refresh and try again.');
  const { expectedVersion: _, ...changes } = input;
  const next = { ...changes, version: current.version + 1 };
  const scheduled = Object.fromEntries(DIGESTS.map(type => [
    type, writeDigestSchedule(tx, uid, type, next, at, prior?.scheduled?.[type]),
  ]));
  tx.set(emailPreferencePath(uid), { id: uid, ...next, scheduled });
  return next;
}
export const emailOn = (settings, event) => settings.enabled && settings.events[event] === true;
export const deliveryKey = (event, identity) => hash(event + ':' + identity);

export function writeEmailJob(tx, { event, identity, at, settings, trace, ...context }) {
  const id = deliveryKey(event, identity);
  const nextId = scheduleKey(at, id);
  tx.set(path('emailJobs', id), {
    id, event, createdAt: at, state: 'Queued', attempts: 0,
    policyVersion: settings.version, observabilityTraceparent: trace || null,
    nextId, ...context,
  });
  tx.set(path('emailDue', nextId), { id: nextId, jobId: id });
  return id;
}
export async function enqueueEmail(tx, { event, identity, at, trace, ...context }) {
  const policy = await readEmailSettings(tx);
  if (!emailOn(policy, event)) return null;
  return writeEmailJob(tx, { event, identity, at, settings: policy, trace, ...context });
}
