# Operational reference

Use the current source and [shared contract](../../SHARED.md) when applying these module-specific recipes. Release dates, prior approvals and screenshot versions are historical evidence in [CHANGELOG](../../../CHANGELOG.md) and [release plans](../../../releases/); they never authorize a new deployment.

## Book presentation

For the compact lead overview and display scale, update lead-workspace and screen-layouts handbook modules, Appearance control reference and affected synthetic captures. Explain score unknown versus zero, risk labels, journey disclosures and scale reset/touch limits. Testing guide/catalog are agent handoff references, not evidence every manual case passed.

## Attachment transport and privacy

Document loaded-only batch selection, shared fields/clearing, preview, atomic conflicts, assignment side effects and network retry semantics. Add the Files workflow with supported types, limits, current authorization, progress/retry/cancel, removal confirmation and expiry/cleanup. Explain that guest files clear on leaving the Files tab, no public link is issued, attachments are not AI inputs, and existing conversations remain individual records. Refresh table/mobile/lead-tab captures and add batch/files examples using synthetic files only.

## Material 3 v2  guidance

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

### Mobile  handbook updates

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
public task/dashboard captures after review, preserving honest asset metadata.

### Theme control

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
Preserve sidebar attribution. Preserve the version, dimensions and reviewed hashes declared for every public screenshot.

## Archives

Explain Settings → Archives, access-scoped cursor paging, retained lead/history, read-only viewing and unknown historical dates. Viewing never restores a record or restarts reminders. Capture changed Settings navigation only from synthetic previews.

## Lead-data reset

Document Lead data management as irreversible workspace-wide lead deletion retaining people/settings and standalone reminders. Explain approximate counts, ten-minute preview, five-minute grace, immutable accepted job, background status/retry, API receipt expiry and provider retention limits. No production cleanup is authorized by a handbook or screenshot. Capture the confirmation and archive views with synthetic data.

## Field configuration controls

Explain the trash/restore icons under Manage fields, standard-field historical-value retention and custom retirement. The human retained minimum-save validation: name/date and one phone/email input remain available. Visibility does not remove workflow/suppression controls. field-manager-demo.jpg and field-manager-mobile-demo.jpg show real components with fictional in-memory AdminReview state; keep their reviewed hashes and dimensions in the manifest and list them in the release plan. Unitless action line-height and content-based stacking support enlarged text; browser emulation is not device certification.

## Header and chart review

The 2.2.1 header/axis correction refreshes lead-workspace/overlay captures and adds isolated synthetic Admin header and outreach chart captures. Explain stacked phone workflow controls and Y-axis gridline alignment without claiming a physical Samsung test. The earlier 2.2.0 main workflow was cancelled before publication; its Settings assets remain honestly versioned 2.2.0.

## Collaborative imports

Explain linked updates, three-way conflicts, actual duplicate candidates, optional member grants, resume and Admin-only detail deletion. Refresh import-demo.jpg and import-review-demo.jpg/import-review-mobile-demo.jpg from fictional isolated components. Captures prove presentation, not production writes.


Explain Admin field setup before import preview, schema persistence on cancellation, explicit exclusions, duplicate/blank headers and stable field reuse. Explain the Today personal grouping selector and automatic hidden-stage fallback, bounded groups and unchanged KPIs. Refresh affected desktop/mobile import, category and popup captures without relabelling unchanged historical assets.
