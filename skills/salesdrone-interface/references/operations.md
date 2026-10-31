# Operational reference

Use the current source and [shared contract](../../SHARED.md) when applying these module-specific recipes. Release dates, prior approvals and screenshot versions are historical evidence in [CHANGELOG](../../../CHANGELOG.md) and [release plans](../../../releases/); they never authorize a new deployment.

## Local design review and verification

[design-review.html](../../../apps/web/design-review.html) is a development viewport
canvas. [AdminReview.tsx](../../../apps/web/src/review/AdminReview.tsx) renders real
settings with labelled fictional in-memory fixtures; it has no API transport,
blocks token/device actions and must not enter the production bundle. Do not attach
it to App.tsx or add its HTML to build inputs. `check-design-build.mjs` checks isolation.

Use the approved browser tools when available. Record actual widths/themes/dialogs
and explicit gaps in MATERIAL-3-REVIEW.md. Do not infer visual success from CSS or
builds. Refresh all affected public captures after approval and before release.

## Deployment and adjacent ownership

Use [release readiness](../../salesdrone-release-readiness/SKILL.md) and
[release](../../salesdrone-release/SKILL.md) only after approved design. Preserve the current generated API
contract unless domain behavior changes; production instrumentation remains
owned by observability. Adjacent modules: leads, conversations, tasks-reminders,
notifications, attachments, dashboard, workspace-settings, book-mode and product-guide.

## Review feedback: fields, spacing and horizontal scroll

`material/controls.css` owns persistent filled form fields and select triggers. Keep
native form/select semantics; customizable-select browsers also get the themed
picker, while other browsers retain the platform option menu. Do not fabricate
uniform popup behavior. Forms use `.material-field > .field-label`; checkboxes
stay outside this pattern. `design:forms` renders real components to check labels,
required dates, configured field names and actions. Geometry requires a browser.

`WorksheetLeads` measures table overflow with ResizeObserver and synchronizes a
visible range/arrows with native scrollLeft. Clean up observers/listeners. Hide the
entire desktop wrapper below the card breakpoint, and controls when nothing
overflows. Keep the scroll region focusable and locally bounded. A hidden macOS
scrollbar cannot be the sole overflow affordance. The composer lives in
`.lead-composer-region`; padding must target its actual structure. Blade action
text stays nowrap while the toolbar wraps. Review cases MATERIAL-02 through 05.

User review removed rectangular form-field borders. Keep inset labels on a filled
surface, an active underline and keyboard-only focus outline; do not restore
notched outlines as the default. Preserve the 56px field height and native semantics.

Lead toolbar labels hide at a lead-surface container width of 560px or less.
Keep explicit aria-label/title on Back, Files and Edit; expansion already has them.
Use uniform 44px icon controls (48px touch) in a single row, restoring labels when
the blade grows. Do not use a viewport-only rule for a resizable desktop blade.

### Infinite lead footer

InfiniteLeadLoader observes the real list footer, including inside the review
iframe and scroll ancestors. Keep loading/end states, keyboard fallback, explicit
retry on error and one automatic attempt per cursor. Disconnect on unmount and
disable while busy; App owns request locking and stale-response guards. The demo
contains 96 fictional rows so local scrolling can be checked beyond 12 records.

## Mobile regression contract

The actual grid item `.leads-table` must span all columns; measuring only root
overflow missed a narrowed list. Assert section/content-box width and card/name
alignment. Mobile filters use MobileLeadFilters with draft Apply/Cancel/Reset and
trigger focus restoration; desktop disclosure is retained. Fields/dropdowns use
12px corners. Login and the workspace header omit the enterprise image; the sidebar keeps
textual attribution. Phone header/nav are 56/64px at 100%, plus safe areas. Zoom applies on mobile
as well; compensate touch targets and fixed viewport sizing at smaller scales.
Do not restore the older desktop-only clamp. Fonts and access policy stay unchanged.


### Collection header hierarchy

Keep mobile title/New on one row, intro copy hidden, and secondary export/import
actions behind the named More disclosure. Desktop keeps visible secondary actions.
Use one mobile stage picker instead of the stage-chip strip; search/filter targets
stay usable. Overflow closes on outside pointer, Escape and action selection.
Export focus returns to More on mobile and its own button on desktop. Compact
counts preserve an exact accessible name; tiny layouts can omit the count badge.

### Task collection alignment

Tasks shares the compact mobile title/New and picker hierarchy with Leads; keep
desktop Add reminder/status buttons. TaskRow owns a grid for completion, identity,
date and menu; the 22px symbol sits inside a compensated touch target. No separate
Edit/Delete row. Long names/titles wrap, dates align under identity below 768px and
the list fills the content box. Fonts, themes and personal scale remain shared.

### Theme control

ThemeToggle uses one native button with sun/moon icons and a solid indicator for
the resolved current mode. The named action switches to the opposite explicit
mode, preserving System following in Settings and Book mode. Keep the existing
changeTheme persistence/error/busy path, keyboard focus and compensated touch
target. The indicator moves 28px in 160ms, disabled under reduced motion. Use
semantic Material colour pairs rather than gradient day/night palettes. Refresh
affected login/workspace public captures after approval; local captures do not
replace or relabel published v2.0 images. No API or new audit/event is introduced.

### Mobile selection and header branding

The workspace header omits EnterpriseBrand on every width; preserve SalesDrone
branding and the sidebar attribution. Mobile lead articles use a leading selection
column rather than an absolutely positioned trailing checkbox. The name no longer
reserves trailing selection space. Without a selection control, the open action
spans the row. Keep checkbox and open actions independent and keyboard-accessible.

The mobile bottom-navigation selection fills the rounded button behind both icon
and label. Use the button's active background, not a separately positioned icon
pill; preserve the compact bar height and compensated touch target.

## Archives

Settings Archives reuses scoped data and responsive cards with wrapping contact fields; demo archiving retains the fictional record with archived=true and removes it from the active filter and summary. Never connect the demo to live archive endpoints.

## Startup loading alignment

Loading wraps its message in a span with centered text and a non-shrinking spinner. The startup shell uses 24px outer padding and a full-width vertical Loading row with no extra horizontal padding, keeping the spinner and wrapped message centered on phones. Inline/panel loading keeps its existing row layout. The synthetic AdminReview preview=startup renders these exact components without authentication or live API calls. This is CSS/markup only: no API, permission or business-event change.

## Settings supporting text and delete controls

.settings-field-row uses a minmax(0,1fr) text column plus a compact action group, including phones. Its direct span is a grid with a 4px title/metadata gap, explicit type roles and anywhere wrapping. Do not rely on adjacent strong/small inline elements for separation. settings-notice stacks title and body; standard-label-editor spans both row columns. Delete/restore icons retain accessible names, hover titles, minimum-requirement descriptions, focus and compensated touch targets. Form visibility belongs to workspace-settings; visual changes introduce no new API telemetry or business events. Inspect long names, both themes, narrow widths and enlarged text with synthetic fixtures.

Shared action buttons use a unitless line height (20/14) so multiline labels grow with enlarged text instead of overlapping at the former fixed 20px height.

## Header and chart review

Lead header workflow children reset inherited detail-section padding/borders. Keep equal label type/margins and full-width selects; below a 36rem lead-surface container, stack stage/assignment instead of squeezing them into adjacent columns. The score row can wrap and centers its items. AdminReview preview=lead-header uses real LeadBlade/Assignment with fictional in-memory state; never include it in production. Review compact and wide surfaces, assignee help expansion and keyboard controls.

## Collaborative imports

ImportReviewPanel shows paginated history and row candidate/current/incoming comparisons, deliberate clears and paused progress. Read-only grants hide mutations. Conflicts start unchecked; choosing a match only compares. Guard async responses against stale jobs/filter changes. Keep Material 3, wrapping and named icon controls.

## Layout and typography recipes

The v2 surface uses Material colour pairs, 16px body/forms, 14px labels/supporting,
12px metadata and 32px page headlines (28px compact). Standard keeps self-hosted
Google Sans headings and Manrope text; personal font choices remap the same roles.
Caveat remains on sign-in conversation lettering. Phone identifiers stay monospace.
Book mode remaps palette/type roles without changing geometry. No default global
zoom reduction: retain the explicit personal scale setting with usable touch targets.

Desktop uses a 232px drawer or 88px collapsed rail. Medium screens use the labelled
rail; <600px uses a modal drawer and bottom navigation. Settings uses a section
selector below 900px; table cards appear below 768px. Breakpoints serve content,
not platform detection. Escape, focus restoration, skip link, reduced motion and
local scrolling remain required. Keep SalesDrone and Avinya branding.

The full record’s details and activity panes size independently: a long details card
must not stretch action rows or tabs. Notes are composed inline; All includes every
loaded activity, Comments/Calls filter types, Tasks remains recipient-private and
Files uses its own private transport. Review describes only loaded actionable states.
The Files inspector shortcut must survive asynchronous same-lead loading; opening a
different lead starts All. Preserve keyboard tab wrapping and comment drafts.

