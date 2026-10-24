import { createHash } from 'node:crypto';
import { AppError, PRESETS } from './contracts.js';
export const ROOT = 'workspaces/avinyatech';
export const ADMIN_EMAILS = ['spraghav@gmail.com', 'theharithsa@gmail.com'];
export const hash = (value) => createHash('sha256').update(value).digest('hex');
export const path = (collection, id) =>
  `${ROOT}/${collection}${id ? '/' + id : ''}`;
export function googleIdentity(token) {
  if (
    !token?.uid ||
    typeof token.email !== 'string' ||
    !token.email_verified ||
    token.firebase?.sign_in_provider !== 'google.com'
  )
    throw new AppError(
      403,
      'GOOGLE_REQUIRED',
      'Sign in with a verified Google account',
    );
  return {
    uid: token.uid,
    email: token.email.toLowerCase(),
    name: token.name || token.email,
    ...(typeof token.picture === 'string' &&
    /^https:\/\/[^/]+\.googleusercontent\.com\//.test(token.picture)
      ? { photoURL: token.picture }
      : {}),
  };
}
export async function resolveIdentity(store, identity) {
  return store.run(async (tx) => {
    const member = await tx.get(path('members', identity.uid));
    if (ADMIN_EMAILS.includes(identity.email)) {
      const key = path('adminBindings', hash(identity.email));
      const binding = await tx.get(key);
      if (binding && binding.uid !== identity.uid)
        throw new AppError(
          403,
          'ADMIN_BOUND',
          'This administrator identity is already bound',
        );
      if (!member) {
        const m = {
          ...identity,
          id: identity.uid,
          role: 'Admin',
          scope: 'all',
          capabilities: PRESETS.Admin,
          active: true,
          version: 1,
        };
        tx.set(key, { uid: identity.uid });
        tx.set(path('members', identity.uid), m);
        return m;
      }
    }
    return member?.active ? member : null;
  });
}
export async function requireMember(store, identity, capability) {
  const m = await store.get(path('members', identity.uid));
  if (!m?.active)
    throw new AppError(
      403,
      'DEMO_ONLY',
      'Live workspace access has not been granted',
    );
  if (
    capability &&
    (!m.capabilities.includes(capability) ||
      !m.capabilities.includes('leads:read'))
  )
    throw new AppError(
      403,
      'FORBIDDEN',
      'You do not have permission for this action',
    );
  return m;
}
export const scopeFilters = (m) =>
  m.scope === 'all' ? [] : [['assignedToUid', '==', m.uid]];
export function canReadLead(m, lead) {
  return !!lead && (m.scope === 'all' || lead.assignedToUid === m.uid);
}
export async function leadAccess(store, m, id) {
  const l = await store.get(path('leads', id));
  if (!canReadLead(m, l))
    throw new AppError(404, 'NOT_FOUND', 'Lead not found');
  return l;
}
export function assertVersion(entity, expected) {
  if (entity.version !== expected)
    throw new AppError(
      409,
      'STALE_VERSION',
      'This record changed. Refresh before saving.',
    );
}
export function validateTimezone(tz) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
  } catch {
    throw new AppError(400, 'TIMEZONE', 'Choose a valid IANA timezone');
  }
}
