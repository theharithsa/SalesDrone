# Operational reference

Use the current source and [shared contract](../../SHARED.md) when applying these module-specific recipes. Release dates, prior approvals and screenshot versions are historical evidence in [CHANGELOG](../../../CHANGELOG.md) and [release plans](../../../releases/); they never authorize a new deployment.

Browser session storage is optional for rendering and in-page import progress. Use browser-storage helpers, show that automatic reload recovery is unavailable when writes fail, and keep the current preview/job accessible. Storage failure must not turn a successful preview into an apparently failed server operation.

After a file has sheets, ImportPage shows a compact replacement chooser labelled Choose another workbook so mapping stays visible. Preserve the original chooser before selection, replacement behavior, parsing, permissions and validation/commit contracts. Review actual synthetic CSV mapping across widths; local preview table scrolling must not widen the document. Isolated screenshots with stub requests do not prove an import committed.

## Material 3 v2  guidance

Material v2 updates workbook steps, mapping controls, comment-column choices and table/dialog surfaces only. The separate local review entry keeps imports in demo mode, with no file upload. First-sheet mapping, multiple comment columns, recovery and commit policy remain unchanged.

## Collaborative imports

Own reviewed formatVersion 3 planning, decisions, history/report pagination and three-way source baselines in functions/src/import-review.js. Read docs/IMPORTS.md for matching, explicit clears, comment revisions, retention deletion, limits and rollback. Collaboration is Google-only. Preserve uploader assignment, current lead scope, atomic versions and legacy owner replay. Run import-review.test.js and emulator integration, including the 1,000-row changed workbook scenario.

