---
name: salesdrone-leads
description: "Maintain SalesDrone enquiry capture, editing, filtering, deduplication, assignment, suppression and archive behavior. Use for lead data changes; conversations, imports and journey history have separate skills."
---

# Lead service

Read [the shared operating contract](../SHARED.md) before editing. Paths and commands
are relative to the repository root. Inspect current source rather than assuming
this map is an immutable schema or a standalone microservice.

## Responsibility and entry points

Form or scoped API → field and contact validation → member/lead policy → atomic lead/dedupe/discussion/journey/outbox write → scoped table and inspector refresh.

- [functions/src/leads.js](../../functions/src/leads.js)
- [functions/src/lead-filters.js](../../functions/src/lead-filters.js)
- [functions/src/app.js](../../functions/src/app.js)
- [functions/src/contracts.js](../../functions/src/contracts.js)
- [apps/web/src/components/WorksheetLeads.tsx](../../apps/web/src/components/WorksheetLeads.tsx)
- [apps/web/src/components/LeadFilters.tsx](../../apps/web/src/components/LeadFilters.tsx)
- [apps/web/src/components/Forms.tsx](../../apps/web/src/components/Forms.tsx)

## Primary API ownership

- GET /api/v1/leads
- POST /api/v1/leads
- GET /api/v1/leads/{id}
- PATCH /api/v1/leads/{id}
- POST /api/v1/leads/{id}/archive
- PATCH /api/v1/leads/{id}/assignment

Read the exact request/response/error schemas in [OpenAPI](../../docs/openapi.json)
and the route handler in [app.js](../../functions/src/app.js) when changing an API.

## Data and invariants

leads, dedupeKeys, requests, leadTransitions, activities, tasks, reminderDeliveries, auditEvents; creation and assignment can enqueue recipient notifications.

- Normalize contact values without discarding original input; name/date/contact requirements differ only for explicitly needsReview imports. Duplicate overrides must be intentional.
- Keep stage, call outcome, legacy status and disposition distinct. Archive is not permanent deletion.
- Use expectedVersion and idempotency semantics; reauthorize request replays and protect contact-key ownership on edits.
- Do-not-contact and needsReview suppress outreach, while administrative tasks can remain. Assignment changes invalidate old inference and delivery eligibility.
- Filter server-side with validated custom definitions and identical demo semantics. Preserve bounded scans and cursor bindings; do not fetch the whole workspace to filter in the browser.

## Change and diagnosis

Inspect DUPLICATE/STALE_VERSION/NOT_FOUND outcomes, current field definitions and effective filters. Test owner and another member, archived/suppressed/incomplete records, compound filters and cursor reuse across changed filters.

## Verification

- [functions/test/app.test.js](../../functions/test/app.test.js)
- [functions/test/workbook-and-filters.test.js](../../functions/test/workbook-and-filters.test.js)
- [functions/test/custom-fields-and-tasks.test.js](../../functions/test/custom-fields-and-tasks.test.js)
- [tests/import-mapping.test.ts](../../tests/import-mapping.test.ts)

Apply the shared verification matrix to the changed behavior; these are the
module-specific regression entry points, not a substitute for integration checks.

## Deployment and handoff

api and Hosting; reminders/analyzeNotes/leadIntelligence if shared eligibility changes. New query combinations require compatible indexes READY before dependent queries publish.

Use [the release skill](../salesdrone-release/SKILL.md) for authorized publication.
Adjacent owners:

- [salesdrone-workspace-settings](../salesdrone-workspace-settings/SKILL.md)
- [salesdrone-conversations](../salesdrone-conversations/SKILL.md)
- [salesdrone-lead-journey](../salesdrone-lead-journey/SKILL.md)
- [salesdrone-imports](../salesdrone-imports/SKILL.md)
- [salesdrone-notifications](../salesdrone-notifications/SKILL.md)
