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
- Keep stage, call outcome, legacy status and disposition distinct. Archive is not permanent deletion.
- Use expectedVersion and idempotency semantics; reauthorize request replays and protect contact-key ownership on edits.
- Do-not-contact and needsReview suppress outreach, while administrative tasks can remain. Assignment changes invalidate old inference and delivery eligibility.
- Filter server-side with validated custom definitions and identical demo semantics. Preserve bounded scans and cursor bindings; do not fetch the whole workspace to filter in the browser.

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

Lead lifecycle actions use full-size labelled buttons with Archive and do-not-contact icons, responsive wrapping and existing capability/loading guards. Preserve the distinct archive/suppression contracts: do not invent a permanent Delete lead action or rename suppression as deletion. Reuse existing handlers and backend policy.

Table customer names share start alignment across short, wrapped, missing and non-Latin values; worksheet-name-button fills its data-field=name column. Keep normal table fonts and local horizontal scrolling instead of whole-app zoom. In the lead context render one labelled information list, preserving configured field labels/visibility, original phone fallback, custom retired values and safe permitted tel/mailto links. Full-page and quick-inspection actions have mutually exclusive ownership so expanded details do not duplicate call/reminder controls. Browser-check counts with the disclosure expanded, not only its initial closed state.

WorksheetLeads has no onEdit prop, row Edit button, mobile card Edit button or Actions column. App removes the obsolete editLeadFromList route path; detail Edit lead remains capability-gated and opens the existing guarded form. When name is hidden, row tabIndex0 and Enter/Space preserve access; nested button events must not trigger row keyboard handling. Check named and hidden-name schemas, long names, mobile open/edit/cancel, and normal desktop scale. Compact fine-pointer table data is14px; preserve all API/version/concurrency/suppression rules.

## v1.8 operating notes

Lead identity is rendered once in LeadBlade identity slot with the shared header score. Stage and assignment stay adjacent and reflow by content width. Maintain one edit action, one call/reminder action set and one contact list; no table-row Edit controls. Test full route and overlay at all saved display scales.

## Atomic batch edits

[bulk-leads.js](../../functions/src/bulk-leads.js) plans 1–25 explicit unique lead IDs with expected versions. Preview writes nothing; apply runs one transaction and requires a UUID idempotency key. Recheck every lead on replay, including after reassignment. A stale, archived or inaccessible record rejects the whole batch. Allow shared stage/source/company/job-title/city/sector/status/tags/custom-field updates; exclude identity/contact, conversation, suppression and import-repair fields. Merge and validate custom fields using current definitions. No-op rows keep versions and emit no lead writes. Stage changes use recordStage. Assignment requires assignments:write, validates the current target, increments assignmentRevision, cancels pending tasks and creates recipient notifications. Read all plans before writing.

PATs require the separate leads:bulk-edit scope; reassignment also needs assignments:write. [LeadBatchEditor.tsx](../../apps/web/src/features/LeadBatchEditor.tsx) owns explicit selection, preview and frozen input/key. Selection covers loaded records only and resets when their IDs/versions change. Never imply all filtered rows are selected. An uncertain network response can be retried with the same key; do not claim zero changes when the outcome is unknown. Contacts and history remain individual edits. Use [attachment service](../salesdrone-attachments/SKILL.md) for files and [bulk-and-files.test.js](../../functions/test/bulk-and-files.test.js) for atomicity/policy regression tests.

Batch resource budgets also cap aggregate cancellation at 200 pending tasks and serialized old/new/task data at 2 MiB. Exceeding either rejects the whole batch; select fewer leads.

## Material 3 v2 local-review guidance

The v2 table presents customer identity first, with company as supporting text and a visible sales-stage badge. lead-table.ts respects configured names, hidden fields and active custom fields. It changes presentation only; workbook/export order, field IDs, filter authorization and batch policy remain unchanged.

### Local v2 collection review corrections

WorksheetLeads exposes persistent overflow controls only when desktop columns
exceed the viewport, synchronized with native horizontal scroll and resizing.
Do not replace column navigation with page-wide scrolling or remove mobile cards.
LeadForm uses the shared outlined labels while configured names/field IDs, required
validation and FormData stay unchanged. Narrow blade toolbars wrap action groups,
not the Edit lead text. See interface manual cases MATERIAL-02/03/05.

## Infinite collection pagination

App.tsx follows the existing scoped cursor in 30-row live pages; the
InfiniteLeadLoader footer observes within 300px and attempts each cursor once
automatically. Preserve manual retry/fallback and stop at null. Sparse pages may
be empty with another cursor. Never fetch the workspace at once. pendingList blocks
concurrent append; generation/list epochs reject old responses. appendUniqueRows
prevents duplicate IDs. Test overlap/replay/empty pages and selection using
lead-pagination.test.ts. Filters remount loader/batch selection. Append keeps
unchanged selected rows; changed/removed rows are dropped. Demo has 96 fictional
rows revealed 30 at a time; reports must still use all matching rows.

### Mobile filter transaction and full-width cards

MobileLeadFilters snapshots applied criteria on open. Apply updates search field,
stage, source and conditions together; Cancel/Escape discards, Reset edits only
the draft. ColumnFilterFields is shared with desktop and must not nest forms.
Keep dynamic field labels/choices and all server scope/scan/cursor invariants.
The outer leads-table section spans the collection grid, not just its nested card.
review:mobile measures card width, verifies draft isolation and restores focus.

### Mobile quick stage and actions

All stages picker mirrors the same applied stage used by the filter dialog and
server query; it must include all configured stages. The loaded count is not the
workspace total or an inferred filtered total. More only reorganizes existing
export/import access, preserving report criteria, capabilities and export policy.
Mobile New may be icon-only but keeps its New enquiry accessible name.

### Leading mobile selection (local 2.0.1)

Place mobile selection in a real leading grid column with a compensated >=48px
target; align every name at the same content edge. Checkbox toggles batch selection
without opening the record; the adjacent button opens it. Remove trailing checkbox
positioning/name padding together. Desktop table selection and batch/cursor policy
remain unchanged. review:mobile asserts leading geometry at 320/390/600/767px,
selection isolation, and placement at all five saved scales on 320/390px screens.

## Archives in Settings (2.1)

GET /archived-leads lists only archived records using the same current effective member scope and signed cursor policy (limit 1–100; UI 30). PAT reads reuse leads:read. Settings Archives is read-only, including for permitted non-admins, with links to retained records; no restoration or hard deletion is implied. New archives set archivedAt once; older missing dates remain unknown. Pending task cancellation is unchanged. Demo archives remain in memory rather than being removed; active filters/dashboard exclude them. Verify functions/test/archived-leads.test.js and real emulator scope/paging.

## Lead-data reset (2.1)

Global reset removes active and archived leads and related history/files/imports/dedupe/cache data after the Admin confirms the exact scope. Workspace-settings owns the reset endpoints. guardLeadData reads a common lock in transactions; lead mutation routes reject 503 during cleanup. Never bypass it for background or integration writes. Old request tombstones return 409 RESET_REQUEST_EXPIRED, preventing replay resurrection.

## Configured form visibility (2.2)

LeadForm respects hidden phone/email/countryCode/stage/comments as well as earlier optional fields. Keep required name/date and at least one visible contact input; only require the remaining contact input when no retained alternate contact satisfies the existing record. Hidden keys are omitted on edits, preserving saved values. New manual records use the existing New stage default and configured first country code even when those controls are removed. Lead normalization, dedupe, suppression/review and legacy import rules remain unchanged. Field retirement never erases historical records or disables dedicated workflow actions. Backend field-options policy prevents hiding both contact inputs; tests cover preservation, contactless-save rejection and restoration.
