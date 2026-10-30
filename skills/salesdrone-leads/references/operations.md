# Operational reference

Use the current source and [shared contract](../../SHARED.md) when applying these module-specific recipes. Release dates, prior approvals and screenshot versions are historical evidence in [CHANGELOG](../../../CHANGELOG.md) and [release plans](../../../releases/); they never authorize a new deployment.

Lead lifecycle actions use full-size labelled buttons with Archive and do-not-contact icons, responsive wrapping and existing capability/loading guards. Preserve the distinct archive/suppression contracts: do not invent a permanent Delete lead action or rename suppression as deletion. Reuse existing handlers and backend policy.

Table customer names share start alignment across short, wrapped, missing and non-Latin values; worksheet-name-button fills its data-field=name column. Keep normal table fonts and local horizontal scrolling instead of whole-app zoom. In the lead context render one labelled information list, preserving configured field labels/visibility, original phone fallback, custom retired values and safe permitted tel/mailto links. Full-page and quick-inspection actions have mutually exclusive ownership so expanded details do not duplicate call/reminder controls. Browser-check counts with the disclosure expanded, not only its initial closed state.

WorksheetLeads has no onEdit prop, row Edit button, mobile card Edit button or Actions column. App removes the obsolete editLeadFromList route path; detail Edit lead remains capability-gated and opens the existing guarded form. When name is hidden, row tabIndex0 and Enter/Space preserve access; nested button events must not trigger row keyboard handling. Check named and hidden-name schemas, long names, mobile open/edit/cancel, and normal desktop scale. Compact fine-pointer table data is14px; preserve all API/version/concurrency/suppression rules.

## Module verification and integration

Lead identity is rendered once in LeadBlade identity slot with the shared header score. Stage and assignment stay adjacent and reflow by content width. Maintain one edit action, one call/reminder action set and one contact list; no table-row Edit controls. Test full route and overlay at all saved display scales.

## Atomic batch edits

[bulk-leads.js](../../../functions/src/bulk-leads.js) plans 1–25 explicit unique lead IDs with expected versions. Preview writes nothing; apply runs one transaction and requires a UUID idempotency key. Recheck every lead on replay, including after reassignment. A stale, archived or inaccessible record rejects the whole batch. Allow shared stage/source/company/job-title/city/sector/status/tags/custom-field updates; exclude identity/contact, conversation, suppression and import-repair fields. Merge and validate custom fields using current definitions. No-op rows keep versions and emit no lead writes. Stage changes use recordStage. Assignment requires assignments:write, validates the current target, increments assignmentRevision, cancels pending tasks and creates recipient notifications. Read all plans before writing.

PATs require the separate leads:bulk-edit scope; reassignment also needs assignments:write. [LeadBatchEditor.tsx](../../../apps/web/src/features/LeadBatchEditor.tsx) owns explicit selection, preview and frozen input/key. Selection covers loaded records only and resets when their IDs/versions change. Never imply all filtered rows are selected. An uncertain network response can be retried with the same key; do not claim zero changes when the outcome is unknown. Contacts and history remain individual edits. Use [attachment service](../../salesdrone-attachments/SKILL.md) for files and [bulk-and-files.test.js](../../../functions/test/bulk-and-files.test.js) for atomicity/policy regression tests.

Batch resource budgets also cap aggregate cancellation at 200 pending tasks and serialized old/new/task data at 2 MiB. Exceeding either rejects the whole batch; select fewer leads.

## Material 3 v2  guidance

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

### Leading mobile selection (local )

Place mobile selection in a real leading grid column with a compensated >=48px
target; align every name at the same content edge. Checkbox toggles batch selection
without opening the record; the adjacent button opens it. Remove trailing checkbox
positioning/name padding together. Desktop table selection and batch/cursor policy
remain unchanged. review:mobile asserts leading geometry at 320/390/600/767px,
selection isolation, and placement at all five saved scales on 320/390px screens.

## Archives in Settings

GET /archived-leads lists only archived records using the same current effective member scope and signed cursor policy (limit 1–100; UI 30). PAT reads reuse leads:read. Settings Archives is read-only, including for permitted non-admins, with links to retained records; no restoration or hard deletion is implied. New archives set archivedAt once; older missing dates remain unknown. Pending task cancellation is unchanged. Demo archives remain in memory rather than being removed; active filters/dashboard exclude them. Verify functions/test/archived-leads.test.js and real emulator scope/paging.

## Lead-data reset

Global reset removes active and archived leads and related history/files/imports/dedupe/cache data after the Admin confirms the exact scope. Workspace-settings owns the reset endpoints. guardLeadData reads a common lock in transactions; lead mutation routes reject 503 during cleanup. Never bypass it for background or integration writes. Old request tombstones return 409 RESET_REQUEST_EXPIRED, preventing replay resurrection.

## Configured form visibility

LeadForm respects hidden phone/email/countryCode/stage/comments as well as earlier optional fields. Keep required name/date and at least one visible contact input; only require the remaining contact input when no retained alternate contact satisfies the existing record. Hidden keys are omitted on edits, preserving saved values. New manual records use the existing New stage default and configured first country code even when those controls are removed. Lead normalization, dedupe, suppression/review and legacy import rules remain unchanged. Field retirement never erases historical records or disables dedicated workflow actions. Backend field-options policy prevents hiding both contact inputs; tests cover preservation, contactless-save rejection and restoration.

## Header and chart review

Stage and assignment in the lead header use uniform label/control geometry. Remove the stage detail-section inset/divider within blade-workflow only; compact lead surfaces stack the two full-width controls. Preserve current stage values, expectedVersion, reassignment warnings and capability checks; responsive layout introduces no write or event.

## API and deployment hardening

Archive uses strict ArchiveInput with a positive integer expectedVersion, returning VALIDATION (400) before state changes for malformed/missing bodies. DUPLICATE create errors contain no lead IDs for any caller; the contact index still enforces uniqueness. Authorized duplicate candidates remain available through reviewed Imports. Archive cancellation/restoration policy is unchanged; see open #4/#15/#21. Archive history now records its transition in the same transaction.

