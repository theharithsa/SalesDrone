---
name: salesdrone-book-mode
description: "Maintain SalesDrone Book mode typography, paper palettes, personal preference and responsive reading UI. Use for Book mode or Kindle-style requests; general shell work belongs to interface."
---

# Book mode

Read [SHARED.md](../SHARED.md). This is a visual mode of the existing editable app, not a separate product, offline reader or independent service. The skill does not authorize deployment or delegation.

## Ownership and source

- [book.css](../../apps/web/src/material/book.css) and [tokens.css](../../apps/web/src/material/tokens.css): page surfaces, type and motion.
- [appearance.ts](../../apps/web/src/lib/appearance.ts): live/guest preference isolation.
- [App.tsx](../../apps/web/src/App.tsx): root reading-mode/resolved-colour attributes and guest persistence.
- [SettingsPage.tsx](../../apps/web/src/features/SettingsPage.tsx): Book mode control in Appearance & time, applied after Save changes.
- [design and behavior](../../docs/BOOK-MODE-PLAN.md), [settings reference source](../../docs/settings-reference.json).

## Invariants

Book mode is optional boolean bookMode, default false, independent of appearance=System/Light/Dark. The compact sun/moon theme pill preserves it. Older PATCH clients that omit bookMode preserve the saved choice. Live identities use their server preference; guest/demo/unapproved identities use guarded local fallback and cannot inherit live data.

Caveat headings and Patrick Hand body/controls use the same notebook shell for all workspace modules, including overlays. Phone numbers and telephone inputs, including descendants of phone cells, remain monospace. Keep the SalesDrone/Avinya artwork and standard-mode fonts intact. Avoid blanket !important rules that override phone semantics or icon rendering; account for portals outside the app root and SVG chart text.

Day uses warm paper/ink; night uses charcoal/warm pale ink. Preserve semantic status distinctions, focus, contrast, 16px editable inputs and 44px touch targets. The live lead index renders one sheet at a time and turns by wheel, swipe, keys or buttons. Scroll long sheets internally and load additional leads explicitly. Back restores the source sheet and focus. The visible workspace curls around the binding, including its toolbar, heading and filters. Dashboard uses Snapshot, Pipeline, Activity and Follow-ups sheets. Keep the outgoing view inert and remove it when the turn ends. Reduced motion switches instantly. Styles must work in the lead index, full lead page, dashboard, tasks, settings, inbox and dialogs. Standard mode must restore cleanly.

## API, audit and adjacent owners

No exclusive HTTP endpoint ownership. Preferences remain owned by [workspace settings](../salesdrone-workspace-settings/SKILL.md): GET/PATCH /api/v1/me with Google/App Check and self-owned active membership; PAT access remains denied. No new token scope for styling.

Book mode, theme and timezone saves participate in the durable settings audit. Export setting keys/section, hashed identity and audit IDs through the outbox; never export preference values, notes or form input. Local demo edits and OS-resolved appearance are not server-confirmed configuration writes. See [observability](../salesdrone-observability/SKILL.md).

## Verification and publication

Run [book preference tests](../../functions/test/book-mode.test.js), [identity resolver tests](../../tests/appearance.test.ts), [settings audit tests](../../functions/test/settings-audit.test.js), types/build and the real Auth/Firestore emulator for contract or audit changes. Test actual computed fonts on headings, navigation, table cells, buttons, inputs, SVG labels and phone numbers; test normal mode restoration, day/night/System, save failures and 390px overflow using synthetic data.

Refresh affected Book mode captures and hash manifest through [product guide](../salesdrone-product-guide/SKILL.md). Update settings/API docs and release impact plan; use [release readiness](../salesdrone-release-readiness/SKILL.md) and [release](../salesdrone-release/SKILL.md) for authorized publication. Do not claim physical-device or tenant-search verification from browser/HTTP checks.

Typography sizes and responsive layout now come from design-system.css after Book palette/font rules. Preserve the handwriting families and semantic roles; avoid a mode-specific large paragraph rule defeating mobile 17px body sizing. Verify computed size as well as family, including comment selectors and portals. See [the design system](../../docs/DESIGN-SYSTEM.md).

Book mode shares the all-screen semantic sizes, available-width grids and dialog layout in design-system.css, which loads after book-mode.css. Preserve handwriting, monospace phone numbers and palette tokens. Check phone, tablet, laptop, wide desktop and short heights, not just mobile. HTML chart labels inherit the reading font without SVG downscaling. Use the matrix in DESIGN-SYSTEM.md and distinguish simulated default-text scaling from physical-device testing.

Interface font selection is orthogonal to Book mode. Store the selected font but never replace the Book mode font stacks with it. Turning Book mode off restores the selected family; all Book content retains its handwriting except existing monospace phone rules. Activity role sizes now come from typography.css, loaded last, and must match standard mode without truncating history.

## Conditional reference

For detailed UI, recovery and integration recipes, read [operations](references/operations.md) when the affected behavior requires it. Follow current source and the shared contract when older examples differ.

## Known gaps

These are tracked follow-ups, not implemented behavior: [#46](https://github.com/theharithsa/SalesDrone/issues/46). Check their current status before changing the contract.
