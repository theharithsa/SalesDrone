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
- GET /api/v1/archived-leads
- POST /api/v1/leads/export
- POST /api/v1/leads
- POST /api/v1/leads/batch/preview
- POST /api/v1/leads/batch
- GET /api/v1/leads/{id}
- PATCH /api/v1/leads/{id}
- POST /api/v1/leads/{id}/archive
- PATCH /api/v1/leads/{id}/assignment

Read the exact request/response/error schemas in [OpenAPI](../../docs/openapi.json)
and the route handler in [app.js](../../functions/src/app.js) when changing an API.

## Data and invariants

leads, dedupeKeys, requests, leadTransitions, activities, tasks, reminderDeliveries, auditEvents; creation and assignment can enqueue recipient notifications.

- Normalize contact values without discarding original input; name/date/contact requirements differ only for explicitly needsReview imports. Duplicate overrides must be intentional.
- Keep stage, call outcome, legacy status and disposition distinct. Archive retains records; the scoped Settings archive browser is read-only and restore is not implemented (#4).
- Use expectedVersion and idempotency semantics; reauthorize request replays and protect contact-key ownership on edits.
- Do-not-contact and needsReview suppress outreach, while administrative tasks can remain. Assignment changes invalidate old inference and delivery eligibility. Archive and reassignment currently cancel all pending tasks; outreach-only behavior is an unresolved policy (#15/#21).
- Filter server-side with validated custom definitions and identical demo semantics. Preserve bounded scans and cursor bindings; do not fetch the whole workspace to filter in the browser.

Archive writes one actor/time-attributed “Lead archived” activity in the same transaction. Repeating an already-archived transition creates no second timeline entry.

## Filtered Excel reports

[lead-reports.js](../../functions/src/lead-reports.js) projects selected available columns; [LeadReportExport.tsx](../../apps/web/src/features/LeadReportExport.tsx) follows signed report pages and [report-workbook.ts](../../apps/web/src/features/report-workbook.ts) builds XLSX in a worker. The report uses every applied lead filter, not just loaded rows. Preserve column order/renamed labels, phone strings, plain string cells for formula-like content and the filter-context sheet. Conversation timelines are not included.

Require enabled workspace exports and leads:read; PATs need the separate leads:export scope. Recheck current access and settings per page, bind cursors to filters/columns/config/policy and audit counts only. Sparse pages can be empty with nextCursor; continue to null. Cancel rather than silently truncate beyond 10,000 matching rows or 1,000 scan pages. Do not promise a transactional snapshot across pages. Test with reports-policy.test.js and report-workbook.test.ts.

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

Exact match is additive for source, stage and configured custom dropdowns. It compares raw case/spacing/Unicode and pushes every equality into the query; Equals remains normalized and unchanged. Residual conditions and signed filter/member-bound pagination still apply. Verify exact-filters.test.js, emulator.integration.js and desktop/mobile component interactions.

## Conditional reference

For detailed UI, recovery and integration recipes, read [operations](references/operations.md) when the affected behavior requires it. Follow current source and the shared contract when older examples differ.

## Known gaps

These are tracked follow-ups, not implemented behavior: [#4](https://github.com/theharithsa/SalesDrone/issues/4), [#15](https://github.com/theharithsa/SalesDrone/issues/15), [#21](https://github.com/theharithsa/SalesDrone/issues/21), [#24](https://github.com/theharithsa/SalesDrone/issues/24), [#35](https://github.com/theharithsa/SalesDrone/issues/35), [#37](https://github.com/theharithsa/SalesDrone/issues/37), [#54](https://github.com/theharithsa/SalesDrone/issues/54), [#55](https://github.com/theharithsa/SalesDrone/issues/55). Check their current status before changing the contract.
