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
numbers are deliberate. Book mode uses serif roles, preserving monospace identifiers.

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
- Settings navigation becomes a section dropdown below 900px.

These are web content breakpoints, adapted from Material principles rather than
native device detection. Keep horizontal scroll within tables, tabs, charts and the
stage path. Long names/labels must wrap. A long details card must never stretch the
conversation tab/action rows; the two panes have independent internal layout.

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
layout fills available space. Phone cards align identity, company and score while
keeping selection away from the name. The native search input has no nested box.

Below 768px, filters use a Radix dialog with separate drafts, explicit Apply/Cancel
and draft Reset; desktop retains the disclosure. Escape/Cancel must preserve
applied filters and restore trigger focus. Reset is not a server mutation.

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

Task rows use a grid: completion target, flexible identity and an anchored action
menu. Dates sit under the identity on phones and in a separate column on desktop.
The completion circle is 22px inside a compensated 48px phone target; never enlarge
the visible circle to the entire target. Titles and lead/company text wrap. Edit,
delete and pending-only scheduling actions share one menu, including for completed
and cancelled tasks. Escape, outside pointer and focus leaving dismiss it.

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
