---
name: salesdrone-product-guide
description: "Write SalesDrone module workflows, feature options, troubleshooting and FAQs; refresh reviewed synthetic screenshots after UI changes. Use for the user handbook and visual documentation, not API contract ownership or release authorization."
---

# Product handbook and screenshot maintenance

Read [SHARED.md](../SHARED.md) and the affected module skill before writing. The handbook teaches current product behavior; the overview introduces it, the settings guide explains every control and technical documentation supports maintainers. Do not substitute one for the other.

## Source and outputs

- [docs/product-guide.json](../../docs/product-guide.json): audience, ordered steps, explanations/limits and troubleshooting for each product module.
- [scripts/product-guide.mjs](../../scripts/product-guide.mjs): escaped HTML and Markdown renderer, stable unique module anchors and local text search.
- [docs/PRODUCT-GUIDE.md](../../docs/PRODUCT-GUIDE.md): generated repository handbook.
- [scripts/build-docs.mjs](../../scripts/build-docs.mjs): explicit public asset allowlist and product.html build.
- [site/assets/screenshots/manifest.json](../../site/assets/screenshots/manifest.json): reviewed captures with hash, measured viewport and release version.

## Workflow

1. Trace each described option to the actual form, capability and HTTP schema. Distinguish call outcomes from sales stage, current-stage funnels from history, private tasks from team assignment and AI suggestions from verified facts. Explain defaults, permissions, empty/error/loading states, pagination and recovery.
2. For UI changes list every affected public screenshot, including README embeds and overview images. Capture those screens again with the approved browser tool using isolated synthetic demo data or a fresh public-schema-only Swagger tab. Disable RUM in local rehearsals. Never capture real leads, imports, tokens or signed-in customer details.
3. Measure actual viewport dimensions and inspect each image before copying it to the curated path. Record sha256, capture date, measured viewport, mode, current app version and a short privacy/visual review. Reuse canonical filenames so README and guide references update together. Do not label desktop screenshots as mobile or an old capture as current.
4. Add new images explicitly to build-docs; never recursively publish docs/, workbooks or capture directories. Keep release plan screenshots listing affected filenames. Validate their manifest version before publication. Unchanged screenshots can retain honest historical metadata; replace any image whose visible design or controls changed.
5. Run docs:product, docs:settings, skills:tree, docs:check and docs:build. Inspect the generated handbook in a browser: search a feature, clear search, follow module anchors, open FAQs and settings/API links. Check that navigation labels match the real app and Documentation remains above Settings.
6. Update the owning module skill, README links, changelog and version impact plan. After authorized release check product.html and Settings reference versions independently of the application. Publication permission comes from the user, not this skill.

## Primary API ownership

No module-specific HTTP endpoints. Reuse domain contracts and the API integrations skill. The handbook must not invent CRUD routes or imply a shared task endpoint can expose another recipient’s reminders.

## Verification and limits

[tests/product-guide.test.ts](../../tests/product-guide.test.ts) exercises escaping and duplicate/incomplete anchors. Browser rehearsal proves interactions and screenshots; generated text checks do not prove the product works. If a physical-device test or tenant query was not performed, report that boundary.

Adjacent owners: [documentation](../salesdrone-documentation/SKILL.md), [interface](../salesdrone-interface/SKILL.md), [release readiness](../salesdrone-release-readiness/SKILL.md).

For visual preference features include how to enable, save, combine with theme and disable; distinguish personal from workspace scope and visual styling from offline/hardware behaviour. Book mode uses separate reviewed day, night, mobile and settings captures so standard screenshots can remain accurate with Book mode off. Keep explicit public asset allowlists; never publish a fixture directory.

When showing narrow-screen screenshots in the handbook, constrain the figure to its measured capture width rather than stretching a phone image across the desktop article. Update the screenshot allowlist and release manifest for new list/detail captures, record isolated administrator fixtures explicitly, and link typography guidance to the project design system. Do not equate enlarged root text fixtures with native Dynamic Type or physical-device verification.

An all-screen UI release needs reviewed phone, tablet, laptop and desktop captures with measured source viewports. Include login/import/settings when affected; isolated real-component fixtures must be labelled in the manifest as stubbed, with no claimed server writes. Refresh hashes/version and the curated build allowlist. Follow UI-REVIEW-1.6.7.md for the observed review model; temporary QA entrypoints must be removed before build.

When removing repeated UI, expand disclosures before capturing/verifying: count action sets and contact fields across full page and inspection overlay. Record the sidebar reminder as a menu row, not a banner. Same-version maintenance still needs refreshed affected images/hashes, exact commit-stamped public docs and the current authorization record; preserve historical unchanged captures explicitly.

Document editing as open lead then Edit lead; remove instructions to edit directly in table/card rows. For desktop-density claims distinguish data columns from former sticky Actions, quote measured viewport/fixture counts and keep custom-schema limits. Refresh desktop shell/table captures and mobile-list captures when row actions change; unchanged login/isolated-component images can retain honest prior metadata.

Document personal font styles under Appearance & time, draft preview/save timing, defaults, Book override and branding/monospace exceptions. Refresh changed activity and Appearance screenshots with synthetic data; keep unchanged captures honest. Retain self-hosted font licence/source documentation and browser-check native font selection at narrow widths.

## v1.8 operating notes

For the compact lead overview and display scale, update lead-workspace and screen-layouts handbook modules, Appearance control reference and affected synthetic captures. Explain score unknown versus zero, risk labels, journey disclosures and scale reset/touch limits. Testing guide/catalog are agent handoff references, not evidence every manual case passed.

## v1.9 operating notes

Document loaded-only batch selection, shared fields/clearing, preview, atomic conflicts, assignment side effects and network retry semantics. Add the Files workflow with supported types, limits, current authorization, progress/retry/cancel, removal confirmation and expiry/cleanup. Explain that guest files clear on leaving the Files tab, no public link is issued, attachments are not AI inputs, and existing conversations remain individual records. Refresh table/mobile/lead-tab captures and add batch/files examples using synthetic files only.

## Material 3 v2 local-review guidance

For local v2 review, keep published v1 captures honest and link MATERIAL-3-REVIEW.md. Do not relabel old screenshots as v2. After approval capture every changed module/theme/viewport, update approved hashes and screenshots in the release plan, then publish the revised handbook. Explain customer/company table grouping, visible stage and independent record panes.

### v2 review feedback evidence

The review guide now records column-navigation, composer/section spacing, narrow
blade actions and outlined-form feedback. The fictional admin preview includes
lead/call/reminder/edit dialogs. All changed v2 captures were refreshed after approval with an isolated installed browser; neither
SSR markup checks nor the viewport canvas are a substitute for new approved
captures. Describe native picker fallback accurately where base-select is absent.

### Lead scrolling documentation

Explain automatic cursor paging, 30-row request size, potentially sparse matching
pages, loading/end state and manual retry/fallback. Batch selection survives page
append but resets with filters and drops changed rows. Demo is finite at 96 rows;
never claim it mirrors the production count. Scrolling does not limit filtered
Excel reports to the visible rows. Update the handbook from product-guide.json.

The public renderer accepts reviewed capture metadata and derives HTML image widths
from capturePixels. Update screenshot captions to describe the current captured
state (e.g. initial disabled import preview versus completed mapping); never keep
old viewport numbers or claims of interactions not shown. README screenshot cache
query hashes must follow the current manifest.

### Mobile 2.0.1 handbook updates

Describe mobile filter drafts in a dialog, Apply versus Cancel, Reset timing and
focus return. Display zoom is now available on phones/tablets; remove old desktop-
only copy and stale v1 type/spacing values. Mention compact navigation plus safe
area rather than claiming a fixed physical-device height. Public captures remain
v2.0 until new reviewed 2.0.1 assets are curated; link the local review separately.

### Mobile collection controls

Mobile export/import moved to More lead actions; New remains primary. Document
the compact All stages picker and full filter dialog separately, with the same
underlying applied stage. Refresh phone light/dark captures after review and
describe shortened/hidden labels by actual available width.

### Task collection review

Document phone New, status picker and row Actions menu separately from desktop
Add reminder/status buttons. Edit task and Delete task remain available for closed
states; snooze/reschedule/cancel are Pending-only. Explain loaded counts and the
single timezone label. Keep new local captures in test-results; refresh affected
public task/dashboard captures only after review, preserving honest v2.0 assets.

### Local 2.0.1 theme control

ThemeToggle uses one native button with sun/moon icons and a solid indicator for
the resolved current mode. The named action switches to the opposite explicit
mode, preserving System following in Settings and Book mode. Keep the existing
changeTheme persistence/error/busy path, keyboard focus and compensated touch
target. The indicator moves 28px in 160ms, disabled under reduced motion. Use
semantic Material colour pairs rather than gradient day/night palettes. Refresh
affected login/workspace public captures after approval; local captures do not
replace or relabel published v2.0 images. No API or new audit/event is introduced.

### Header mark and leading selection review

Mobile lead selection is on the left in a separate target column. The adjacent
card opens the lead; selecting its checkbox only changes the batch selection.
The workspace header no longer shows the Avinya logo beside the theme pill.
Preserve sidebar attribution. Public screenshots still await local-review approval;
never relabel the v2.0 header images as current v2.0.1 evidence.

## Archives (2.1)

Explain Settings → Archives, access-scoped cursor paging, retained lead/history, read-only viewing and unknown historical dates. Viewing never restores a record or restarts reminders. Capture changed Settings navigation only from synthetic previews.

## Lead-data reset (2.1)

Document Lead data management as irreversible workspace-wide lead deletion retaining people/settings and standalone reminders. Explain approximate counts, ten-minute preview, five-minute grace, immutable accepted job, background status/retry, API receipt expiry and provider retention limits. No production cleanup is authorized by a handbook or screenshot. Capture the confirmation and archive views with synthetic data.

## Field configuration controls (2.2)

Explain the trash/restore icons under Manage fields, standard-field historical-value retention and custom retirement. The human retained minimum-save validation: name/date and one phone/email input remain available. Visibility does not remove workflow/suppression controls. field-manager-demo.jpg and field-manager-mobile-demo.jpg show real components with fictional in-memory AdminReview state; keep their reviewed hashes and dimensions in the manifest and list them in the release plan. Unitless action line-height and content-based stacking support enlarged text; browser emulation is not device certification.

## Header and chart review (2.2.1)

The 2.2.1 header/axis correction refreshes lead-workspace/overlay captures and adds isolated synthetic Admin header and outreach chart captures. Explain stacked phone workflow controls and Y-axis gridline alignment without claiming a physical Samsung test. The earlier 2.2.0 main workflow was cancelled before publication; its Settings assets remain honestly versioned 2.2.0.

## Collaborative imports (2.3)

Explain linked updates, three-way conflicts, actual duplicate candidates, optional member grants, resume and Admin-only detail deletion. Refresh import-demo.jpg and import-review-demo.jpg/import-review-mobile-demo.jpg from fictional isolated components. Captures prove presentation, not production writes.
