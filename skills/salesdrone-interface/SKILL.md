---
name: salesdrone-interface
description: "Maintain SalesDrone Material 3 responsive shell, typography, themes, accessible overlays and synthetic demo adapters. Use for cross-module UI and design work; business logic stays with its owning module."
---

# Interface and Material 3 design system

Read [SHARED.md](../SHARED.md), [design system](../../docs/DESIGN-SYSTEM.md) and the
[review evidence](../../docs/MATERIAL-3-REVIEW.md). The v2 user request replaces
the earlier Apple-derived visual system. Keep the underlying web accessibility and
policy guarantees. This module does not authorize deployment or delegation.

## Responsibility and entry points

- [App.tsx](../../apps/web/src/App.tsx): session shell, navigation, record panes and demo adapters.
- [main.tsx](../../apps/web/src/main.tsx): the sole Material stylesheet entry.
- [material/](../../apps/web/src/material/): role tokens and owned shell, workspace,
  dashboard, settings and login styles. Do not re-import the v1 refresh cascade.
- [UI.tsx](../../apps/web/src/components/UI.tsx): semantic actions, Radix dialogs,
  feedback, avatars and branded names.
- [LeadBlade.tsx](../../apps/web/src/components/LeadBlade.tsx): resizable inspector
  and full record, independent of the collection’s layout.
- [lead-table.ts](../../apps/web/src/lib/lead-table.ts): presentation order and
  configured labels; import/export mappings and stored field IDs do not change.
- [appearance.ts](../../apps/web/src/lib/appearance.ts), fonts/display-scale helpers:
  personal preferences, guest isolation and account changes.

## Primary API ownership

No module-specific HTTP endpoints. UI reads/writes the owning modules’ existing
versioned API through lib/api.ts. A redesign does not require a cosmetic endpoint,
new permission or invented business event.

## Data and invariants

Use the actual authorized scope. Unapproved identities remain synthetic demo only.
Never weaken Google/App Check, membership or scoped file/token access for a preview.
Preserve immutable comments/corrections, reminder privacy, import replay, optimistic
versions and cancellation epochs. No private records or credentials in screenshots.

Preserve Material colour roles, Google Sans headings, Manrope body text and monospace phone identifiers. Book mode and personal font/scale choices must preserve accessible touch targets, focus, Escape and independent scrolling. Breakpoints follow content rather than platform detection. Keep synthetic preview transports isolated from production.

For domain controls, also load [leads](../salesdrone-leads/SKILL.md), [tasks](../salesdrone-tasks-reminders/SKILL.md), [workspace settings](../salesdrone-workspace-settings/SKILL.md) or [Book mode](../salesdrone-book-mode/SKILL.md) as applicable. [Product guide](../salesdrone-product-guide/SKILL.md) owns public captures.

Shared desktop/mobile column filters expose Exact match only for source, stage and active custom dropdowns. Keep Equals available and explain literal case/spacing/Unicode matching. Changing a column resets the comparison. Preserve mobile draft Apply/Cancel/Reset and focus restoration; capture reviewed synthetic filter controls.

Import comment choices use separate header and column-position rows, explicit associated labels, compact selectable surfaces and single-column phones. Popup selects keep one-line closed labels and bounded trigger-width pickers; desktop filter dialogs put the value on a second row so selects remain readable. Retain native fallback, Escape/focus and real-browser open-picker review. Dialogs use native platform pickers to avoid customizable-select conflicts with modal Escape handling; keep comfortable closed-control widths.

## Conditional reference

For detailed UI, recovery and integration recipes, read [operations](references/operations.md) when the affected behavior requires it. Follow current source and the shared contract when older examples differ.

## Known gaps

These are tracked follow-ups, not implemented behavior: [#4](https://github.com/theharithsa/SalesDrone/issues/4), [#37](https://github.com/theharithsa/SalesDrone/issues/37), [#45](https://github.com/theharithsa/SalesDrone/issues/45), [#46](https://github.com/theharithsa/SalesDrone/issues/46), [#59](https://github.com/theharithsa/SalesDrone/issues/59). Check their current status before changing the contract.
