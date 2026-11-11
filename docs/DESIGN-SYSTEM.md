# SalesDrone 2 interface design system

**Approved v2.0 design:** [review guide](MATERIAL-3-REVIEW.md). Material 3 is the primary
visual system for this redesign, replacing the previous Apple-derived size cascade.
This does not claim native platform behavior, Material certification or Dynamic Type.

## Architecture

`apps/web/src/main.tsx` loads only the Material entry files:

- `material/fonts.css`: existing self-hosted Google Sans/Caveat script subsets.
- `material/tokens.css`: semantic colour, shape, typography, motion and preference roles.
- `material/base.css`: shared actions, dialogs, feedback and utilities.
- `material/controls.css`: filled form fields and progressive native-select menu styling.
- `material/shell.css`: drawer/rail/bottom navigation, top bar and content spacing.
- `material/workspaces.css`: collection, inspector, full lead, conversations, tasks and inbox.
- `material/dashboard.css`: metrics, insights, charts and current-stage distribution.
- `material/settings.css`: personal/admin settings, imports and reports.
- `material/login.css`: authentication presentation.

ThemeToggle owns its component-scoped two-icon pill and indicator transition. The previous global
stylesheets remain unimported for historical references during review. Do not add
another global refresh/override file or mix the v1 cascade into this entry.

## Typography

Default root is 16px, using rem roles so browser text preferences and zoom work.
Use Google Sans headings and Manrope body; alternate fonts change the same roles.

| Role | Size / line height | Use |
| --- | --- | --- |
| Headline | 32 / 40; 28 / 35 on compact screens | Page heading, one per view |
| Title large | 22 / 29 | Dialog/section titles |
| Title medium | 16 / 24 | Named items and sub-sections |
| Body | 16 / 24 | Forms, reading and general content |
| Supporting | 14 / 22 | Conversation text and secondary content |
| Label | 14 / 20, medium | Actions and field labels |
| Metadata | 12 / 18 | Dates, table context and secondary identifiers |

Compact tables use 13px cells and 14px identity actions, keeping rows scannable.
Do not shrink the entire app by default. Personal display scale is 85–125% on all viewport sizes, applied after saving.
Touch targets compensate at smaller scales rather than forcing mobile to 100%. Phone text inputs stay 16px. Monospace contact
numbers are deliberate. Book mode uses handwriting roles, preserving monospace identifiers.

## Colour, shape and motion

Use `--md-sys-color-*` semantic pairs, not literal per-screen palettes. Primary blue
identifies action; secondary container identifies selection. Surface levels group
related areas. Error and tertiary pairs express semantic states with text labels.
Four palettes cover day/night and Book day/night. Text role pairs require >=4.5:1.
Legacy variable names are aliases to these roles for functional component compatibility.

Spacing uses a 4px grid. Rounded chips are 8px, filled form fields and dropdowns 12px corners, cards 20px and dialogs
28px. Filled primary, tonal, outlined and text buttons carry distinct emphasis.
Desktop actions have 40px visible containers; phone/coarse-pointer actions are 48px.
Focus rings are visible, 3px with offset. Reduced motion disables transitions; normal
state changes use 160ms and entrances 240–260ms. Dragging follows the pointer directly.

## Responsive composition

- >=1200px: 232px drawer or user-collapsed 88px rail; lead conversation/details panes.
- 600–1199px: labelled 88px navigation rail. Lead inspection opens a dedicated record
  below 1001px; details stack after activity below that width.
- <600px: modal navigation drawer, 64px bottom navigation (plus safe-area inset at 100% zoom) and full-width content.
- Lead tables switch to cards below 768px. Additional columns scroll locally.
- Settings uses a searchable directory with a category rail on wide screens and focused pages with back navigation on phones.

These are web content breakpoints, adapted from Material principles rather than
native device detection. Keep horizontal scroll within tables, tabs, charts and the
stage path. Long names/labels must wrap. A long details card must never stretch the
conversation tab/action rows; the two panes have independent internal layout.

## Workspace structure

Use the shared workspace heading for the page title, a concise description and primary actions. Lead details use the record name as the document heading. Lead Assistant keeps a compact conversation header with visible New chat on larger screens.

Place controls beside the results they affect. Show the active field beside the lead distribution, keep the Team date form together, and put the archive scope alongside Run scan. Keep page-level navigation separate from those controls. Workspace lists describe loaded counts explicitly when more results can be fetched. Deep workflows expose links to saved work, such as import history.

## Verification

Use `tests/material-design.test.ts` for colour contrast, configured table identity,
retired/hidden fields and production entry isolation. Start `npm run design:dev` and use the local review canvas
for width/height inspection. These tests are not proof of visual layout. Read the
actual observation limits in the review guide. The user approved v2.0 on 26 October 2026. Full release checks and measured
browser evidence remain distinct from production post-deployment verification.

References: [Material colour](https://m3.material.io/styles/color/the-color-system),
[typography](https://m3.material.io/styles/typography/applying-type),
[type roles](https://m3.material.io/styles/typography/type-scale-tokens).

## Form and local-scroll contract

Lead, call, reminder, reschedule and task-edit forms use 56px borderless filled fields with
persistent inset labels, 16px entry text and 12px labels. Custom fields use the
same pattern; checkbox/radio semantics stay separate. Dialog field rows use 28px
vertical gaps, supporting text remains below the field, and the action group
has explicit spacing. Keep names, required fields, form submission, dates and
existing mutation handlers intact.

All select triggers use a single chevron; form fields use the borderless filled surface. Native select
semantics preserve keyboard navigation and validation. Browsers supporting
`appearance: base-select` also receive a Material menu surface and selected states;
other browsers keep the platform option picker. Do not claim identical popup
rendering across browsers without inspecting them. References:
[fields](https://m3.material.io/components/text-fields/specs),
[menus](https://m3.material.io/components/menus/guidelines).

The desktop lead table has its own focusable scroll region and native horizontal
scrollbar. When columns overflow, a visible range control and previous/next buttons
sit above the table; they reflect native wheel/trackpad scrolling and resize. These
controls disappear when all columns fit and in the phone card layout. Do not rely
on macOS scrollbar visibility to make additional columns discoverable.

The composer wrapper, not just the form's former parent, owns its inner spacing:
24px on desktop and 16px inline on compact screens. All activity tabs keep aligned
section headings and content edges. Blade actions must stay on one line per button;
wrap the action group onto another row when necessary.

At lead container widths <=560px, the header actions become icon-only on one row;
labels return above that width. Accessible names and hover titles remain. The rule
follows the actual resizable blade/full-page width, independently of the viewport.

## Mobile layout regression contract (local 2.0.1)

The actual `.leads-table` section is the grid item and spans all columns. Test its
width against the grid content box; no page overflow alone does not prove the
layout fills available space. Phone cards align identity, company and score across the full row. Batch editing
and its checkboxes are available on wider screens.

Below 768 CSS pixels, the title actions include separate search and filter icons.
Search opens with input focus. Filters include stage and use explicit Apply, Cancel
and Reset. Escape preserves applied criteria and both dialogs restore trigger
focus. Desktop retains inline search, stage shortcuts and the filter disclosure.

Dropdowns/filled fields use 12px rounded corners. Material supports a shape scale,
not a single universal radius; see the [official Material shape guidance](https://developer.android.com/develop/ui/compose/designsystems/material3#shapes).
The sign-in landing page and workspace header omit the Avinya Enterprises logo.
SalesDrone branding and the sidebar textual attribution remain. Brand text is an
explicit two-line aligned block.

Saved zoom now applies to phones as well. Use zoom-aware viewport dimensions for
fixed drawers/dialogs and compensate minimum touch sizes at <100% scale. Verify
all five values through actual Save changes, not root CSS injection. Browser/pinch
zoom remains available. These changes are a local patch pending review/publication.

### Task collection hierarchy (local 2.0.1)

Tasks uses the same compact phone title/New composition as Leads. Below 768px a
status picker replaces the three status buttons; desktop keeps labelled status
buttons and Add reminder. The loaded count describes the current page collection,
not a workspace total. Timezone context appears once above the list.

The Tasks register uses aligned columns for task, lead, responsible person, due
date and actions once the list panel has 740 CSS pixels. Below that width, group
lead and responsibility beneath the task title. On phones, put the due date and
Reschedule on the bottom line and keep the menu beside the title. Below 290 CSS
pixels of panel width, Reschedule uses a calendar icon with an accessible label.
The completion circle stays 22px inside its touch target. Titles and lead/company
text wrap. Escape, outside pointer and focus leaving dismiss the row menu. These
layouts apply in Standard and Book mode.

### Shared theme control (local 2.0.1)

The quick theme control is one native button with a 64px sun/moon pill inside its
44px desktop or compensated 48px phone hit area. A solid primary/on-primary circle
marks the resolved current mode; the action label names the opposite mode. The
indicator travels 28px in 160ms, with no transition under reduced motion.
Semantic surface/outline pairs adapt to standard and Book palettes. System remains
a Settings choice; the quick action chooses explicit Light or Dark. Busy saves
disable the button and expose aria-busy; existing save/rollback policy is retained.

The mobile bottom-navigation selection fills the rounded button behind both icon
and label. Use the button's active background, not a separately positioned icon
pill; preserve the compact bar height and compensated touch target.

The outreach chart's Day select uses a rounded filled surface, vertically centered
value and reserved right padding for the shared chevron. Keep the full date on one
line; allow the caption metrics to wrap independently. Retain the native select,
Chart day name, keyboard focus and existing local day-selection behavior.

### Startup loading

The initial workspace loading state centers the brand, spinner and status text. The spinner sits above the message; the message remains centered when wrapping at mobile widths. Startup uses 24px shell padding and no nested horizontal loading padding. Inline/panel loaders retain their row layout with centered message text. This is presentation only; loading status semantics and reduced-motion handling are unchanged.


## Settings field rows (2.2)

Field titles and supporting descriptions occupy separate lines with a 4px gap.
Use a shrinkable text column and trailing edit/delete icon targets at every width;
long names wrap within the text column. Explanatory notices stack title and body.
Inline field editors span the row. Delete and restore actions have accessible names
and hover titles; name/date and the last available contact field show their
minimum-save requirement rather than silently allowing an unusable enquiry form.

Shared action buttons use a unitless line height (20/14) so multiline labels grow with enlarged text instead of overlapping at the former fixed 20px height.

## Lead workflow and chart geometry (2.2.1)

The lead header owns workflow spacing: stage/assignment labels and controls share type, margins and full width; section padding/dividers do not apply inside this group. A 36rem content-container threshold stacks them. Trend Y ticks share the SVG gridline coordinate transform, with a dynamic text gutter and the dates in the plot column. Do not apply the HTML layout grid to the SVG element.

Modal selects retain appearance:none on the closed control, the shared chevron and filled-field dimensions/padding. Their open menu stays native to avoid modal Escape conflicts. Do not restore appearance:auto on the closed select: native macOS sizing can collapse its inset label/value area.

## Lead Assistant agent page proposal

Use a dedicated conversation page with a centered reading column, rounded filled
composer, optional starter prompts and history opened on demand. Keep index controls
in Settings; do not permanently surround the chat with status cards or side panels.
Results use compact accessible lead lists and collapsed source evidence. Preserve
current Material colour roles, fonts and compensated mobile touch targets.

The [agent plan](LEAD-ASSISTANT-AGENT-PLAN.md) distinguishes the synthetic interaction
prototype from implemented query support. Browser review covered 390px empty/results
and history, plus a 1280px welcome view; this is not physical-device certification.

Lead Hygiene shares the page-body wrapper: desktop 32px side gutters, intermediate 24px and compact 16px. Keep the heading, archive option and report grid on those edges. Lead Assistant uses one message per question; scope and current-state context sit in collapsed Answer details, while material setup/partial-data limitations stay in the reply and each result list retains its own controls.

## Compact product navigation and Team

The sidebar retains its 232px drawer / 88px rail but uses 36px pointer rows, 18px icons, 8px selection shape and compact group headings. Phone/coarse controls retain at least 48px targets. WorkspaceNavigation registers capability-gated Workspace, Insights and Manage destinations for sidebar, quick navigation and route discovery; subviews stay in their module. The product list scrolls independently from branding and profile/utilities. Rail mode keeps destinations reachable after drawer-group collapse. Team uses tonal view switches, four summary cards, count-scaled charts and a comparison table; phones use member cards and a stacked chart layout. See [TEAM.md](TEAM.md).

A lead opens as a dedicated page with the Comments tab active. Show Sales stage and Assigned to as read-only header values and keep their controls in Edit enquiry. Order the Journey, Details and Activity cards in the DOM so screen readers and keyboard navigation follow the same arrangement. Pointer dragging is confined to the grip, and move buttons offer an alternative. Use a brief Material easing on reposition and an immediate move under reduced motion.

Full lead cards share one heading row with reorder controls. Group company, phone and configured header values in a wrapping line below the lead name, with configured field labels available to assistive technology. Give dial links an icon, monospace digits and a comfortable touch target. Keep workflow values beside the identity when there is room and below it on narrow screens. This presentation uses existing lead and field settings responses and needs no new API or business event. The detail loader reserves the header and journey shapes. Activity and qualification changes use a brief fade with the existing Material timing tokens and honor reduced motion. Use the distinct Field order and Lead page header settings under Lead fields for Admin layout changes.

The mobile navigation drawer uses one scroll surface from the brand to the account footer. Keep its bottom safe-area padding, contain scroll chaining and avoid putting the navigation groups inside another scroll container on phones.

Settings opens with a searchable directory and grouped action rows. Desktop shows a category rail and a bounded content surface. Mobile opens a focused section and provides a back link to its group. Filter Admin destinations before matching search. Keep the selected destination in the URL and move focus to the section heading. Save actions follow the settings rows in normal document flow. The header editor previews fictional values with the production header component.

## Personal palettes and book pages

Appearance & time offers Ocean, Forest, Plum, Terracotta and Black & white.
Each accent supplies paired Material 3 primary, secondary and tertiary roles
in light and dark schemes. The full drone mark uses the selected primary tone.
Keep the original compact mark and favicon as established product identifiers.

Open Sans, Source Serif 4, Patrick Hand and Caveat are self-hosted. Handwritten
styles have larger body and label roles. Book mode uses Caveat for headings and
Patrick Hand for reading and controls. Phone numbers stay monospaced. The
workspace uses a bound page with a margin rule, bookmark tabs and ruled form
fields. The lead index presents four loaded entries on one sheet. Scroll, swipe or use
Previous and Next to turn the sheet. The focused sheet accepts Left and Right
arrows and Page Up and Page Down. Back to leads restores the source sheet and
entry focus.
The visible workspace page curls as a whole, including its heading and filters.
Dashboard uses four sheets and shares the Leads page controls. Reduced motion
switches pages immediately.

The dashboard snapshot uses one decorative AI badge beside its label and content. About SalesDrone panels share the same outer edges, with a narrower reading measure for prose and illustrations.
