# Operational reference

Use the current source and [shared contract](../../SHARED.md) when applying these module-specific recipes. Release dates, prior approvals and screenshot versions are historical evidence in [CHANGELOG](../../../CHANGELOG.md) and [release plans](../../../releases/); they never authorize a new deployment.

## Material 3 v2  guidance

Material v2 places metric cards before the briefing, uses horizontal stage cards and one chart hierarchy. Current-stage counts are still snapshots, not historic conversion. Manual/automatic AI generation policy is unchanged. Review the redesigned chart labels, small-screen scrolling and both palettes before approval.

The outreach chart's Day select uses a rounded filled surface, vertically centered
value and reserved right padding for the shared chevron. Keep the full date on one
line; allow the caption metrics to wrap independently. Retain the native select,
Chart day name, keyboard focus and existing local day-selection behavior.

## Header and chart review

The outreach trend wrapper owns a grid with a content-sized HTML Y-axis gutter and the SVG plot. Position each tick at the same normalized Y coordinate as its gridline; preserveAspectRatio=none makes the fixed-height SVG coordinate transform consistent across widths. Reserve gutter width from data-maximum rather than a fixed digit count. Date endpoints occupy the plot column. Keep native day selection and SVG circle keyboard actions; geometry is presentation-only, with no changed aggregates, API or telemetry.

