---
name: salesdrone-automatic-reminders
description: "Maintain SalesDrone Gemini extraction of dated follow-ups from new lead notes/call comments, review states and Edit/Undo. Use for notes not becoming tasks; manual reminders belong to tasks-reminders."
---

# AI automatic reminders

Read [the shared operating contract](../SHARED.md) before editing. Paths and commands
are relative to the repository root. Inspect current source rather than assuming
this map is an immutable schema or a standalone microservice.

## Responsibility and entry points

Eligible saved note → enqueueAnalysis → analyzeNotes worker every minute → Gemini structured extraction → evidence/time resolution → fresh transactional eligibility check → task or review/no-action state.

- [functions/src/automatic-reminders.js](../../functions/src/automatic-reminders.js)
- [functions/src/gemini.js](../../functions/src/gemini.js)
- [functions/src/discussions.js](../../functions/src/discussions.js)
- [functions/src/app.js](../../functions/src/app.js)
- [apps/web/src/components/AutomaticReminder.tsx](../../apps/web/src/components/AutomaticReminder.tsx)

## Primary API ownership

- PATCH /api/v1/activities/{id}/automatic-reminder

Read the exact request/response/error schemas in [OpenAPI](../../docs/openapi.json)
and the route handler in [app.js](../../functions/src/app.js) when changing an API.

## Data and invariants

noteAnalyses leased/revision-bound jobs, activities inference state, tasks and reminderDeliveries, user scheduling preferences.

- Gemini proposes structured extraction only. Verify quoted evidence, dates and eligibility server-side; notes and model text are untrusted, not tool instructions.
- Unknown/conditional/conflicting/past/fabricated time requests need review or no action. Resolve relative language using the author’s timezone/reference time and configured defaults.
- Preserve explicit manual follow-ups and user edits/undo. Activity revisions, assignment changes, preferences and suppression can invalidate pending inference.
- Claim bounded jobs, perform inference outside transactions, then revalidate revision/owner/access before commit. Worker replay must not schedule twice.
- Keep Gemini key in Secret Manager; no notes, prompts or responses in telemetry or public fixtures. Model identifiers are config: inspect actual current binding before changing one.

## Change and diagnosis

For “call in 5 minutes,” trace saved activity → noteAnalyses enqueue/status/lease → extraction validation → task commit → task query visibility → delivery. Separate inference delay from due-time alert delay. Reproduce with injected extractor + fixed clock before a controlled live test.

## Verification

- [functions/test/automatic-reminders.test.js](../../functions/test/automatic-reminders.test.js)
- [functions/test/app.test.js](../../functions/test/app.test.js)
- [tests/dates.test.ts](../../tests/dates.test.ts)

Apply the shared verification matrix to the changed behavior; these are the
module-specific regression entry points, not a substitute for integration checks.

## Deployment and handoff

api + analyzeNotes when enqueue/action contracts change; reminders if shared task contract changes; Hosting for review controls. Keep manual scheduling operational when Gemini is unavailable.

Use [the release skill](../salesdrone-release/SKILL.md) for authorized publication.
Adjacent owners:

- [salesdrone-conversations](../salesdrone-conversations/SKILL.md)
- [salesdrone-tasks-reminders](../salesdrone-tasks-reminders/SKILL.md)
- [salesdrone-notifications](../salesdrone-notifications/SKILL.md)
- [salesdrone-workspace-settings](../salesdrone-workspace-settings/SKILL.md)

Read for detailed behavior:

- [docs/AUTOMATIC-REMINDERS.md](../../docs/AUTOMATIC-REMINDERS.md)
