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

The workspace assignedOnly policy caps non-admin members at assigned scope by default without overwriting their configured membership. Use effectiveMember/requireMember for APIs and raw member reads in reminder/notification workers. /me exposes accessPolicyVersion; sessions clear stale lead data on policy changes. Bind long-lived caches and in-flight publications to scope plus policy version as well as member version. Test policy toggles, existing all-scope SDRs, direct links, reports and stale deliveries in reports-policy.test.js.

[Assignment.tsx](../../apps/web/src/components/Assignment.tsx) is now shown in the lead blade header for Admins. It uses the same members read and assignment PATCH policy/version contract. Read-only assignment status does not expose the directory to other members. Ignore UI continuations from an unmounted assignment control after switching leads; About reassignment preserves the pending-task cancellation explanation.

Admin member edits may set `leadExportAccess` to inherit, allow or deny. Omitted fields preserve saved access. Non-Admins inherit the workspace default unless overridden. The global Excel switch and assigned lead scope still apply. Version checks protect edits and export cursors. The existing audit exports the setting key. Authorization reuses the membership and workspace policy reads, with no new queries or polling. Verify with reports-policy.test.js.

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

Role/scope/capability changes, invitation grants/revocation and the direct invitation acceptance transaction participate in settings-audit.js. Acceptance must preserve matching verified identity and atomic member/invitation/audit/outbox writes; no raw invitation email or target UID goes to Dynatrace. Replay must not grant again or emit another audit change.

## Conditional reference

For detailed UI, recovery and integration recipes, read [operations](references/operations.md) when the affected behavior requires it. Follow current source and the shared contract when older examples differ.

## Known gaps

These are tracked follow-ups, not implemented behavior: [#18](https://github.com/theharithsa/SalesDrone/issues/18), [#28](https://github.com/theharithsa/SalesDrone/issues/28), [#56](https://github.com/theharithsa/SalesDrone/issues/56). Check their current status before changing the contract.

Admins receive Hygiene and Assistant capabilities by default, including existing Admin records. Non-admins need explicit hygiene:read/run/ai or assistant:query grants intersected with current lead access. Run/AI require Hygiene read; PATs inherit no research access. Current member/policy versions bind private jobs and cursors; revocation stops in-flight publication. See lead-research.test.js.

Lead-linked task reads follow leads:read and current scope; shared completion/rescheduling follows leads:edit rather than tasks:write. Personal reminders and delivery remain private, legacy retitle/delete remains recipient-only. Assistant business reads reuse each dataset policy and never grant Gemini direct database or credential access.

Main Tasks opt-in browsing follows current lead read scope plus own personal reminders. Shared completion/rescheduling requires lead edit; recipient-only title/delete/cancel actions retain task write. No PAT expansion or notification recipient change. Task action flags are hints; mutations reauthorize.

- GET /api/v1/lead-assignees

The Admin-only minimal assignee directory returns paged id/name/active values without account email or capabilities. Fresh membership checks prevent in-flight directory disclosure after downgrade. Team reporting requires Admin plus members:write and preserves current lead scope; it grants no new member/PAT access. See [Team](../salesdrone-team/SKILL.md).

Read-only MCP integration uses explicit `team:read` and `people:read` PAT scopes for Admin owners. Existing tokens gain no new permissions. Team/directory reads recheck token validity and current access before publication; Google sessions still require members:write. PATs cannot read full membership/security records or mutate people. See [MCP adapter](../salesdrone-mcp/SKILL.md) and [integration contract](../../docs/MCP.md). Shared lead task reads accept tasks:read without exposing unrelated personal reminders.

Member export and AvinyaIntelligence switches intersect existing grants. Admins manage them in Leads Management. See [API behavior](../../docs/API.md).
