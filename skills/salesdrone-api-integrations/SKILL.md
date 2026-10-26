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

Test expiry/revoke, disabled/deleted/downgraded owner, tasks-only access, cross-owner cursors and revoke-between-admission-and-commit. For Swagger failure separate CSP/asset/version mismatch from API authorization errors.

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

## v1.8 operating notes

Contract1.15 adds optional numeric Preferences.displayScale enum 85/90/100/110/125 with missing default 100 and omission preservation. Existing self-owned active-member Google/AppCheck /me only; no PAT route/scope expansion. Test invalid/string values, unapproved access, identity isolation and no-op audits.

## v1.9 operating notes

Contract 1.16 adds seven operations: batch preview/apply and private attachment reservation, binary PUT, paginated list, forced binary GET and versioned removal. New PAT scopes are leads:bulk-edit, attachments:read and attachments:write. Batch reassignment additionally requires assignments:write. Existing token scopes gain no implicit access to the new endpoints. Swagger must generate PUT and binary request/response bodies with pagination, validation, errors, idempotency and capability requirements.

## Material 3 v2 local-review guidance

Material v2 refreshes api-portal.css around the existing self-hosted Swagger portal. Keep authentication only in memory, remote validation disabled, same-origin requests and no RUM. Contract 1.16/scopes remain unchanged; the local admin preview never issues PAT credentials.
