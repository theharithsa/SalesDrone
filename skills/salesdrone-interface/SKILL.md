---
name: salesdrone-interface
description: "Maintain SalesDrone Material 3 responsive shell, typography, themes, accessible overlays and synthetic demo adapters. Use for cross-module UI and design work; business logic stays with its owning module."
---

# Interface and Material 3 design system

Read [SHARED.md](../SHARED.md), [design system](../../docs/DESIGN-SYSTEM.md) and the
[local review status](../../docs/MATERIAL-3-REVIEW.md). The v2 user request replaces
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

The v2 surface uses Material colour pairs, 16px body/forms, 14px labels/supporting,
12px metadata and 32px page headlines (28px compact). Standard keeps self-hosted
Google Sans headings and Manrope text; personal font choices remap the same roles.
Caveat remains on sign-in conversation lettering. Phone identifiers stay monospace.
Book mode remaps palette/type roles without changing geometry. No default global
zoom reduction: retain the explicit personal desktop scale setting and touch limits.

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

## Local design review and verification

The human approved local v2.0.0 on 26 October 2026 and authorized release. Follow
full release gates; this approval resolves the earlier local-first hold. Use
`npm run design:check` for the focused local checks, not as a production certificate.

[design-review.html](../../apps/web/design-review.html) is a development viewport
canvas. [AdminReview.tsx](../../apps/web/src/review/AdminReview.tsx) renders real
settings with labelled fictional in-memory fixtures; it has no API transport,
blocks token/device actions and must not enter the production bundle. Do not attach
it to App.tsx or add its HTML to build inputs. `check-design-build.mjs` checks isolation.

Use the approved browser tools when available. Record actual widths/themes/dialogs
and explicit gaps in MATERIAL-3-REVIEW.md. Do not infer visual success from CSS or
builds. Refresh all affected public captures after approval and before release.

## Deployment and adjacent ownership

Use [release readiness](../salesdrone-release-readiness/SKILL.md) and
[release](../salesdrone-release/SKILL.md) only after approved design. Preserve API
contract 1.16 unless domain behavior changes; production instrumentation remains
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
