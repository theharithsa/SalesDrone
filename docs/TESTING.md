# SalesDrone testing guide

The project already has Node unit/API tests in functions/test and tests/, real Auth/Firestore integration in functions/test/emulator.integration.js, and GitHub pre/post-deployment checks. The dedicated [testing skill](../skills/salesdrone-testing/SKILL.md) and [module case catalog](../qa/test-cases.json) let a testing agent select and run them without reconstructing the conversation.

## Scripts

- `npm run qa -- quick`: unit/API tests, TypeScript, contract consistency, documentation, skills and release-plan readiness.
- `npm run qa -- integration`: actual Auth/Firestore emulator tests, using demo-salesdrone, Java 21 and free emulator ports.
- `npm run qa -- release`: all quick checks, security scan, emulator and production build. It never deploys.
- `npm test`, `npm run check` and individual `node --test <path>` commands remain useful while a release plan is incomplete.

The runner rejects unknown suite names and never executes a user-provided shell command. It stops after a failure, marks later checks not-run, and writes sanitized status/timing evidence to ignored test-results/qa-<suite>.json. CLI test output is for synthetic fixtures; JSON evidence excludes raw errors, payloads and customer data. A generated contract change must be reviewed. Production publishing stays in the authorized GitHub workflow.

## Browser recipes

Read the expected outcomes in qa/test-cases.json, then use the approved browser tool with the actual guest application. CLI success does not prove UI quality. Check 390/768/1024/1280/1440/1920px and each desktop display scale 85/90/100/110/125. Touch/narrow layouts stay100. Cover both palettes, Book mode, all font choices, long/unbroken/missing names, score null/zero/mid/100/risk, full lead/overlay navigation, drag and keyboard resizing, menus, dialogs and focus restoration. Font/scale previews apply globally only after save.

For isolated graphics, render the real ScoreBadge/ScoreRing with labelled synthetic reports; never invent a real lead's score. Expand disclosures and check counts of action sets/contact fields. Inspect complete multi-line comments and historical pagination. Save screenshots with actual viewport/scale, source commit and explicit synthetic privacy review; remove temporary Vite fixture entrypoints before build.

## API, integration and delivery

Test positive requests, unauthenticated/App Check/PAT/assigned-scope denials, stale expected versions, idempotency and transaction rollback. New personal preferences must preserve older clients and separate live identity from guest storage. The emulator suite confirms real persistence and committed audit/outbox keys. Queue existence, exporter HTTP acceptance and tenant-searchable Dynatrace data are different claims.

After authorized deployment, inspect workflow artifacts for exact live version/SHA, contract, access denial, ACTIVE function revisions, current documentation and per-signal receipts. Prefer read-only production checks and demo UI; no live leads, invitations, token creation, reminders or imports are needed for a layout test. Record failed, blocked and unexecuted cases honestly, with a reproduction and expected/actual behavior.

Current observed layout evidence is recorded in [the v1.8.0 review](UI-REVIEW-1.8.0.md).

![Labelled fictional score states, using actual components and no server calls.](../site/assets/screenshots/score-ring-demo.jpg)
