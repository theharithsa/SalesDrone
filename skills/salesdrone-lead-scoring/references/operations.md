# Operational reference

Use the current source and [shared contract](../../SHARED.md) when applying these module-specific recipes. Release dates, prior approvals and screenshot versions are historical evidence in [CHANGELOG](../../../CHANGELOG.md) and [release plans](../../../releases/); they never authorize a new deployment.

## Module verification and integration

ScoreRing adds a small decorative SVG to an accessible numeric ScoreBadge. Unknown is dashed/Unscored; known zero is empty solid; progress clamps finite numbers0..100. Retain risk warning icon/label. Header and details share report updates through an id-guarded stable callback; never start duplicate fetch/poll loops or show a stale previous-lead score. Tests: tests/display-scale.test.ts.

