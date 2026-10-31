# Operational reference

Use the current source and [shared contract](../../SHARED.md) when applying these module-specific recipes. Release dates, prior approvals and screenshot versions are historical evidence in [CHANGELOG](../../../CHANGELOG.md) and [release plans](../../../releases/); they never authorize a new deployment.

## Module verification and integration

Appearance & time includes Display zoom numeric85/90/100/110/125. Draft changes apply after Save; default 100, omitted PATCH preserves. Persist per member through /me and isolate guest fallback. From app 2.0.1, apply it on phones/tablets as well, compensate touch sizes and document reset100. Test functions/test/display-scale.test.js and tests/appearance.test.ts.

## Attachment transport and privacy

Explain the new PAT scopes in Developer settings and leads:edit file/batch capabilities in People & permissions. No attachment toggle or global setting is introduced; limits are a documented versioned contract. Existing tokens require explicit new scopes; current owner capabilities and assigned-only policy still apply.

## Material 3 v2  guidance

Material v2 uses shared section cards and a settings dropdown below 900px. The local AdminReview entry renders real components with fictional state, never live API access. SettingsPage previewOnly blocks push registration; the ordinary app does not pass it. Existing field IDs, stored preferences and API policy are unchanged.

### Mobile display scale (local )

Display zoom now applies after Save on phones, tablets and desktops; it is no longer
clamped to 100% on touch/narrow layouts. Retain the same allowlisted numeric values
and personal GET/PATCH /me policy. Smaller zoom compensates tap targets; fixed
viewport dimensions also account for scale. Update UI help, settings reference,
API description and product guide together. Test all five through real Save rather
than CSS injection. Existing committed key-only preference audits remain unchanged.

### Theme control

ThemeToggle uses one native button with sun/moon icons and a solid indicator for
the resolved current mode. The named action switches to the opposite explicit
mode, preserving System following in Settings and Book mode. Keep the existing
changeTheme persistence/error/busy path, keyboard focus and compensated touch
target. The indicator moves 28px in 160ms, disabled under reduced motion. Use
semantic Material colour pairs rather than gradient day/night palettes. Refresh
affected login/workspace public captures after approval; local captures do not
replace or relabel published v2.0 images. No API or new audit/event is introduced.

## Archives

Settings → Archives is available to lead-reading members, including assigned-scope users. It uses GET /archived-leads owned by leads; no workspace setting or additional write permission is introduced. Preserve loading/error/empty/retry/pagination states and read-only archive summaries. Old missing dates show Date not recorded. The shared section catalog and generated guide include archives.

## Lead-data reset

Own GET /lead-data-reset; POST /lead-data-reset/preview; POST /lead-data-reset; POST /lead-data-reset/{id}/resume. See functions/src/lead-data-reset.js and docs/LEAD-DATA-MANAGEMENT.md. Google/App Check active Admin with members:write only; PAT denied. Owner-bound ten-minute preview, typed phrase and acknowledgment, UUID retry-safe start, persisted progress and versioned blocked retry. No cancel after acceptance. Keeps users/configuration and standalone reminders. Five-minute grace and scheduled batches continue after leaving the page. All old idempotency results are redacted/expired. Never execute against production merely to verify a release.

## Field visibility and mobile controls

LeadFieldManager stacks field names/supporting text and uses named trash/restore icon controls. Keep two usable action targets beside wrapping text; disabled deletion explains the minimum requirements. Administrators may hide any standard key except name/enquiryDate, retaining phone or email. FieldOptionsPatch validates the allowlist and rejects both contact fields hidden; preserve expectedVersion/Admin Google/App Check and PAT denial. Retired standard values remain stored and restoration uses the same key. Workflow/suppression controls retain their roles even when a matching configurable column is removed. New manual forms with hidden countryCode use the first configured code; edits omit hidden keys to preserve old values. Hidden stage creates with the existing New default. Extend custom-fields-and-tasks.test.js and real emulator configuration persistence/negative cases; do not claim unrun cases passed. Contract 1.18.0 documents these compatible additional visibility IDs. Settings audit reuses the hiddenFields key without values.


## Personal font preferences

FontStyle is an optional allowlisted personal preference (standard/inter/source-sans/lora), default standard. GET /me defaults it and PATCH merges omissions, preserving old clients. Settings drafts preview locally and apply only after a successful save. Keep Google/App Check self scope and PAT denial. Include fontStyle when saving other settings so a mounted form cannot reset it. Track its key in appearance settings-audit defaults/definitions; export no values. Test font-style.test.js and real emulator persistence/audit isolation.
