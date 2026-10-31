---
name: salesdrone-authentication
description: "Maintain SalesDrone Google sign-in, App Check, session bootstrap and demo isolation. Use for login failures or identity verification; membership administration belongs to people-permissions."
---

# Authentication

Read [the shared operating contract](../SHARED.md) before editing. Paths and commands
are relative to the repository root. Inspect current source rather than assuming
this map is an immutable schema or a standalone microservice.

## Responsibility and entry points

Browser sign-in or redirect → Firebase ID token and App Check → createApp middleware → googleIdentity/resolveIdentity → /me → live or demo UI.

- [apps/web/src/lib/firebase.ts](../../apps/web/src/lib/firebase.ts)
- [apps/web/src/lib/api.ts](../../apps/web/src/lib/api.ts)
- [apps/web/src/App.tsx](../../apps/web/src/App.tsx)
- [functions/src/policy.js](../../functions/src/policy.js)
- [functions/src/index.js](../../functions/src/index.js)

## Primary API ownership

- GET /api/v1/me

Read the exact request/response/error schemas in [OpenAPI](../../docs/openapi.json)
and the route handler in [app.js](../../functions/src/app.js) when changing an API.

## Data and invariants

Firebase Auth identities; workspace members and adminBindings; GET /me resolves live membership or demo identity.

- Require verified Google provider identity, not just an email claim. Protected bootstrap admins are UID-bound; preserve both configured addresses.
- Unapproved identities see isolated in-memory synthetic data. An unavailable live API is an error, never a silent demo fallback.
- App Check is enforced for production Google requests. PAT authentication is a distinct explicitly scoped path, not an App Check workaround.
- Use only verified Google picture claims matching the existing googleusercontent allowlist; maintain initials fallback and sign-out clearing.

## Change and diagnosis

For login failures distinguish popup/redirect/provider/authorized-domain problems from App Check and membership errors. Inspect redacted error codes and /me HTTP status; a successful Google popup alone does not prove data access. Test an approved and unapproved synthetic identity with emulator Auth.

## Verification

- [functions/test/app.test.js](../../functions/test/app.test.js)
- [functions/test/custom-fields-and-tasks.test.js](../../functions/test/custom-fields-and-tasks.test.js)

Apply the shared verification matrix to the changed behavior; these are the
module-specific regression entry points, not a substitute for integration checks.

## Deployment and handoff

Hosting for browser/provider handling; api for verification/bootstrap changes. Firebase Console provider/domain configuration is external to code: report it separately and do not weaken enforcement.

Use [the release skill](../salesdrone-release/SKILL.md) for authorized publication.
Adjacent owners:

- [salesdrone-people-permissions](../salesdrone-people-permissions/SKILL.md)
- [salesdrone-api-integrations](../salesdrone-api-integrations/SKILL.md)
- [salesdrone-interface](../salesdrone-interface/SKILL.md)

Noncritical import-session cleanup uses guarded browser-storage helpers. A browser blocking storage must not abort an otherwise successful session bootstrap or sign-out. This fallback grants no membership/access and persists no customer notes.
## Known gaps

These are tracked follow-ups, not implemented behavior: [#18](https://github.com/theharithsa/SalesDrone/issues/18), [#27](https://github.com/theharithsa/SalesDrone/issues/27), [#28](https://github.com/theharithsa/SalesDrone/issues/28). Check their current status before changing the contract.
