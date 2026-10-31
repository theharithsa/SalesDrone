# Operational reference

Use the current source and [shared contract](../../SHARED.md) when applying these module-specific recipes. Release dates, prior approvals and screenshot versions are historical evidence in [CHANGELOG](../../../CHANGELOG.md) and [release plans](../../../releases/); they never authorize a new deployment.

## Material 3 v2  guidance

Material v2 puts the inline composer and compact timeline in an independently sized activity pane, beside details on wide screens. Do not let long qualification details stretch tab/action row heights. All/Comments/Calls/Review semantics, pagination and revision history remain unchanged.

### Local v2 spacing and form corrections

The inline composer is inside `.lead-composer-region`, not a direct child of the
work panel. Keep its 24px desktop/16px compact inline padding, helper/footer gaps
and timeline heading alignment. Call/correction/note forms use persistent outlined
field labels while checkbox follow-up controls and revision behavior are unchanged.
Run design:forms and review MATERIAL-04/05; source/render checks are not visual proof.

## Collaborative imports

Reviewed workbook corrections match source column label/ordinal, preserve activityRevisions and avoid duplicate notes or AI scheduling. Renamed/reordered sources need review. Reminder-linked corrections fail with DISCUSSION_REVIEW and must use the timeline to preserve reminder state. See docs/IMPORTS.md and import-review.test.js.

