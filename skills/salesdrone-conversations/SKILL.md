---
name: salesdrone-conversations
description: "Maintain SalesDrone lead notes, call outcomes, discussion imports and revision-preserving corrections. Use for timeline/call changes; reminder extraction is owned by automatic-reminders."
---

# Conversations and call timeline

Read [the shared operating contract](../SHARED.md) before editing. Paths and commands
are relative to the repository root. Inspect current source rather than assuming
this map is an immutable schema or a standalone microservice.

## Responsibility and entry points

Note/call submit → leadAccess + capability + schema → activity/revision with source metadata → optional real stage/manual task → enqueue eligible analysis → timeline refresh.

- [functions/src/discussions.js](../../functions/src/discussions.js)
- [functions/src/app.js](../../functions/src/app.js)
- [functions/src/contracts.js](../../functions/src/contracts.js)
- [apps/web/src/components/Forms.tsx](../../apps/web/src/components/Forms.tsx)
- [apps/web/src/components/AutomaticReminder.tsx](../../apps/web/src/components/AutomaticReminder.tsx)

## Primary API ownership

- GET /api/v1/leads/{id}/activities
- POST /api/v1/leads/{id}/activities
- POST /api/v1/activities/{id}/corrections

Read the exact request/response/error schemas in [OpenAPI](../../docs/openapi.json)
and the route handler in [app.js](../../functions/src/app.js) when changing an API.

## Data and invariants

activities, activityRevisions, leads, noteAnalyses; optional task, stage and telemetry changes share the originating transaction.

- Each added comment is a separate timeline entry. Corrections retain previous revisions; never overwrite history without a revision record.
- Imported discussion columns preserve column identity/order and repeated text; skip blanks. occurredAt stays null for unknown historical dates. Import time is not conversation time.
- Call, stage change and explicit follow-up must commit atomically; replay cannot duplicate any of them. Compound PAT actions require all relevant scopes.
- New eligible notes enqueue analysis tied to the activity revision. Corrections stale out inference; imported historical notes must not silently create fresh callbacks.

## Change and diagnosis

For missing comments compare selected source columns, blank trimming and revision linkage. For duplicate callbacks inspect replay keys and explicit manual follow-up before changing Gemini extraction.

## Verification

- [functions/test/app.test.js](../../functions/test/app.test.js)
- [functions/test/workbook-and-filters.test.js](../../functions/test/workbook-and-filters.test.js)
- [functions/test/automatic-reminders.test.js](../../functions/test/automatic-reminders.test.js)

Apply the shared verification matrix to the changed behavior; these are the
module-specific regression entry points, not a substitute for integration checks.

## Deployment and handoff

api and Hosting; analyzeNotes when enqueue/revision contracts change. Re-run imports and automatic-reminder tests as well as timeline tests.

Use [the release skill](../salesdrone-release/SKILL.md) for authorized publication.
Adjacent owners:

- [salesdrone-leads](../salesdrone-leads/SKILL.md)
- [salesdrone-imports](../salesdrone-imports/SKILL.md)
- [salesdrone-automatic-reminders](../salesdrone-automatic-reminders/SKILL.md)
- [salesdrone-tasks-reminders](../salesdrone-tasks-reminders/SKILL.md)
- [salesdrone-lead-journey](../salesdrone-lead-journey/SKILL.md)

The full lead page presents revision-preserving paginated history as readable comment cards in Comments; Review filters loaded Pending/Failed/NeedsReview analyses. Keep source labels, honest unknown imported dates, preserved line breaks and existing correction/reminder policy. Do not imply a complete historical review before older pages are loaded.
