import { createTelemetry } from './telemetry.js';
import { observableStore } from './observable-store.js';
import { deliverTelemetry } from './telemetry-outbox.js';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getAppCheck } from 'firebase-admin/app-check';
import { getMessaging } from 'firebase-admin/messaging';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineString, defineSecret } from 'firebase-functions/params';
import { createApp } from './app.js';
import { firestoreStore } from './store.js';
import { dispatchReminders } from './reminders.js';
import { analyzeNotes as processNotes } from './automatic-reminders.js';
import { geminiExtractor } from './gemini.js';
import { AppError } from './contracts.js';
import { intelligenceGemini } from './intelligence-gemini.js';
import { scoreLeads } from './scoring.js';
// Keep Firestore's implicit SDK tracing off; the explicit wrapper exports allowlisted spans.
process.env.FIRESTORE_ENABLE_TRACING = 'false';
initializeApp();
const geminiKey = defineSecret('GEMINI_API_KEY');
const dtKey = defineSecret('DYNATRACE_API_TOKEN');
const cursorKey = defineSecret('CURSOR_SECRET');
const dtTenant = defineString('DYNATRACE_TENANT_URL', {
  default: 'https://indiacs.live.dynatrace.com',
});
let observability = null;
function monitoring(service) {
  if (observability || process.env.FUNCTIONS_EMULATOR === 'true')
    return observability;
  try {
    observability = createTelemetry({
      tenant: dtTenant.value(),
      key: dtKey.value(),
      service,
    });
  } catch {
    console.warn(JSON.stringify({ event: 'telemetry_initialization_failed' }));
  }
  return observability;
}
async function dependency(name, fn) {
  return observability ? observability.span(name, fn) : fn();
}
async function worker(name, fn) {
  const t = monitoring('salesdrone-' + name);
  try {
    return t ? await t.worker(name, fn) : await fn();
  } finally {
    await t?.flush();
  }
}
const geminiModel = defineString('GEMINI_MODEL', {
  default: 'gemini-3.5-flash-lite',
});
const intelligence = intelligenceGemini({
  key: () => geminiKey.value(),
  model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
});
const region = defineString('SDR_REGION', {
  default: 'asia-south1',
  description:
    'Choose the region matching the existing Firestore location before deployment.',
});
const appCheckMode = defineString('APP_CHECK_MODE', {
  default: 'enforce',
  description: 'enforce in production; disabled only for emulators.',
});
const store = observableStore(
  firestoreStore(getFirestore()),
  () => observability,
);
const handler = createApp({
  store,
  telemetry: () => observability,
  extractScore: (input) =>
    dependency('gemini.qualification', () => intelligence.extract(input)),
  summarizeDashboard: (input) =>
    dependency('gemini.dashboard', () => intelligence.summarize(input)),
  verifyToken: (token) => getAuth().verifyIdToken(token, true),
  verifyPersonalTokenOwner: async (uid) => {
    try {
      const owner = await getAuth().getUser(uid);
      return (
        !owner.disabled &&
        owner.providerData.some((p) => p.providerId === 'google.com')
      );
    } catch (error) {
      if (error.code === 'auth/user-not-found') return false;
      throw new AppError(
        503,
        'AUTH_UNAVAILABLE',
        'Account verification is temporarily unavailable',
      );
    }
  },
  verifyAppCheck: async (token) => {
    if (process.env.FUNCTIONS_EMULATOR === 'true') return;
    if (appCheckMode.value() !== 'enforce')
      throw new AppError(
        503,
        'CONFIGURATION',
        'Production App Check must be enabled',
      );
    if (!token)
      throw new AppError(403, 'APP_CHECK', 'App verification is required');
    try {
      await getAppCheck().verifyToken(token);
    } catch {
      throw new AppError(403, 'APP_CHECK', 'App verification failed');
    }
  },
  sendTest: (device) =>
    dependency('fcm.test', () =>
      getMessaging().send({
        token: device.token,
        data: {
          title: 'SalesDrone by AvinyaTech',
          body: 'Your notifications are ready.',
          deliveryId: 'test',
          url: '/settings',
        },
      }),
    ),
});
export const api = onRequest(
  {
    region,
    timeoutSeconds: 120,
    memory: '512MiB',
    maxInstances: 10,
    cors: false,
    secrets: [geminiKey, dtKey, cursorKey],
  },
  async (req, res) => {
    const t = monitoring('salesdrone-api');
    await new Promise((resolve, reject) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        Promise.resolve(t?.flush()).finally(resolve);
      };
      res.once('finish', finish);
      res.once('close', finish);
      try {
        handler(req, res);
      } catch (e) {
        reject(e);
      }
    });
  },
);
export const reminders = onSchedule(
  {
    region,
    schedule: 'every 1 minutes',
    timeZone: 'Etc/UTC',
    timeoutSeconds: 120,
    memory: '256MiB',
    maxInstances: 1,
    secrets: [dtKey],
  },
  async () =>
    worker('reminders', async () => {
      const stats = await dispatchReminders({
        store,
        send: (message) =>
          dependency('fcm.delivery', () => getMessaging().send(message)),
      });
      console.info(JSON.stringify({ event: 'reminder_dispatch', ...stats }));
      return stats;
    }),
);

export const analyzeNotes = onSchedule(
  {
    region,
    schedule: 'every 1 minutes',
    timeZone: 'Etc/UTC',
    timeoutSeconds: 120,
    memory: '256MiB',
    maxInstances: 1,
    secrets: [geminiKey, dtKey],
  },
  async () =>
    worker('note-analysis', async () => {
      const stats = await processNotes({
        store,
        extract: (input) =>
          dependency('gemini.reminder', () =>
            geminiExtractor({
              key: geminiKey.value(),
              model: geminiModel.value(),
            })(input),
          ),
      });
      console.info(JSON.stringify({ event: 'note_analysis', ...stats }));
      return stats;
    }),
);

export const leadIntelligence = onSchedule(
  {
    region,
    schedule: 'every 1 minutes',
    timeZone: 'Etc/UTC',
    timeoutSeconds: 180,
    memory: '512MiB',
    maxInstances: 1,
    concurrency: 1,
    secrets: [geminiKey, dtKey],
  },
  async () =>
    worker('lead-intelligence', async () => {
      const stats = await scoreLeads({
        store,
        extract: (input) =>
          dependency('gemini.qualification', () => intelligence.extract(input)),
      });
      console.info(JSON.stringify({ event: 'lead_scoring', ...stats }));
      return stats;
    }),
);

export const exportTelemetry = onSchedule(
  {
    region,
    schedule: 'every 1 minutes',
    timeZone: 'Etc/UTC',
    timeoutSeconds: 120,
    memory: '512MiB',
    maxInstances: 1,
    concurrency: 1,
    secrets: [dtKey],
  },
  async () =>
    worker('telemetry', async () => {
      const stats = await deliverTelemetry({
        store,
        tenant: dtTenant.value(),
        key: dtKey.value(),
        telemetry: observability,
      });
      console.info(JSON.stringify({ event: 'telemetry_export', ...stats }));
      return stats;
    }),
);
