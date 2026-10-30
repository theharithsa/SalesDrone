---
name: salesdrone-testing
description: "Test SalesDrone features and regressions using module cases, unit/API checks, Auth/Firestore emulators and approved-browser UI checks. Use for test execution and evidence; release authorization remains separate."
---

# Testing and regression handoff

Read [SHARED.md](../SHARED.md), the affected owner from [skill-tree.json](../../skill-tree.json), and [the case catalog](../../qa/test-cases.json). The catalog maps each logical module to executable tests and manual expected behavior; it is not a claim that all cases have run.

## Choose and run

- `npm run qa -- quick`: unit/API tests, types, generated contract consistency, documentation, skills and release-plan readiness. Run domain tests directly during incomplete implementation; readiness can correctly fail on a draft release plan.
- `npm run qa -- integration`: real Auth/Firestore emulator tests against demo-salesdrone. Requires Java 21 and available local ports; never substitute production credentials or a live project.
- `npm run qa -- release`: quick checks, secret scan, real emulator and production build. It does not deploy. CI remains the publishing gate.
- Results are sanitized JSON in ignored test-results/qa-<suite>.json. Failure stops execution and marks later checks not-run. Inspect actual error output; do not turn an infrastructure failure or omitted browser check into a pass.

## Feature-specific investigation

Choose cases by module, inspect the linked source test, reproduce the reported behavior with synthetic records, and add a regression at the boundary that failed. Prefer actual requests, authorization failures, transaction rollback, concurrency or UI behavior over source-string snapshots. Test empty/unknown states distinctly from zero values, stale records, denied roles, assigned scope and idempotent repeats. Font/scale preferences must preserve old clients and live-versus-guest isolation.

For visible changes use the approved browser tool and actual guest application or clearly labelled isolated components. [Manual UI recipes](../../qa/test-cases.json) specify expected outcomes. Review 390/768/1024/1280/1440/1920px, desktop display scales 85/90/100/110/125, touch 100%, both palettes, Book mode, all font choices, long/unbroken names and keyboard focus. Measure overflow and actual geometry; root text fixtures are not proof of browser zoom or native accessibility. At every desktop scale test overlay resize/keyboard, full-page navigation, score states, dialogs and notifications.

Do not install a competing browser automation path. Existing screenshots are reference evidence, not automated assertions. Do not use production leads, membership edits, reminders, tokens or imports as fixtures. Build temporary UI fixtures outside public/ and remove them before production build; retain only reviewed synthetic screenshots through the documentation workflow.

## Handoff evidence

Report source commit, suite/case IDs, commands, passed/failed/not-run results, viewport/scale/theme, fixtures, screenshot paths and limitations. Include a minimal reproduction and expected/actual behavior for failures. Read-only live checks and Dynatrace HTTP receipts are separate from emulator persistence, customer writes and tenant-search visibility. Publication or rollback follows [release readiness](../salesdrone-release-readiness/SKILL.md) and [release](../salesdrone-release/SKILL.md), with the human's existing authorization; this testing skill grants no deployment or delegation permission.

Entry points: [runner](../../scripts/run-test-suite.mjs), [execution policy](../../scripts/test-plan.mjs), [runner tests](../../tests/test-plan.test.ts), [emulator integration](../../functions/test/emulator.integration.js), [testing guide](../../docs/TESTING.md). Update the catalog and owning module skill when behavior changes.

## v1.9 operating notes

Run bulk-and-files.test.js for atomic batches, strict fields, scope, stale rows, replay, assignment cancellation/alerts, upload signatures/limits, immutable retry, revoke-during-upload, quota, cleanup and telemetry privacy. The real emulator integration now includes Storage, actual byte round trips and direct unauthenticated Storage denial. Java 21 can run from a portable local SDK. If default ports belong to another project, use an isolated temporary emulator config rather than killing unrelated processes. Browser demo files are memory-only: do not use them as proof of a production bucket write.

## Material 3 v2 local-review guidance

Use npm run design:check for local Material contrast, table configuration and production-entry isolation checks plus type/build. The responsive review canvas is a manual aid, not automated visual evidence. Read MATERIAL-3-REVIEW.md: the initial connector became unavailable, then an already-installed isolated Chromium/CDP session supplied fresh synthetic screenshots and measured browser checks. Refresh affected synthetic screenshots and run full release gates after user design approval.

### Real form rendering and screenshot feedback

`npm run design:forms` uses Vite SSR to render actual components, checking labels,
configured names, required dates, native checkboxes and action types. It is part
of design:check, not a browser substitute. Review INTERFACE-MATERIAL-02 through
05 for range/arrow/trackpad scrolling, narrow blade toolbars, composer spacing,
outlined fields, conditional call follow-ups and popup fallback across browsers.
The fictional admin entry includes four real form dialogs with saves blocked.
Keep preview-only components out of the application bundle.

### Infinite lead regression

lead-pagination.test.ts covers page overlap/replay, empty results and unchanged
selection during append. design:forms checks unique IDs/names in the 96-row demo.
Execute LEADS-INFINITE-01 in a browser: successive pages, end, keyboard fallback,
retry, sparse pages, viewport resize, filter changes and selection preservation.
Emulator request/identity races and browser observer behavior are separate from
these helper/render tests; do not report them as tested without actual evidence.

### Isolated installed-browser fallback

If browser tools are unavailable, reuse an already-installed headless Chromium with
a fresh profile over localhost CDP; scripts/local-browser.mjs supplies basic actions,
measurements and screenshots without downloading tooling. Never attach personal or
signed-in production browser profiles. Keep captures/evidence in test-results until
privacy/visual review, then curate filenames and hashes. Chromium viewport checks
are not physical device tests. Disconnect CDP and stop only the browser/server you
started when finished. CI now runs design:forms and production fixture exclusion.

### Mobile sweep beyond overflow

Run npm run review:mobile with design:dev and an existing isolated Chromium/CDP
session on 9337. It uses trusted touch actions, checks actual grid content width,
filter Apply/Cancel/Reset and focus, every lead tab, all main modules, admin settings
and forms. All zoom percentages are saved through the actual guest form, including
minimum icon targets. Never equate no root overflow with a full-width layout.
Use a fresh nonpersonal profile; test evidence/screenshots remain in test-results
until visual/privacy review. Physical device, Safari/IME and live writes are separate.

### Header regression additions

review:mobile checks a compact header, hidden phone intro/chip strip, presence of
the quick stage picker and list start position using synthetic data. Test More
Escape/outside/action dismissal and Export's focus return. Check container-driven icon
labels and roomier text labels, including saved zoom; desktop actions must remain visible. A count marked
loaded is not a promise of the total number matching a sparse cursor scan.

### Task list regression

TASKS-MOBILE-2.0.1 checks compact header/status picker below 768px, full content
width, aligned title/date/menu, small completion symbols with full touch targets,
all status states and empty results. review:mobile exercises menu Escape/focus,
outside dismissal and edit/reschedule/delete dialogs, plus completion/cancellation
in synthetic memory. Cover fractional card breakpoint, desktop/wide widths, all
five saved zooms and standard/Book day/night. Real emulator delivery is separate.

### Theme control regression

Run `node scripts/review-theme.mjs` with design:dev and isolated Chromium/CDP 9337.
Check trusted pointer and keyboard toggle, resolved System appearance changes,
local persistence, bounded geometry/touch sizes across widths/scales, Book palettes
and reduced-motion transition removal. Local-storage preference fixtures are not
server persistence tests. Login and workspace use the same component.

### Leading lead checkbox and logo removal

review:mobile verifies mobile checkbox target right <= name left, common name
edges, independent select/deselect without record opening, and all five saved zoom
values. It also asserts the workspace header has no enterprise-brand element.
review-theme checks that absence across its header width/scale matrix.

### CI execution telemetry

ci-checks.mjs runs fixed preflight/unit/API/type/form/contract/emulator/build checks,
stops at a failure and records unexecuted work as not-run. The second Node test
reporter records actual leaf outcomes, hashed IDs and measured timestamps/duration
without test names, error text or output. CI artifacts are the execution evidence;
qa/test-cases.json remains a recipe catalog. The trusted main observe job reports
workflow/check/testcase events and reporting spans/logs/metrics. PR jobs receive no
telemetry or production secret. See the Observability operations runbook.

## Archives (2.1)

Archive regressions live in functions/test/archived-leads.test.js: signed/scoped paging, cross-member cursor denial, stale versions, retained dates and pending-task cancellation. Test the Settings list loading/error/empty/retry/load-more behavior with synthetic data at phone and desktop widths.

## Lead-data reset (2.1)

functions/test/lead-data-reset.test.js covers Admin/PAT/revocation/strict phrase/preview expiry, stable start replay, concurrent workers, lock/no resurrection, config/personal reminder retention and storage blocked/resume. Actual Auth/Firestore/Storage reset coverage is in emulator.integration.js, only against demo-salesdrone. Never run reset on production as a postdeploy test. Synthetic AdminReview only simulates Waiting status; do not count it as backend deletion evidence.

## Collaborative imports (2.3)

Run import-review.test.js for three-way decisions, ambiguity, scope, concurrency, expiry, deletion, clears and 1,000-row replay, then API portal and emulator integration. Use isolated alternate ports when another project owns emulator ports. Synthetic browser captures demonstrate mapping/history/row-review presentation only; distinguish them from database commit evidence and physical devices.

## API and deployment hardening (2.3.1)

The quick issue batch covers PAT file round trips and read-only denial, archive invalid-body/no-write behavior, duplicate-ID privacy and parser error privacy in actual requests. Auth/Firestore/Storage integration now uploads bytes using a scoped PAT and checks missing archive input. deployment-outcome.test.ts exercises all required phases and CLI mapping. No UI changes require new screenshot assertions.
