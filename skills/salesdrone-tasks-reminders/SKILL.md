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

LeadTaskTab pages the existing recipient-private GET tasks endpoint by leadId and optional state. Do not widen access for administrators. Include all supported states, loading/error/refresh/load-more and stale-request guards and refresh after successful task mutations without resetting its status filter; card selection opens existing edit/delete/reschedule/complete dialogs.

useSubmit supplies an isCurrent callback so a dismissed task form cannot close a replacement dialog after its request resolves. The synchronous submit lock blocks double-click writes before React commits busy state. Verify edit/delete/cancel and delayed completion in synthetic fixtures.

## Material 3 v2 local-review guidance

Material v2 uses a plain Tasks heading, status chips, compact rows and shared action/menu styling. Keep task ownership, completion, edit/delete and date-entry behavior unchanged. Check long titles and wrapped dates/actions at phone widths before release.

### Local v2 form contract

TaskForm, TaskEditForm and RescheduleForm use persistent outlined labels, 56px
entry containers and grouped actions. Keep native date/time validation, field
names and localInstant conversion intact. `design:forms` checks real reminder/edit
markup. The isolated admin preview can open reminder/edit dialogs but never saves
a real task. Review required dates, focus and narrow dialogs in MATERIAL-05.

### Mobile action menus

Task menu triggers/actions retain compensated touch targets under saved zoom.
On opening, measure available viewport space excluding sticky header/bottom nav;
choose above/below and bound scrolling rather than letting actions fall behind the
bar. Closing the disclosure after an action must not alter the task handler or
authorization. review:mobile includes a bottom-edge anchor containment regression.

### Local 2.0.1 task list refinement

Tasks uses title/New on one phone row, a status picker below, a loaded count and
one timezone label. Desktop keeps Add reminder and pressed-state status buttons.
Rows group title, lead/company and due instant; completion uses a 22px symbol
inside a compensated target. Secondary actions share the row menu. Completed and
cancelled rows retain Edit task/Delete task, without pending scheduling actions.
Preserve existing handlers, capability guards and recipient privacy. Menus close
on Escape (restoring trigger focus), outside pointer, blur and action selection.

review:mobile checks full list width, aligned menu anchors, compact symbol/target
sizes, status empty/completed/cancelled states, edit/reschedule/delete dialogs and
completion/cancellation using in-memory demo tasks. Review five saved scales and
light/dark/Book palettes; this is no proof of server persistence or delivery.
No new API, permission, setting or business event is needed for this presentation.

## Lead-data reset (2.1)

reminders advances bounded lead-reset batches before dispatch. When active, normal reminder/attachment cleanup is skipped; note/scoring workers also skip, and store guards stop in-flight domain writes. Reset removes lead-related tasks/deliveries/device receipts but retains standalone personal reminders and their retry receipts. Every producer must receive the guarded store; no independent unguarded write path.
