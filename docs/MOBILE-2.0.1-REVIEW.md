# Mobile corrections — local 2.0.1 review

This document records the local **2.0.1** review on `fix/mobile-2.0.1`.
Historical local-only statements below describe their review stage; release status
comes from the PR, workflow artifacts and exact live version/SHA checks. Use `npm run design:dev`
and Explore the demo at http://127.0.0.1:5180 to review it.

## What failed and what changed

The lead collection's outer `.leads-table` section was the actual grid item, while
its full-width rule targeted a nested `.leads-table-card`. Consequently the list
occupied one grid column with unused space alongside. An overflow-only check missed
that defect. The outer section now spans the grid, with zero duplicate panel padding;
regression checks compare its width with the grid's content box.

Phone lead cards use the full available width. Names keep a consistent left edge,
company and score share a row, and city/contact details sit below. Selection stays
clear of the name. The search input no longer has a second rectangular box inside
the pill; very narrow screens use a named filter icon to retain input room.

Mobile Filters opens a focus-trapped dialog rather than expanding the list. Search
field, stage, source and up to 16 column conditions are drafts. Apply commits once
and closes; Cancel/Escape discards; Reset clears the draft until Apply. Focus returns
to the filter trigger. Existing desktop inline filtering and server query policy
remain unchanged. Labels and choices continue to use admin field configuration.

Shared controls use rounded 12px fields and dropdowns, without changing fonts or
adding input borders to filled forms. The sign-in landing page shows SalesDrone
branding and the theme toggle; the Avinya Enterprises image appears in the workspace,
smaller than before. SalesDrone's wordmark/tagline form an aligned two-line block.

At 100%, the phone header is 56px and bottom navigation is 64px plus the device
safe area. Icons/labels and the selection indicator are smaller, while touch targets
remain usable. Saved Display zoom now applies on phones/tablets as well as desktops.
85/90% compensate touch sizes; larger values intentionally enlarge controls. Fixed
drawers/dialogs use scale-aware viewport dimensions. Browser/pinch zoom remains enabled.

## Actual local evidence

`npm run review:mobile` drives the real app using trusted touch events in an already
installed isolated Chromium profile. It does not use private identities or live data.
The sweep covers login, dashboard, full-width leads at 320–1440 CSS pixels, filter
Apply/Cancel/Reset/focus, all six lead tabs, tasks, notifications, reports, enquiry/
call/reminder/task dialogs, admin settings sections, import preview and public Swagger.

The recorded sweep contains 102 viewport/interaction cases plus contained assertions.
All five percentages are saved through the real guest preference form; root zoom
matches the selected value, controls remain usable and no page-wide overflow occurs.
At 85/90/100%, measured bottom navigation remains 64px without a device safe inset;
at 110/125% it grows with the deliberately larger setting. Source screenshots and
JSON are in ignored `test-results/mobile*` and are not relabelled production captures.

The regression script, type checking, real-form render checks, unit/API tests and
local production-shaped build are separate evidence. No physical phone, Safari
hardware keyboard/IME or signed-in production write is claimed. Native option
pickers can still differ where customizable-select is unsupported.

## Release work after review

The release plan declares changed screenshots. Existing public v2.0 captures remain
honestly versioned; readiness must not accept them as new 2.0.1 captures. Refresh the
approved public assets, then run the full release gates and normal GitHub workflow.
Do not send a deployment event for this local draft.

Task action menus measure available room above/below their trigger, scroll within
that space and close after an action. The touch sweep includes an anchor near the
bottom navigation, with bounds checked in both axes. Dark and Book day/night
lead layouts were additionally inspected at 320/390/768px.

## Follow-up: quieter collection header

Mobile now puts Leads and its count beside the primary New action. The intro
sentence is hidden on phones. Export and admin-only Import live in More lead
actions; desktop keeps its existing visible buttons. The menu closes on outside
interaction/Escape or choosing an action; closing Export restores focus to More.

Search takes the main row with a compact, named filter icon and active-count badge.
The horizontal stage-button row is replaced with one All stages picker and a quiet
loaded-count label. The picker includes every configured stage and uses the same
applied stage as the filter dialog. On especially narrow screens New becomes an
icon and the count badge is omitted; exact total remains in its accessible name
when displayed, and larger mobile counts use compact notation. No filter, export,
permission or data-loading behavior changes.

The browser regression now checks that the introductory sentence/stage buttons are
hidden on mobile, the stage picker exists, the list begins within the expected
viewport, More closes with Escape, and Export is reachable through More with
focus restoration. These checks supplement the existing full-width and zoom sweep.

## Follow-up: task collection and rows

Tasks now uses the Leads phone composition: title/New together, no introductory
sentence, one Pending/Completed/Cancelled picker and a quiet loaded count. Desktop
keeps Add reminder and status buttons with pressed states. The repeated “Your next
steps” heading is removed; display timezone appears once above the list.

Rows fill the available content width. A small completion circle sits inside a
full touch target, title and lead/company context form one accessible open action,
and the due instant follows the same identity edge on phones. Desktop puts due
time in its own column. Upcoming is not repeated on every pending row; Overdue
remains explicit. One row menu holds edit/delete plus pending-only snooze,
reschedule and cancel. Completed/cancelled tasks retain edit/delete. Menus close on
Escape with trigger focus, outside pointer, focus leaving or action selection.

API, recipient privacy, capability checks, task versions, soft deletion and
delivery behavior are unchanged. This is presentation only: existing task API
metrics/traces/logs and committed events remain authoritative, with no new API or
cosmetic business event. New task public captures are declared in the release
plan for later review; existing public v2.0 images remain untouched.

The task-focused local stress run passed 14 checks: long mixed-script/unbroken
titles saved through the real demo edit form at 320/390/600/768/1024/1280/1920px
with 600px height, a 200% root-text fixture, and real iframe widths at
599.5/599.99/600/767.5/767.99/768px. Root-text enlargement is synthetic, not native
accessibility certification. Screenshots and stress.json remain in ignored
`test-results/task-review/`. Fresh standard 320/390/768/1280/1920px captures were
visually inspected at 320 and 1280; the large-text capture was also inspected.

The extended mobile regression covers task list/content width, symbol/target
sizes, menu alignment, empty/completed/cancelled states, edit/reschedule/delete
dialogs, Escape/focus/outside dismissal and in-memory completion/cancellation.
Task geometry also runs at five saved scales and dark/Book palettes. Return
navigation from Tasks to Settings during the added scale cases is programmatic:
the touch harness intermittently failed that return at 125%, while a focused
trusted-touch replay succeeded. This does not certify phone navigation at 125%.
No physical device, Safari, live task write, reminder delivery or tenant-query
verification is claimed.

Final integrated browser run: `npm run review:mobile` passed **135** recorded
viewport/interaction checks, plus its contained assertions. Standard dark and
Book day/night task captures were visually inspected at 390px. `npm test`,
`npm run check`, `npm run build`, production fixture exclusion, `design:forms`,
`docs:check`, `docs:build`, `skills:check`, `security:scan` and `git diff --check`
passed locally. This extends the earlier 102-case evidence; it is not a deployment.

## Follow-up: shared theme button

The previous gradient/horizon button is replaced by a compact sun/moon pill on
login and the workspace toolbar. A solid primary-colour indicator marks the
resolved active mode. One tap, Enter or Space chooses the opposite explicit
appearance. System still follows the device until an explicit choice; Settings
retains the System option. Book mode, account/guest isolation, pending-save
disabling and failure rollback keep the existing handlers. There is no new API,
permission, preference or business-event payload.

`node scripts/review-theme.mjs` passed 46 checks covering login/workspace at
320/360/390/600/768/1024/1280/1920px; trusted touch and Enter/Space; guest-local
persistence; emulated System changes and explicit override; reduced motion;
stored 85/90/100/110/125 zoom fixtures; and Book light/dark. Phone targets retain
44px minimum measured size. Fine-pointer controls scale with the existing
personal preference. Stored scale fixtures are separate from the earlier
actual-save zoom sweep and do not certify account persistence.

`npm run check`, build and production-fixture exclusion, five focused appearance/
Material tests, docs generation/check/build, skills check and security scan passed.
Screenshots and sanitized JSON are ignored in `test-results/theme/`. The control
was visually inspected in the in-app browser on login and the workspace at
390px, plus focused light/dark header captures. No physical device, Safari, live
account save or tenant-query claim. Public v2.0 images remain untouched; release
captures still wait for review.

## Follow-up: leading lead checkboxes and header logo removal

The earlier mobile card explicitly anchored selection to the upper-right. It now
uses a leading grid column: the checkbox and card-open button are separate
actions, names share one start edge and no name padding reserves trailing
checkbox space. A card without selection spans both columns. Desktop table
selection and batch policy remain unchanged. The Avinya Enterprises logo beside
the theme control is removed from the workspace header at every width; the
sidebar attribution remains. This supersedes the earlier smaller-header-logo
review decision without removing historical screenshot evidence.

`npm run review:mobile` passed 149 recorded checks plus contained assertions.
New checks measure leading target/name geometry at 320/390/600/767px, common name
alignment, select/deselect without opening a record, and 320/390px placement at all
five actual saved zoom percentages. The sweep also covers desktop, dark and Book
layouts and asserts no enterprise-brand element in the workspace header.
390px standard light/dark and Book day screenshots were visually inspected.

Types, production build/fixture exclusion, six lead-pagination/Material tests,
docs generation/check and skills check passed locally. Captures remain ignored
in `test-results/mobile/`; published v2.0 screenshots are untouched. No API,
permission, event or live customer write changed. Browser evidence is not
physical-device or Safari certification. Version remains local 2.0.1.

### Bottom-navigation selection marker

Replaced the detached 48x24 icon-only pseudo-element with the active button's
rounded background, enclosing both icon and label. Bar height, targets, handlers
and API/event behavior are unchanged. Per the user's request, no automated
suites were repeated for this small CSS refinement. Version remains local 2.0.1.

### Outreach chart Day selector

The chart-specific select was overriding shared chevron padding with 6px/10px,
leaving the date and arrow crowded. It now reserves the shared 44px right padding,
centers the value vertically and uses a rounded filled surface with room for the
complete ISO date. Native day selection and caption metrics remain unchanged;
there is no API or telemetry change. No automated suites were repeated for this
small CSS refinement, following the user's review instruction.
