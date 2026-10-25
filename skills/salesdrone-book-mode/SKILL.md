---
name: salesdrone-book-mode
description: "Maintain SalesDrone Book mode typography, paper palettes, personal preference and responsive reading UI. Use for Book mode or Kindle-style requests; general shell work belongs to interface."
---

# Book mode

Read [SHARED.md](../SHARED.md). This is a visual mode of the existing editable app, not a separate product, offline reader or independent service. The skill does not authorize deployment or delegation.

## Ownership and source

- [book-mode.css](../../apps/web/src/book-mode.css): complete serif typography and day/night paper tokens.
- [appearance.ts](../../apps/web/src/lib/appearance.ts): live/guest preference isolation.
- [App.tsx](../../apps/web/src/App.tsx): root reading-mode/resolved-colour attributes and guest persistence.
- [SettingsPage.tsx](../../apps/web/src/features/SettingsPage.tsx): Book mode control in Appearance & time, applied after Save changes.
- [design and behavior](../../docs/BOOK-MODE-PLAN.md), [settings reference source](../../docs/settings-reference.json).

## Invariants

Book mode is optional boolean bookMode, default false, independent of appearance=System/Light/Dark. The sunrise/sunset control preserves it. Older PATCH clients that omit bookMode preserve the saved choice. Live identities use their server preference; guest/demo/unapproved identities use guarded local fallback and cannot inherit live data.

All visible text uses the local serif reading stack in Book mode: headings, identity, navigation, buttons, forms, tables, chart labels and narrative text. Phone numbers and telephone inputs, including descendants of phone cells, remain monospace. Keep the SalesDrone/Avinya artwork and standard-mode fonts intact. Avoid blanket !important rules that override phone semantics or icon rendering; account for portals outside the app root and SVG chart text.

Day uses warm paper/ink; night uses charcoal/warm pale ink. Preserve semantic status distinctions, focus, contrast, 16px editable inputs and 44px touch targets. Do not introduce animated page turns over working data or layout shifts merely for decoration. Styles must work in the lead overlay, full lead page, dashboard, tasks, settings, inbox and dialogs. Standard mode must restore cleanly.

## API, audit and adjacent owners

No exclusive HTTP endpoint ownership. Preferences remain owned by [workspace settings](../salesdrone-workspace-settings/SKILL.md): GET/PATCH /api/v1/me with Google/App Check and self-owned active membership; PAT access remains denied. No new token scope for styling.

Book mode, theme and timezone saves participate in the durable settings audit. Export setting keys/section, hashed identity and audit IDs through the outbox; never export preference values, notes or form input. Local demo edits and OS-resolved appearance are not server-confirmed configuration writes. See [observability](../salesdrone-observability/SKILL.md).

## Verification and publication

Run [book preference tests](../../functions/test/book-mode.test.js), [identity resolver tests](../../tests/appearance.test.ts), [settings audit tests](../../functions/test/settings-audit.test.js), types/build and the real Auth/Firestore emulator for contract or audit changes. Test actual computed fonts on headings, navigation, table cells, buttons, inputs, SVG labels and phone numbers; test normal mode restoration, day/night/System, save failures and 390px overflow using synthetic data.

Refresh affected Book mode captures and hash manifest through [product guide](../salesdrone-product-guide/SKILL.md). Update settings/API docs and release impact plan; use [release readiness](../salesdrone-release-readiness/SKILL.md) and [release](../salesdrone-release/SKILL.md) for authorized publication. Do not claim physical-device or tenant-search verification from browser/HTTP checks.
