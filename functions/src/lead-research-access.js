import { AppError } from "./contracts.js";
import { hash, requireMember, scopeFilters, path } from "./policy.js";
import { documentKey } from "./store.js";
import { RESET_STATE, resetActive } from "./lead-data-reset.js";
export const RESEARCH_CAPABILITIES = [
  "hygiene:read",
  "hygiene:run",
  "hygiene:ai",
  "assistant:query",
];
export const researchAccessKey = (m) =>
  hash(
    JSON.stringify([
      m.uid,
      m.version,
      m.scope,
      m.accessPolicyVersion,
      [...m.capabilities].sort(),
    ]),
  );
export async function researchMember(
  store,
  identity,
  capabilities,
  expectedAccess,
) {
  if (identity.personalAccess)
    throw new AppError(
      403,
      "GOOGLE_REQUIRED",
      "Use Google sign-in for lead research",
    );
  const m = await requireMember(store, identity, "leads:read");
  if (
    capabilities.some(
      (c) => !RESEARCH_CAPABILITIES.includes(c) || !m.capabilities.includes(c),
    )
  )
    throw new AppError(
      403,
      "FORBIDDEN",
      "You do not have access to this feature",
    );
  if (expectedAccess && expectedAccess !== researchAccessKey(m))
    throw new AppError(
      409,
      "STALE_ACCESS",
      "Access changed. Start again with current permissions.",
    );
  if (resetActive(await store.get(RESET_STATE)))
    throw new AppError(
      503,
      "LEAD_DATA_RESET",
      "Lead data is being cleared. Try again after cleanup finishes.",
    );
  return m;
}
// Internal page boundary; HTTP cursors must additionally be signed/owner-bound.
// A transaction makes membership, workspace policy and lead selection consistent
// for this page. It does not claim a point-in-time snapshot across all pages.
export async function researchLeadPage(
  store,
  identity,
  capabilities,
  accessKey,
  { after, limit = 100, archived = false } = {},
) {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    (after !== undefined &&
      (typeof after !== "string" || !/^[A-Za-z0-9_.:-]{1,1500}$/.test(after)))
  )
    throw new AppError(400, "INVALID_QUERY", "Invalid scan boundary");
  return store.run(async (tx) => {
    const member = await researchMember(tx, identity, capabilities, accessKey);
    const rows = await tx.query(path("leads"), {
      filters: [...scopeFilters(member), ["archived", "==", archived]],
      order: "__name__",
      after: after ? [after] : undefined,
      limit,
    });
    return {
      member,
      rows,
      after: rows.length ? documentKey(rows.at(-1)) : after || null,
      complete: rows.length < limit,
    };
  });
}
