# SalesDrone 2.0 — design approval and release review

The user approved the local v2.0.0 design on **26 October 2026** and authorized
documentation, release checks and publication. The local-first deployment hold is
resolved for this release. Approval does not bypass any release gate.

## Scope and architecture

The v1 entry accumulated 13 overlapping global stylesheets (almost 10,000 lines).
The v2 entry instead owns Material colour/type/shape/motion roles and separate
control, shell, workspace, dashboard, settings and sign-in styles. The former
styles remain unimported for historical references. See [design system](DESIGN-SYSTEM.md).

- Responsive drawer, rail and phone navigation retain both SalesDrone and Avinya branding.
- Lead identity/company grouping, visible stages and local horizontal scrolling
  replace redundant columns and actions. Visible overflow navigation works with
  auto-hidden macOS scrollbars.
- The resizable inspector adapts its own toolbar: <=560px uses named icon buttons,
  restoring labels when wider. Full records independently size activity and details.
- All/Comments/Calls/Tasks/Files/Review retain existing scoped behavior. Comment
  composition has consistent inner padding; private tasks and files remain separate.
- Forms use borderless filled fields, persistent inset labels, native validation,
  56px entry containers and visible focus. Select triggers share one chevron;
  customizable-select browsers also theme the popup. Other browsers retain their
  platform option picker.
- Leads automatically load existing cursor pages near the bottom. Requests remain
  scoped and bounded at 30; sparse pages can have another cursor. Explicit retry,
  append locking, request epochs and ID deduplication protect pagination. Appending
  preserves unchanged selections; filters reset them. Reports cover all matches.
- The demo has 96 unique fictional records revealed in pages, without live data access.
- Dashboard, forms, imports, notifications, personal/admin settings, Book palettes
  and the self-hosted Swagger portal share the Material role system.

The API remains 1.16.0 with unchanged scopes and access policy. Browser navigation
uses existing RUM and API telemetry; cosmetic changes do not invent business events.
Deployment events are emitted by the existing workflow after actual deployment.

## Actual verification

The original browser-control connector became unavailable during the first draft.
For release verification an **already installed Chromium headless shell** was run
with a fresh isolated profile over localhost CDP. No browser package was installed,
no personal signed-in profile was opened, and RUM stayed disabled. Guest data,
labelled in-memory admin forms and public Swagger schema were the only fixtures.

- Lead list: 360/390/600/768/1024/1280/1440/1920 CSS pixels; no page-wide overflow.
- Real automatic demo scrolling: 30 → 60 → 90 → 96 rows, with existing selection
  preserved and an explicit terminal state. This was observer-triggered, not Load more clicks.
- Inspector: measured 440/520px widths hide labels, 720px restores them; all toolbar
  actions remain in one row. Full-page navigation, six tab selections and phone layout reviewed.
- Forms: real enquiry/reminder/call/edit dialogs opened in the isolated admin preview.
  Measured enquiry fields are 56px high with zero border width; desktop/390px phone
  dialogs have no page overflow. Required reminder date remains a native required field.
- Additional 30 responsive/tab assertions cover full records at 360/390/600/768/1000/1001/1280/1440/1920px, six selected tabs, task layouts, and Appearance/Developer/Reports/People settings at 390/768/1440px, with no page-wide overflow.
- All 26 affected public screenshots were recaptured with measured source dimensions,
  visually reviewed and checked for fictional-only content. Public Swagger had no
  authorization or executed requests. File examples are memory-only synthetic text.
- Light/dark Book captures use actual guest preferences. Standard captures retain
  the default fonts and 100% scale. These are browser viewports, not physical devices.

Local verification includes 115 backend tests, 60 root tests, real Firebase
Auth/Firestore/Storage emulator integration, form rendering, types, generated API,
secret scan, dependency audit, screenshot hashes, docs, skills and production builds.
Logs and geometry JSON remain in ignored test-results; CI records its own results.

## Limits and deployment evidence

Physical devices, real Google sign-in, production task/attachment writes and native
cross-signal Dynatrace navigation were not repeated during the visual review.
Live cursor network-failure/identity races were not simulated in the browser; helper
regressions and existing server authorization/emulator tests are separate evidence.
Do not turn these limits into claimed passes. Exact production version/SHA, contract,
protected endpoints, function revisions, private Storage, Pages and telemetry receipts
must be verified by the authorized deployment workflow and read-only postchecks.

## Local reproduction

Run `npm run design:dev`, then open `/design-review.html` for width/height presets
or `/design-admin.html` for real settings/forms with fictional memory-only values.
Preview saves cannot issue tokens, grant membership or register devices. The HTML
entries are development-only and excluded from the production bundle.

`npm run design:check` runs focused presentation/form/type/build/isolation checks.
`npm run qa -- release` runs the broader gates and does not deploy. For browser
verification reuse the installed isolated browser through scripts/local-browser.mjs
or an available approved browser tool; never connect a personal authenticated tab.


## Settings field hierarchy and visibility — local 2.2.0

A focused fictional AdminReview pass used 320, 390, 599, 600, 768, 899, 900,
1440 and 1920px viewports in light and dark. The field rows had separate title
and metadata geometry, no page overflow, and action widths of at least 40px.
These are integer viewport boundaries, not fractional-width or physical-device
certification. Screenshots at 390 × 844 and 1440 × 844 were visually reviewed;
curated field-manager captures contain one fictional custom field and no live data.

Removing Phone in the in-memory preview removed its form input, required Email,
retained required name/date and disabled deletion of the last contact field.
Restoration was available. No server configuration or customer records were changed.
At a synthetic 200% root font and 320 × 568 viewport, shared button line height
scaled from the previous fixed 20px to 40px for 28px text. Container-responsive
field actions moved below full-width text, avoiding mid-word title breaks.
The final large-text screenshots were inspected. Browser helper failures from
fractional CDP width and selector quoting were corrected; they were tooling errors,
not recorded as passing coverage. Full local test suites were not rerun.
Backend/emulator regression cases are updated for required CI execution; local
preview behavior does not prove backend persistence or production behavior.
