import { applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { resendClient } from './email-delivery.js';
import { fetchReleaseAnnouncement } from './email-release-announcement.js';
import { BUILD_RELEASE } from './version.js';

const cacheMillis = 5 * 60_000;
const productionProject = 'sales-drone-avinya';
function productionSecret(name, credential, fetchImpl) {
  let cached, cachedUntil = 0;
  return async () => {
    if (Date.now() < cachedUntil) return cached;
    try {
      const { access_token: token } = await credential().getAccessToken();
      const url = 'https://secretmanager.googleapis.com/v1/projects/' + productionProject +
        '/secrets/' + name + '/versions/latest:access';
      const response = await fetchImpl(url, {
        headers: { Authorization: 'Bearer ' + token }, redirect: 'error', signal: AbortSignal.timeout(2500),
      });
      if (!response.ok) {
        await response.body?.cancel();
        return null;
      }
      const { payload } = await response.json();
      const value = Buffer.from(payload.data, 'base64').toString('utf8').trim();
      cached = value;
      cachedUntil = Date.now() + cacheMillis;
      return value;
    } catch {
      return null;
    }
  };
}

export function createEmailConfig({ environment, origin, chooseInsight, env = process.env,
  credential = applicationDefault, auth = getAuth, fetchImpl = fetch }) {
  const preprod = environment === 'pre-production';
  const enabled = () => env.SDR_EMAIL_ENABLED === 'true' && env.FUNCTIONS_EMULATOR !== 'true';
  const allowlist = (env.SDR_EMAIL_PILOT_ALLOWLIST || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  const ready = () => enabled() && (preprod
    ? /^re_/.test(env.SDR_RESEND_API_KEY || '') && /^whsec_/.test(env.SDR_RESEND_WEBHOOK_SECRET || '')
    : allowlist.length > 0 && allowlist.length <= 20);
  const productionKey = productionSecret('SALESDRONE_RESEND_API_KEY', credential, fetchImpl);
  const productionHook = productionSecret('SALESDRONE_RESEND_WEBHOOK_SECRET', credential, fetchImpl);
  return {
    environment, origin, ready, allowlist, chooseInsight,
    release: preprod ? null : { current: BUILD_RELEASE, read: current => fetchReleaseAnnouncement(current, fetchImpl) },
    testInbox: preprod ? env.SDR_EMAIL_TEST_INBOX?.trim().toLowerCase() : null,
    send: resendClient(() => ready() ? preprod ? env.SDR_RESEND_API_KEY : productionKey() : null, fetchImpl),
    webhookSecret: () => ready() ? preprod ? env.SDR_RESEND_WEBHOOK_SECRET : productionHook() : null,
    verifiedEmail: async member => {
      try {
        const user = await auth().getUser(member.uid);
        return user.emailVerified && !user.disabled &&
          user.providerData.some(provider => provider.providerId === 'google.com')
          ? user.email?.toLowerCase() : null;
      } catch (error) {
        if (error.code === 'auth/user-not-found') return null;
        // The lease will make work eligible again after a transient Auth failure.
        throw new Error('Email recipient verification unavailable', { cause: error });
      }
    },
  };
}
