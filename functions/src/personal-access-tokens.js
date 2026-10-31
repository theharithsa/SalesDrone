import { rateLimitExpiry } from './rate-limit.js';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { AppError } from './contracts.js';
import { path, hash } from './policy.js';
import { TOKEN_SCOPES } from './api-scopes.js';
export { TOKEN_SCOPES, PAT_ROUTES } from './api-scopes.js';
export const TokenInput = z
  .object({
    name: z.string().trim().min(1).max(80),
    scopes: z
      .array(z.enum(TOKEN_SCOPES.map((s) => s.id)))
      .min(1)
      .max(TOKEN_SCOPES.length),
    expiresInDays: z
      .union([z.literal(7), z.literal(30), z.literal(90)])
      .default(30),
  })
  .strict()
  .refine((v) => new Set(v.scopes).size === v.scopes.length, {
    message: 'Choose at least one unique permission scope',
  });
export const MAX_TOKENS = 20;
export const tokenMetadata = (t) =>
  Object.fromEntries(
    [
      'id',
      'name',
      'prefix',
      'scopes',
      'createdAt',
      'expiresAt',
      'lastUsedAt',
      'revokedAt',
      'active',
    ].map((k) => [k, t[k] ?? null]),
  );
export function generateToken(ownerUid, input, at) {
  const id = randomBytes(16).toString('hex'),
    token = `sd_pat_${id}_${randomBytes(32).toString('base64url')}`;
  return {
    token,
    record: {
      id,
      ownerUid,
      ...input,
      scopes: [...input.scopes].sort(),
      tokenHash: hash(token),
      prefix: `sd_pat_${id.slice(0, 8)}…`,
      createdAt: at,
      expiresAt: new Date(
        Date.parse(at) + input.expiresInDays * 86400000,
      ).toISOString(),
      lastUsedAt: null,
      revokedAt: null,
      active: true,
    },
  };
}
export function assertAdmin(member) {
  if (member.role !== 'Admin')
    throw new AppError(
      403,
      'ADMIN_REQUIRED',
      'Only active administrators can manage personal access tokens',
    );
}
// Raw credentials are accepted only here, never persisted, returned in metadata or logged.
export async function authenticatePersonalToken(store, bearer, now) {
  const match = /^sd_pat_([a-f0-9]{32})_([A-Za-z0-9_-]{43})$/.exec(bearer);
  const invalid = () =>
    new AppError(
      401,
      'INVALID_TOKEN',
      'Personal access token is invalid, expired or revoked',
    );
  if (!match) throw invalid();
  const digest = createHash('sha256').update(bearer).digest('hex');
  return store.run(async (tx) => {
    const token = await tx.get(path('personalAccessTokens', match[1]));
    if (
      !token ||
      !token.active ||
      token.expiresAt <= now() ||
      typeof token.tokenHash !== 'string' ||
      token.tokenHash.length !== 64 ||
      !timingSafeEqual(Buffer.from(token.tokenHash), Buffer.from(digest))
    )
      throw invalid();
    const member = await tx.get(path('members', token.ownerUid));
    if (!member?.active || member.role !== 'Admin') throw invalid();
    const minute = now().slice(0, 16),
      limits = [
        ['pat:' + token.id, 120],
        ['pat-owner:' + token.ownerUid, 300],
      ],
      rates = [];
    for (const [key, limit] of limits) {
      const p = path('rateLimits', hash(key + ':' + minute)),
        r = await tx.get(p);
      if ((r?.count || 0) >= limit)
        throw new AppError(
          429,
          'TOKEN_RATE_LIMIT',
          'API rate limit reached. Try again next minute.',
        );
      rates.push([
        p,
        {
          count: (r?.count || 0) + 1,
          expiresAt: rateLimitExpiry(now()),
        },
      ]);
    }
    for (const [p, r] of rates) tx.set(p, r);
    if (!token.lastUsedAt || token.lastUsedAt.slice(0, 16) !== minute)
      tx.set(path('personalAccessTokens', token.id), {
        ...token,
        lastUsedAt: now(),
      });
    return {
      uid: token.ownerUid,
      personalAccess: { id: token.id, digest, now },
    };
  });
}
