# Book mode — design and implementation for v1.6.3

Book mode is a personal reading style, independent of System/Light/Dark. It is off by default. Enable it in Settings → Appearance & time and save preferences. The top-right sunrise/sunset toggle continues to change day/night without turning Book mode off.

## Visual design

- Day: warm ivory paper, dark brown ink, subdued blue links and readable semantic status colours. Night: charcoal paper, warm pale ink and softened accents. Keep focus, errors, warnings and success distinguishable in both.
- Serif reading text for lead notes, narrative insights and descriptions. Preserve Google Sans headings and lead identity, normal readable table/control fonts and monospace phone numbers. Avoid decorative page-turn effects over working data.
- Use restrained page edges and section rules, comfortable line height and consistent form backgrounds. No tiled image texture, artificial shadows over text or new remote font dependency.
- Keep tables dense enough for outreach and horizontal scrolling contained. At 390px, retain existing navigation, editable fields and touch target sizes. Reduced motion removes the theme control's orbital transition.

## State and API

Add optional boolean bookMode to the existing self-owned Preferences contract and Session type. Missing values default false; older PATCH clients that omit it preserve the stored choice. Include the preference in appearance/reminder saves and quick theme updates without changing roles or capabilities. The live API remains Google/App Check protected; no Personal Access Token scope for preferences is introduced.

Apply a data-reading-mode attribute at the shared root; use theme-aware CSS tokens and scoped narrative typography. Demo/guest choice uses guarded browser storage as a local fallback. For live users, server preference wins; logout must not accidentally apply a previous live user's Book mode to another live account. The mode is a visual treatment, not a claim of physical e-ink behaviour or a separate offline reader.

## Delivery and verification

Ship v1.6.2 (BizEvents transport and sunrise/sunset control) first; ship Book mode as v1.6.3. Update the additive OpenAPI Preferences schema, settings reference, product handbook, owner skills, changelog and release plan. Reuse existing safe request telemetry; never emit note contents or a business conversion event for styling.

Test true/false persistence, default/missing values, omission by older clients, invalid input, own-user isolation and token-route denial. Verify day/night/system styles, quick toggle preserving Book mode, settings save/revert, navigation, long text, forms, dashboard charts, mobile viewport and disabling the mode. Refresh reviewed synthetic screenshots and verify exact app/docs commit after release; report physical-device and tenant-query limits separately.

## Implemented contract

The planned setting is implemented as optional boolean bookMode on Preferences (API contract 1.13.0). Server reads default false; PATCH merges without resetting an omitted field. App sets data-reading-mode=book|standard and a resolved data-color-scheme for the palette. Guest fallback uses the guarded salesdrone.guestBookMode key; live preference updates do not populate it. The save action applies the style, and disabling it restores the unmodified standard theme. Release verification evidence is collected separately in CI.
