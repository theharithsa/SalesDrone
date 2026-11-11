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

- GET /api/v1/leads/{id}/tasks
- PATCH /api/v1/leads/{id}/tasks/{taskId}

## Data and invariants

tasks, version-keyed reminderDeliveries, per-device deviceDeliveries; users/{uid}/notifications and devices.

- Manual and automatic tasks use makeTask/queueTask and the same delivery contract. Task edits invalidate old versioned jobs.
- Personal reminders and delivery remain recipient-private. Lead-linked tasks are readable by current lead readers through the lead-scoped API; lead editors may complete or reschedule Pending work with expectedVersion and a stable idempotency key. Recipient ownership still controls title edits and deletion; no shared reassignment or private-reminder exposure.
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

These are tracked follow-ups, not implemented behavior: [#39](https://github.com/theharithsa/SalesDrone/issues/39), [#40](https://github.com/theharithsa/SalesDrone/issues/40), [#56](https://github.com/theharithsa/SalesDrone/issues/56), [#58](https://github.com/theharithsa/SalesDrone/issues/58). Check their current status before changing the contract.

Lead Assistant follow-up reads require tasks:read as well as assistant:query and
current lead access. Only the requester's Pending outreach reminders in the explicit
reporting-calendar range qualify; suppressed/review/archived leads are excluded.
Duplicate reminders count a lead once. Task edits invalidate saved reminder results.

Archive and single/batch reassignment query/cancel only Pending outreach tasks. Administrative tasks are not cancelled by that operation; lead-linked visibility follows current lead access and delivery remains private. TASK_LIMIT counts cancellation work only. Missing historic task kinds are not guessed. Restore never resurrects cancelled outreach. Keep the leadId/state/kind/id index READY.

The default recipient-only task list returns a minimal current authorized lead summary (id/name/company) after recipient/scope checks. Do not join names only from the browser's paginated Leads cache or persist copied names on tasks. TaskRow aligns the Lead, Responsible, Due and Actions columns on panels at least 740 CSS pixels wide. Narrower panels group lead and responsibility together beneath the title. Pending rows keep direct Reschedule where the member can manage the task. Personal reminders have no lead link. On phones place Reschedule beside the due time; use an accessible calendar icon when the panel has 290 CSS pixels or less. Standard and Book mode share these rules. No API, audit or delivery change is needed for the layout. Retain recipient ownership on legacy edits/deletion and lead-editor/version checks on shared completion/rescheduling, with stable idempotency keys. Regress privacy/current renames with custom-fields-and-tasks.test.js, actual Firestore integration and task-row.test.tsx; extract shared row styles without changing other lead-task cards.

Swagger must expose limit/cursor/state for the shared lead task page and the mandatory UUID Idempotency-Key for its PATCH. Keep generated declarations aligned with the existing runtime signed-cursor and replay contract; regress via api-portal.test.js.

Shared dueAt pagination orders by dueAt then id. Require leadId/dueAt/id and leadId/state/dueAt/id indexes READY; the latter already exists. Emulator success does not certify production index availability. Keep explicit index regressions alongside shared task policy tests.

GET tasks view=accessible is a bounded Google-member view: current lead readers see shared work plus own private reminders. Default recipient/PAT behavior stays unchanged. Bind sparse cursors to view/scope; project current lead/responsible names. Main TaskRow honors canManage for complete/reschedule and canEditOwn for recipient-only edits. Require global dueAt/id and state/dueAt/id indexes READY in addition to lead variants; test cursor mixing, private rows, revocation and PAT refusal.

Reminder claims publish full eligible backlog and due lag; FCM spans retain finite token/quota errors without tokens or titles. Completion/cancellation semantic outboxes share the original transaction and stable IDs. TASK_KINDS is shared by validation and telemetry; regress administrative completion and saved Manual follow-ups through semantic-telemetry.test.js. See [journey contract](../../docs/OBSERVABILITY-JOURNEYS.md).

Completing, rescheduling and reopening require a nonblank comment of up to 500 characters. Reopen Completed only with a future due instant and eligible current recipient/lead. Cancel the obsolete pending delivery and queue the new version atomically. Keep up to 100 dated changes on the scoped task. Never export comment text into telemetry. Shared lead editors keep the original responsible member.

Keep the primary reminder action in the workspace heading and task status alongside the task list. Preserve compact status controls on phones.
