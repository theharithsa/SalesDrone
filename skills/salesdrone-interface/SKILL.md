---
name: salesdrone-interface
description: "Maintain SalesDrone shared responsive shell, navigation, typography, themes, accessible overlays and synthetic demo adapters. Use for cross-module UI work; feature logic belongs to the corresponding domain skill."
---

# Interface and demo shell

Read [the shared operating contract](../SHARED.md) before editing. Paths and commands
are relative to the repository root. Inspect current source rather than assuming
this map is an immutable schema or a standalone microservice.

## Responsibility and entry points

App session → shared shell and route → lazy feature → shared form/modal/filter components → demo adapter or authenticated API → explicit loading/error/refresh.

- [apps/web/src/App.tsx](../../apps/web/src/App.tsx)
- [apps/web/src/main.tsx](../../apps/web/src/main.tsx)
- [apps/web/src/styles.css](../../apps/web/src/styles.css)
- [apps/web/src/ui-refresh.css](../../apps/web/src/ui-refresh.css)
- [apps/web/src/settings-refresh.css](../../apps/web/src/settings-refresh.css)
- [apps/web/src/brand.css](../../apps/web/src/brand.css)
- [apps/web/src/lib/demo.ts](../../apps/web/src/lib/demo.ts)
- [apps/web/src/lib/types.ts](../../apps/web/src/lib/types.ts)
- [apps/web/src/components/UI.tsx](../../apps/web/src/components/UI.tsx)
- [apps/web/src/components/ThemeToggle.tsx](../../apps/web/src/components/ThemeToggle.tsx)
- [apps/web/src/components/EnterpriseBrand.tsx](../../apps/web/src/components/EnterpriseBrand.tsx)

## Primary API ownership

No module-specific HTTP endpoints. This module supports the shared application surfaces.

Read the exact request/response/error schemas in [OpenAPI](../../docs/openapi.json)
and the route handler in [app.js](../../functions/src/app.js) when changing an API.

## Data and invariants

Browser presentation/in-memory demo state; authenticated data flows only through lib/api.ts. Demo fixtures contain synthetic records, not production snapshots.

- Preserve Google Sans headings, Manrope body, Google Sans first names in expanded lead detail, normal table names and monospace phone numbers.
- Keep SalesDrone and Avinya marks, blue accent, top-right theme toggle and bottom sidebar collapse control above Settings. Profile images come from verified identity.
- Mobile uses bottom navigation and a Settings section selector. Controls need touch/keyboard accessibility, visible focus, Escape behavior and overlay focus restoration.
- Use apple-design when available. Respect reduced motion; do not block input behind decorative animation or infer historical funnel conversion.
- Demo operations match contract semantics and reset in memory. Do not copy live lead data into fixtures or bypass backend policy with optimistic UI.

Settings groups AvinyaIntelligence in an accessible aria-expanded accordion with indented children on desktop and a native optgroup on mobile. Keep existing section deep links and permission-filtered children; avoid horizontal overflow from long group labels.

Lead export uses the shared focus-managed Modal, native checkboxes, progress/cancel states and a worker-built XLSX. Controls must wrap on mobile and stay readable in both themes; close/account-policy changes cancel pending work.

Manage fields and AvinyaIntelligence use separate expanded states; selecting a child opens its group without resetting edits. Shared settings-sections.json controls section identity, group and Admin filtering; keep mobile optgroups and deep links consistent. Read settings documentation through the in-app guide link.

[LeadBlade.tsx](../../apps/web/src/components/LeadBlade.tsx) provides non-modal fixed desktop inspection above the unchanged table and a dedicated /leads/{id} workspace. Resize remains direct and browser-local; the expand icon navigates, it no longer maximizes an inline column. Keep Escape/focus restoration, Back/Forward/deep-link authorization, responsive horizontal journey and reduced motion. [LeadTaskTab.tsx](../../apps/web/src/components/LeadTaskTab.tsx) pages recipient-private lead tasks with stale-request cancellation. The full page has accessible All, Comments, Calls, Tasks and Review tabs; Review filters only loaded actionable automatic-reminder states and explains historical pagination. Navigation uses fixed icon cells and explicit smooth desktop collapse; Documentation sits above Settings.

## Change and diagnosis

Use the approved browser tool with synthetic demo data. Measure desktop/mobile viewport and horizontal overflow; check both themes, long names/labels, empty/error/loading states and keyboard focus. Do not claim physical-device testing from a resized viewport.

## Verification

- [tests/lead-fields.test.ts](../../tests/lead-fields.test.ts)
- [tests/dates.test.ts](../../tests/dates.test.ts)
- [tests/import-mapping.test.ts](../../tests/import-mapping.test.ts)

Apply the shared verification matrix to the changed behavior; these are the
module-specific regression entry points, not a substitute for integration checks.

## Deployment and handoff

Hosting. Coordinate shared types/API adapters with affected domain skills; TypeScript/build plus browser proof are required for visible changes.

Use [the release skill](../salesdrone-release/SKILL.md) for authorized publication.
Adjacent owners:

- [salesdrone-authentication](../salesdrone-authentication/SKILL.md)
- [salesdrone-workspace-settings](../salesdrone-workspace-settings/SKILL.md)
- [salesdrone-notifications](../salesdrone-notifications/SKILL.md)
- [salesdrone-dashboard](../salesdrone-dashboard/SKILL.md)

Full-page identity overrides the compact blade’s stacked name: use inline name spans inside a wrapping block heading. Keep avatar, company and badge in independent grid cells. Container-width changes move the badge below the name; test long unbroken/multi-part/non-Latin names at narrow widths without clipping or table changes.

InlineCommentComposer is mounted per lead/account and hidden rather than unmounted on tab switches. Keep draft memory-only, no autofocus on navigation, 17px textarea text, left-aligned timeline, visible loading/error recovery and disabled blank/in-flight posts. Guard selected identity and detail epochs for refresh/pagination/Back navigation. Use browser-storage helpers for noncritical preferences and sign-in cleanup. Avatar initials must handle grapheme clusters and missing names.

All is the initial full-page view and includes every loaded activity, contact/follow-up review information. The private task list appears only in Tasks, avoiding duplication in All. Comments filters type=note (including imported discussions); Calls filters type=call. Filter locally over authorized loaded pages without changing order or duplicating review entries. Earlier activity remains available in filtered empty states; never imply unloaded history is complete. Keep inline drafts mounted and available in All and Comments; use five-tab keyboard wrapping and responsive scrolling. No additional API, permissions or business events are required.

ThemeToggle animates only decorative sun/moon transforms and atmospheric opacity across a clipped horizon. The actual preference applies immediately; CSS transitions are reversible, no overlay blocks input, and reduced motion disables transitions. Keep the 44px target, accessible destination label and disabled live-save state. System changes must update the settled icon without storing an unintended explicit preference.

Book mode uses data-reading-mode and resolved data-color-scheme at the shared root, with book-mode.css imported before the shared design-system.css. Warm paper/charcoal tokens must cover forms, tables, overlays and charts without layout changes. Book mode now uses serif throughout headings, identity, navigation, tables, controls, dialogs and SVG chart labels; phone numbers remain monospace. Standard mode retains Google Sans/Manrope. See the dedicated [Book mode skill](../salesdrone-book-mode/SKILL.md). Quick theme switching preserves bookMode. Never write a live account’s reading preference into the guest fallback, or inherit another account’s stored setting. Test both palettes, enable/save/disable, navigation, focused inputs and 390px overflow; no claim of hardware e-ink or physical-device certification.

The full-page private task list mounts only in Tasks, not All. Keep All focused on loaded conversations and review information. Lead lifecycle controls use 46px minimum-height icon/text buttons, 16px labels, readable day/night/Book-mode danger colours, and full width on narrow screens. Do not style them as footnote text.

## Typography and all-screen layout contract

Use [DESIGN-SYSTEM.md](../../docs/DESIGN-SYSTEM.md) and the semantic roles in [design-system.css](../../apps/web/src/design-system.css), imported after component/palette CSS. Preserve all font families. Apply Apple HIG as a web adaptation: 17px body/form values, 16px actions, 15px supporting text, 13px metadata, 22px sections and 28px phone page titles via rem; keep 44px targets, zoom and text preference scaling. Native points are not CSS pt, and custom fonts do not automatically gain native Dynamic Type.

Search stays visible; one Filters disclosure holds column/search-field/stage/source controls and indicates active conditions. Narrow screens use full-width controls. inspectLead routes widths <1001px to the full lead page; chooseLead remains the authoritative fetch for existing route/edit flows. The route effect reauthorizes and cancels stale reads. Never reintroduce obsolete has-detail selectors as the only mobile guard: lead-overlay-mode must hide the table if an open desktop sheet is resized. Check list open, Back, direct links and Edit; resizing must not leak or duplicate records.

Stack stage/assignee at narrow widths, keep identity compact and wrap long names. Mobile journey scrolling is local, with unchanged current-stage semantics. Browser-check 320/375/390/430/768px and desktop, long assignees, both palettes/Book mode, dialogs and larger text. [Wondel sources](../WONDEL-SOURCE.md) are advisory shared skills, not module API owners or delegation permission.

Apply shared roles on every screen size: body/forms17, actions16, supporting/table/navigation15 and metadata13 at the default root. Page titles are fluid28–34, identity22–28; do not let SVG scaling shrink chart labels. Review the complete width/height matrix in DESIGN-SYSTEM.md, not only the reported screenshot size. Use content containers for dashboard52rem, settings42rem and actual .dialog38rem form layout. Preserve local table/journey scrolling and the224px middle-width sidebar with a normal capability-gated Set a reminder menu row. Login min-content and fractional breakpoints must not widen the page. Public screenshots should include laptop/tablet/desktop evidence as well as phones.

Name-column buttons use worksheet-name-button, full column width and text-align:start. Preserve a14rem minimum name column,44px target and natural wrapping; do not fix alignment with whole-app zoom/transform. Check missing, unbroken and non-Latin names at normal CSS scale. The sidebar reminder is a normal nav-item with19px icon and accessible title/label; it closes mobile navigation before opening the task modal. Do not restore sidebar-tip. Full-page call/reminder actions mount once above the tabs; quick-inspection actions mount only without routeLeadId. Contact values and permitted tel/mailto links live once in the labelled Lead information list. Custom-field retirement/visibility and call suppression/review guards stay authoritative.
