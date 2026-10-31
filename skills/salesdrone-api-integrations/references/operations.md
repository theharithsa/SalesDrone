# Operational reference

Use the current source and [shared contract](../../SHARED.md) when applying these module-specific recipes. Release dates, prior approvals and screenshot versions are historical evidence in [CHANGELOG](../../../CHANGELOG.md) and [release plans](../../../releases/); they never authorize a new deployment.

## Display scaling

Contract1.15 adds optional numeric Preferences.displayScale enum 85/90/100/110/125 with missing default 100 and omission preservation. Existing self-owned active-member Google/AppCheck /me only; no PAT route/scope expansion. Test invalid/string values, unapproved access, identity isolation and no-op audits.

## Attachment transport and privacy

Contract 1.16 adds seven operations: batch preview/apply and private attachment reservation, binary PUT, paginated list, forced binary GET and versioned removal. New PAT scopes are leads:bulk-edit, attachments:read and attachments:write. Batch reassignment additionally requires assignments:write. Existing token scopes gain no implicit access to the new endpoints. Swagger must generate PUT and binary request/response bodies with pagination, validation, errors, idempotency and capability requirements.

## Material 3 v2  guidance

Material v2 refreshes api-portal.css around the existing self-hosted Swagger portal. Keep authentication only in memory, remote validation disabled, same-origin requests and no RUM. Contract 1.16/scopes remain unchanged; the local admin preview never issues PAT credentials.

### Existing preference description

App 2.0.1 applies displayScale on mobile too. OpenAPI description is corrected;
contract 1.16 routes, schemas, numeric allowlist and scopes are unchanged. GET/PATCH
/me remains Google/App Check self-service only; no PAT scope is added. The mobile
filter dialog reuses the existing leads query and report criteria.

## Archives

GET /archived-leads reuses leads:read PAT scope and current effective member scope; it has bounded limit/cursor query parameters and returns the Lead page schema. No new token permission or restoration/deletion endpoint is implied.

## Collaborative imports

API 1.19.0 adds Google/App Check reviewed import history/rows/report/plan/review/refresh/decisions/detail deletion. PAT_ROUTES does not gain collaboration routes; legacy reads stay owner-only with current owner capabilities. See docs/IMPORTS.md for versions, chunk pagination, deletion and report export policy.

## API and deployment hardening

Contract 1.19.1 names the strict ArchiveInput schema, documents BAD_JSON (400) and PAYLOAD_TOO_LARGE (413) without source echo, and keeps PAT scopes unchanged. Binary attachment admission sets attachments:write before requireMember. Existing tokens gain no new route access. Run app.test.js and bulk-and-files.test.js plus emulator integration.

