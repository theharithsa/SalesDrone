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

[LeadBlade.tsx](../../apps/web/src/components/LeadBlade.tsx) provides non-modal fixed desktop inspection above the unchanged table and a dedicated /leads/{id} workspace. Resize remains direct and browser-local; the expand icon navigates, it no longer maximizes an inline column. Keep Escape/focus restoration, Back/Forward/deep-link authorization, responsive horizontal journey and reduced motion. [LeadTaskTab.tsx](../../apps/web/src/components/LeadTaskTab.tsx) pages recipient-private lead tasks with stale-request cancellation. The full page has accessible Comments, Tasks and Review tabs; Review filters only loaded actionable automatic-reminder states and explains historical pagination. Navigation uses fixed icon cells and explicit smooth desktop collapse; Documentation sits above Settings.

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
