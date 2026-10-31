---
name: salesdrone-tasks-reminders
description: "Maintain SalesDrone manual tasks, edits, snooze/completion, soft deletion and scheduled reminder dispatch. Use for due-task and delivery eligibility issues; note interpretation belongs to automatic-reminders."
---

# Tasks and reminder delivery

Read [the shared operating contract](../SHARED.md) before editing. Paths and commands
are relative to the repository root. Inspect current source rather than assuming
this map is an immutable schema or a standalone microservice.

## Responsibility and entry points

Task create/edit → atomic task+versioned delivery queue → reminders every minute → claim and validate context → private inbox + per-device send → safe retry state.

- [functions/src/tasks.js](../../functions/src/tasks.js)
- [functions/src/reminders.js](../../functions/src/reminders.js)
- [functions/src/notifications.js](../../functions/src/notifications.js)
- [functions/src/app.js](../../functions/src/app.js)
- [apps/web/src/components/TaskEditForm.tsx](../../apps/web/src/components/TaskEditForm.tsx)
- [apps/web/src/components/TaskDeleteForm.tsx](../../apps/web/src/components/TaskDeleteForm.tsx)
- [apps/web/src/lib/dates.ts](../../apps/web/src/lib/dates.ts)

## Primary API ownership

- GET /api/v1/tasks
- POST /api/v1/tasks
- GET /api/v1/tasks/{id}
- PATCH /api/v1/tasks/{id}
- DELETE /api/v1/tasks/{id}

Read the exact request/response/error schemas in [OpenAPI](../../docs/openapi.json)
and the route handler in [app.js](../../functions/src/app.js) when changing an API.

## Data and invariants

tasks, version-keyed reminderDeliveries, per-device deviceDeliveries; users/{uid}/notifications and devices.

- Manual and automatic tasks use makeTask/queueTask and the same delivery contract. Task edits invalidate old versioned jobs.
- Tasks are recipient-private: another Admin does not gain permission to edit/delete someone else’s lead-linked task. Deletion is soft and preserves audit.
- Store due instants with IANA timezone context; reject DST gaps/ambiguity and invalid/past timing according to current schemas.
- Claim jobs transactionally, send FCM outside transactions, recheck recipient/membership/lead/suppression before every external send, and retry only failed devices.
- Outreach stops for suppressed/review/archived/inaccessible leads; administrative tasks have separate rules. Never resurrect completed/deleted/stale work.

## Change and diagnosis

Follow task version and dueAt into reminderDeliveries, then eligibility and deviceDeliveries. Distinguish pending/suppressed/cancelled/failed send from browser permission or OS display; never log titles/tokens.

## Verification

- [functions/test/app.test.js](../../functions/test/app.test.js)
- [functions/test/custom-fields-and-tasks.test.js](../../functions/test/custom-fields-and-tasks.test.js)
- [functions/test/notifications.test.js](../../functions/test/notifications.test.js)
- [tests/dates.test.ts](../../tests/dates.test.ts)

Apply the shared verification matrix to the changed behavior; these are the
module-specific regression entry points, not a substitute for integration checks.

## Deployment and handoff

api + reminders for task/delivery contracts; Hosting for task controls. analyzeNotes must remain compatible with shared task creation.

Use [the release skill](../salesdrone-release/SKILL.md) for authorized publication.
Adjacent owners:

- [salesdrone-automatic-reminders](../salesdrone-automatic-reminders/SKILL.md)
- [salesdrone-notifications](../salesdrone-notifications/SKILL.md)
- [salesdrone-people-permissions](../salesdrone-people-permissions/SKILL.md)

Read for detailed behavior:

- [docs/AUTOMATIC-REMINDERS.md](../../docs/AUTOMATIC-REMINDERS.md)

## Conditional reference

For detailed UI, recovery and integration recipes, read [operations](references/operations.md) when the affected behavior requires it. Follow current source and the shared contract when older examples differ.

## Known gaps

These are tracked follow-ups, not implemented behavior: [#15](https://github.com/theharithsa/SalesDrone/issues/15), [#21](https://github.com/theharithsa/SalesDrone/issues/21), [#39](https://github.com/theharithsa/SalesDrone/issues/39), [#40](https://github.com/theharithsa/SalesDrone/issues/40), [#56](https://github.com/theharithsa/SalesDrone/issues/56), [#58](https://github.com/theharithsa/SalesDrone/issues/58). Check their current status before changing the contract.

Lead Assistant follow-up reads require tasks:read as well as assistant:query and
current lead access. Only the requester's Pending outreach reminders in the explicit
reporting-calendar range qualify; suppressed/review/archived leads are excluded.
Duplicate reminders count a lead once. Task edits invalidate saved reminder results.
