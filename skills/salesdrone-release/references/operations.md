# Operational reference

Use the current source and [shared contract](../../SHARED.md) when applying these module-specific recipes. Release dates, prior approvals and screenshot versions are historical evidence in [CHANGELOG](../../../CHANGELOG.md) and [release plans](../../../releases/); they never authorize a new deployment.

## Attachment transport and privacy

Private lead attachments add storage.rules and Firebase Storage to the emulator suite and main deployment workflow. Deploy deny-all Storage rules and wait for attachment indexes before API/Hosting. Existing api/reminders function exports own upload and bounded cleanup; do not create an untracked sixth function. Verify bucket public-access prevention, runtime object permissions, API contract 1.16 and no permanent download links. No service-account credentials belong in source.

## release procedure

All changes must go through a GitHub pull request before merging into main, per
the human's standing instruction. Push the working branch, open and attach its
PR, wait for required verification, then merge through the PR. Never push commits
directly to main or bypass failed checks. Production still deploys from the
resulting main commit via the normal workflow.

## Lead-data reset

For lead reset deploy all shared Functions exports so API and background producers share the reset lock. Verify runtime Storage list/delete access without broadening IAM implicitly. Do not roll back or remove the cleanup worker while a reset is active; forward-fix/recover its cursor/lease. Postdeploy verification uses read-only status/metadata; do not execute destructive customer writes for evidence. Follow docs/LEAD-DATA-MANAGEMENT.md.

## API and deployment hardening

Pages now depends on verify and deploy and requires deploy success; a failed/cancelled deploy must not publish a newer guide. Notify uses scripts/deployment-outcome.mjs with explicit rules, index readiness, Storage, Functions, Hosting, published-version and postcheck outcomes. Missing/skipped/cancelled phases report failed, even if later phases succeeded. Tests exercise every required phase; do not intentionally fail production to test the DAG.

