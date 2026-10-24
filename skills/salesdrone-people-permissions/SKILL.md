---
name: salesdrone-people-permissions
description: "Maintain SalesDrone invitations, member roles, capabilities, assigned scope and protected admin rules. Use for granting/revoking workspace access; Google login mechanics belong to authentication."
---

# People and permissions

Read [the shared operating contract](../SHARED.md) before editing. Paths and commands
are relative to the repository root. Inspect current source rather than assuming
this map is an immutable schema or a standalone microservice.

## Responsibility and entry points

Admin invitation/member edit → verified capability → versioned transaction → invitation acceptance binds verified UID → dependent requests/workers reevaluate current access.

- [functions/src/policy.js](../../functions/src/policy.js)
- [functions/src/contracts.js](../../functions/src/contracts.js)
- [functions/src/app.js](../../functions/src/app.js)
- [apps/web/src/features/PeopleSettings.tsx](../../apps/web/src/features/PeopleSettings.tsx)
- [apps/web/src/features/MembersPage.tsx](../../apps/web/src/features/MembersPage.tsx)

## Primary API ownership

- GET /api/v1/members
- GET /api/v1/invitations
- POST /api/v1/invitations
- DELETE /api/v1/invitations/{id}
- PATCH /api/v1/members/{uid}
- POST /api/v1/invitations/{id}/accept

Read the exact request/response/error schemas in [OpenAPI](../../docs/openapi.json)
and the route handler in [app.js](../../functions/src/app.js) when changing an API.

## Data and invariants

workspaces/avinyatech/{members,invitations,adminBindings,auditEvents}; user identity remains Firebase Auth UID.

- An invitation grants only the intended verified Google identity access. Preserve protected-admin restrictions.
- Every domain transaction rechecks current membership/capabilities; revocation between admission and commit must prevent writes.
- Assigned/all scope applies to direct lookup, filtered lists, cursors, activities, tasks, scoring, dashboards and inbox context. Hidden UI controls are not authorization.
- Role downgrade, membership suspension and Auth owner disable/delete must also invalidate applicable PAT and worker access.

## Change and diagnosis

Reproduce cross-user assigned/all and viewer writes, expired/revoked grants, and concurrent version edits. If an old task or notification remains visible after transfer, inspect its recipient and assignment revision rather than broadening access.

## Verification

- [functions/test/app.test.js](../../functions/test/app.test.js)
- [functions/test/personal-access-tokens.test.js](../../functions/test/personal-access-tokens.test.js)
- [functions/test/notifications.test.js](../../functions/test/notifications.test.js)

Apply the shared verification matrix to the changed behavior; these are the
module-specific regression entry points, not a substitute for integration checks.

## Deployment and handoff

api and Hosting; review all affected scheduled workers when policy semantics change. Run real Auth/Firestore emulator checks before publishing.

Use [the release skill](../salesdrone-release/SKILL.md) for authorized publication.
Adjacent owners:

- [salesdrone-authentication](../salesdrone-authentication/SKILL.md)
- [salesdrone-leads](../salesdrone-leads/SKILL.md)
- [salesdrone-notifications](../salesdrone-notifications/SKILL.md)
- [salesdrone-api-integrations](../salesdrone-api-integrations/SKILL.md)
