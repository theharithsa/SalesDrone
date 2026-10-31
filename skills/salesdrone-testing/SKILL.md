---
name: salesdrone-testing
description: "Test SalesDrone features and regressions using module cases, unit/API checks, Auth/Firestore emulators and approved-browser UI checks. Use for test execution and evidence; release authorization remains separate."
---

# Testing and regression handoff

Read [SHARED.md](../SHARED.md), the affected owner from [skill-tree.json](../../skill-tree.json), and [the case catalog](../../qa/test-cases.json). The catalog maps each logical module to executable tests and manual expected behavior; it is not a claim that all cases have run.

## Choose and run

- `npm run qa -- quick`: unit/API tests, types, generated contract consistency, documentation, skills and release-plan readiness. Run domain tests directly during incomplete implementation; readiness can correctly fail on a draft release plan.
- `npm run qa -- integration`: real Auth/Firestore emulator tests against demo-salesdrone. Requires Java 21 and available local ports; never substitute production credentials or a live project.
- `npm run qa -- release`: quick checks, secret scan, real emulator and production build. It does not deploy. CI remains the publishing gate.
- Results are sanitized JSON in ignored test-results/qa-<suite>.json. Failure stops execution and marks later checks not-run. Inspect actual error output; do not turn an infrastructure failure or omitted browser check into a pass.

## Feature-specific investigation

Choose cases by module, inspect the linked source test, reproduce the reported behavior with synthetic records, and add a regression at the boundary that failed. Prefer actual requests, authorization failures, transaction rollback, concurrency or UI behavior over source-string snapshots. Test empty/unknown states distinctly from zero values, stale records, denied roles, assigned scope and idempotent repeats. Font/scale preferences must preserve old clients and live-versus-guest isolation.

For visible changes use the approved browser tool and actual guest application or clearly labelled isolated components. [Manual UI recipes](../../qa/test-cases.json) specify expected outcomes. Review 390/768/1024/1280/1440/1920px, desktop display scales 85/90/100/110/125, touch 100%, both palettes, Book mode, all font choices, long/unbroken names and keyboard focus. Measure overflow and actual geometry; root text fixtures are not proof of browser zoom or native accessibility. At every desktop scale test overlay resize/keyboard, full-page navigation, score states, dialogs and notifications.

Do not install a competing browser automation path. Existing screenshots are reference evidence, not automated assertions. Do not use production leads, membership edits, reminders, tokens or imports as fixtures. Build temporary UI fixtures outside public/ and remove them before production build; retain only reviewed synthetic screenshots through the documentation workflow.

Component behavior uses Vitest/Testing Library in apps/web/test/workflows.test.tsx. npm test includes it; CI emits hashed case metadata for components, functions and helper suites. jsdom verifies interactions, not layout or device certification. npm run lint rejects errors and increases over the reviewed legacy-warning baseline; never regenerate the baseline to accept a regression.

## Handoff evidence

Report source commit, suite/case IDs, commands, passed/failed/not-run results, viewport/scale/theme, fixtures, screenshot paths and limitations. Include a minimal reproduction and expected/actual behavior for failures. Read-only live checks and Dynatrace HTTP receipts are separate from emulator persistence, customer writes and tenant-search visibility. Publication or rollback follows [release readiness](../salesdrone-release-readiness/SKILL.md) and [release](../salesdrone-release/SKILL.md), with the human's existing authorization; this testing skill grants no deployment or delegation permission.

Entry points: [runner](../../scripts/run-test-suite.mjs), [execution policy](../../scripts/test-plan.mjs), [runner tests](../../tests/test-plan.test.ts), [emulator integration](../../functions/test/emulator.integration.js), [testing guide](../../docs/TESTING.md). Update the catalog and owning module skill when behavior changes.

Exact match regression entry points: functions/test/exact-filters.test.js and the real Firestore case in emulator.integration.js. Verify all raw predicates, nested fields, assigned scope, actual document-key cursors and unchanged Equals; component interactions alone cannot verify index behavior.

New feature checks: tests/import-fields.test.ts, functions/test/dashboard-grouping.test.js, component workbook-field workflows and the real emulator schema/import/personal-dashboard scenario. Verify literal codes, role/stale denials, replay/update, hidden-stage preservation, scopes, old preference clients, overflow buckets and actual open pickers. Do not infer layout correctness from jsdom.

## Conditional reference

For detailed UI, recovery and integration recipes, read [operations](references/operations.md) when the affected behavior requires it. Follow current source and the shared contract when older examples differ.

## Known gaps

These are tracked follow-ups, not implemented behavior: [#30](https://github.com/theharithsa/SalesDrone/issues/30), [#44](https://github.com/theharithsa/SalesDrone/issues/44), [#45](https://github.com/theharithsa/SalesDrone/issues/45), [#46](https://github.com/theharithsa/SalesDrone/issues/46). Check their current status before changing the contract.
