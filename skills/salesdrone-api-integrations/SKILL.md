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
