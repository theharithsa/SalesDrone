---
name: salesdrone-api-integrations
description: "Maintain SalesDrone scoped Personal Access Tokens, versioned OpenAPI/Swagger portal and HTTP integration policy. Use for external API contracts and token lifecycle; domain behavior stays with its module skill."
---

# API platform and personal access tokens

Read [the shared operating contract](../SHARED.md) before editing. Paths and commands
are relative to the repository root. Inspect current source rather than assuming
this map is an immutable schema or a standalone microservice.

## Responsibility and entry points

Admin issues scoped expiring token → one-time display → integration bearer → authenticatePersonalToken + route scopes/current owner → existing domain policy/transaction → versioned HTTP response.

- [functions/src/personal-access-tokens.js](../../functions/src/personal-access-tokens.js)
- [functions/src/api-scopes.js](../../functions/src/api-scopes.js)
- [functions/src/app.js](../../functions/src/app.js)
- [functions/src/contracts.js](../../functions/src/contracts.js)
- [scripts/openapi.mjs](../../scripts/openapi.mjs)
- [scripts/build-api-portal.mjs](../../scripts/build-api-portal.mjs)
- [apps/web/src/features/DeveloperSettings.tsx](../../apps/web/src/features/DeveloperSettings.tsx)
- [apps/web/public/api-docs.html](../../apps/web/public/api-docs.html)
- [apps/web/public/api-portal.js](../../apps/web/public/api-portal.js)
- [apps/web/public/api-portal.css](../../apps/web/public/api-portal.css)

## Primary API ownership

- GET /api/v1/personal-access-tokens
- POST /api/v1/personal-access-tokens
- DELETE /api/v1/personal-access-tokens/{id}

Read the exact request/response/error schemas in [OpenAPI](../../docs/openapi.json)
and the route handler in [app.js](../../functions/src/app.js) when changing an API.

## Data and invariants

personalAccessTokens (hashes, scopes, expiry/revocation metadata), rateLimits, requests; generated docs/openapi.json and apps/web/public/openapi.json.

- Only active Admin Google/App Check sessions manage their own tokens; display secrets once and store hashes only. Do not log or persist portal bearer credentials.
- Every admitted token inherits current owner capability/scope and Auth validity; recheck revocation in domain transactions. Respect per-token and aggregate-owner limits.
- PAT_ROUTES is an explicit allowlist. Compound activity actions require extra scopes for stage/assignment/task effects. No PAT administration of people, security, devices or AI generation.
- Keep /api/v1 contracts and separate OpenAPI contract version. Add validation, errors, pagination, concurrency, audit and meaningful access tests for each new domain endpoint.
- Swagger stays self-hosted and same-origin with nonpersistent authorization, restrictive CSP and no RUM/third-party scripts. Generate schema from scripts/openapi.mjs; do not hand-edit generated copies.

GET dashboard exposes only the safe manual/automatic insightMode enum. Private AI guidance remains on Admin Google/App Check ai-settings endpoints; never expand PAT configuration access to guidance.

Report data uses POST /api/v1/leads/export with leads:export, an explicit scope separate from leads:read. The response is paged projected JSON, not XLSX; integrations follow signed cursors. Workspace export disable applies to PATs too. GET workspace-settings accepts configuration:read; PATCH remains Google/App Check Admin-only. See generated schemas and reports-policy.test.js when changing this surface.

## Change and diagnosis

Test expiry/revoke, disabled/deleted/downgraded owner, tasks-only access, cross-owner cursors and revoke-between-admission-and-commit. For Swagger failure separate CSP/asset/version mismatch from API authorization errors. Portal theme overrides are rooted at #swagger-ui to outrank nested vendor selectors; inspect path/filter/tab/schema/auth foreground-background pairs and SVG paths. The portal is always light Material 3, independent of OS/workspace theme; code examples use a paired light surface. Follow qa API-INTEGRATIONS-03 and docs/API-PORTAL-REVIEW.md; never enter live credentials for visual checks.

## Verification

- [functions/test/personal-access-tokens.test.js](../../functions/test/personal-access-tokens.test.js)
- [functions/test/api-portal.test.js](../../functions/test/api-portal.test.js)
- [functions/test/emulator.integration.js](../../functions/test/emulator.integration.js)

Apply the shared verification matrix to the changed behavior; these are the
module-specific regression entry points, not a substitute for integration checks.

## Deployment and handoff

api + Hosting; regenerate both contracts with npm run api:docs and build pinned Swagger assets. Coordinate domain route changes with its owning skill.

Use [the release skill](../salesdrone-release/SKILL.md) for authorized publication.
Adjacent owners:

- [salesdrone-authentication](../salesdrone-authentication/SKILL.md)
- [salesdrone-people-permissions](../salesdrone-people-permissions/SKILL.md)
- [salesdrone-data-platform](../salesdrone-data-platform/SKILL.md)
- [salesdrone-release](../salesdrone-release/SKILL.md)

Read for detailed behavior:

- [docs/API.md](../../docs/API.md)

Configuration/token routes document x-settings-audit metadata in OpenAPI. This internal side effect grants no audit-read endpoint or PAT scope. Token lifecycle audits include safe changed-key names only, never secret/hash/name values, and one-time issuance/revocation semantics remain unchanged.

Contract1.14.0 adds optional Preferences.fontStyle to GET/PATCH /me with an allowlisted enum and omission preservation. This is Google/App Check self-service, excluded from PAT writes; no new PAT scope. Keep strict request validation, response defaults, generated schema/portal and examples aligned. Font choices do not grant API data access.

## Conditional reference

For detailed UI, recovery and integration recipes, read [operations](references/operations.md) when the affected behavior requires it. Follow current source and the shared contract when older examples differ.

## Known gaps

These are tracked follow-ups, not implemented behavior: [#24](https://github.com/theharithsa/SalesDrone/issues/24), [#35](https://github.com/theharithsa/SalesDrone/issues/35), [#57](https://github.com/theharithsa/SalesDrone/issues/57). Check their current status before changing the contract.

API 1.23.0 adds POST /leads/{id}/restore under existing PAT leads:archive and current lead editor scope. Supported Hosting API parser normalization now belongs to the separately registered ingress module; native Functions URLs retain provider-level transport behavior. See API-INGRESS.md.

Shared lead task OpenAPI operations must declare limit/cursor/state, preserve the typed Task page and require a UUID Idempotency-Key for PATCH. api-portal.test.js checks parameter locations, bounds and retry identity. Do not infer nested-route pagination or non-POST idempotency from generic route heuristics.

GET tasks optionally accepts view=accessible only for Google/App Check members; legacy default and PAT tasks:read stay recipient-oriented. Publish typed Task pages with current responsibility/action flags and document sparse signed pagination, view/scope binding and current-access checks.

Accessible mixed-visibility task cursors use AES-GCM with the existing server cursor secret and binding as authenticated context. Never expose skipped private task dates/IDs in readable signed payloads. Legacy cursor format remains unchanged.

Team overview, paged member comment/call feed and minimal lead-assignee directory are Admin-only. API 1.29 adds opt-in team:read/people:read PAT scopes without member administration. Team snapshots reject over-limit scans instead of publishing incomplete totals; activity cursors bind member, period and current access. __unassigned__ is reserved for the Admin lead filter’s null assignment selection.

Read-only MCP uses explicit PAT scopes for Admin owners. Recheck token validity and current access on Team/directory reads. Google sessions still require members:write. PATs cannot read full membership/security records or mutate people. See [MCP adapter](../salesdrone-mcp/SKILL.md) and [integration contract](../../docs/MCP.md). Shared lead task reads accept tasks:read without exposing unrelated personal reminders.

Review [FinOps](../salesdrone-finops/SKILL.md) for API read budgets.
