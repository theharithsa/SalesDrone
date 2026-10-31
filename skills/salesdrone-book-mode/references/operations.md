# Operational reference

Use the current source and [shared contract](../../SHARED.md) when applying these module-specific recipes. Release dates, prior approvals and screenshot versions are historical evidence in [CHANGELOG](../../../CHANGELOG.md) and [release plans](../../../releases/); they never authorize a new deployment.

## Material 3 v2  guidance

Material v2 owns day/night paper palettes in material/tokens.css and uses the same geometry as Standard. Do not re-import the legacy book-mode.css override cascade. Serif body/headings and the existing monospace identifier exception remain. Check every field/control and personal font restoration in both palettes.

### Mobile layout and scale

Book mode inherits rounded controls, full-width lead cards, compact navigation and
mobile display zoom without a separate geometry override. Preserve serif roles and
paper/night colours. Review both palettes at narrow widths and restore 100% after
zoom rehearsal; do not replace saved personal preferences with a global small font.

