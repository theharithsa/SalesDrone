---
name: salesdrone-release
description: "Release SalesDrone modules through SemVer, GitHub Actions, Firebase and GitHub Pages with deployment evidence. Use for publishing or rollback; a module skill alone does not authorize production actions."
---

# Release and deployment

Read [the shared operating contract](../SHARED.md) before editing. Paths and commands
are relative to the repository root. Inspect current source rather than assuming
this map is an immutable schema or a standalone microservice.

## Responsibility and entry points

Reviewed module changes → tests/contracts/security/skills checks → one integrated version/changelog → push working branch → verified PR merge → verify → Firebase deploy + Pages → safe deployment metadata → Dynatrace reporting → versioned release → live version checks.

- [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml)
- [scripts/release.mjs](../../scripts/release.mjs)
- [scripts/check-release.mjs](../../scripts/check-release.mjs)
- [scripts/build-release.mjs](../../scripts/build-release.mjs)
- [scripts/check-secrets.mjs](../../scripts/check-secrets.mjs)
- [scripts/collect-deployment.mjs](../../scripts/collect-deployment.mjs)
- [scripts/notify-deployment.mjs](../../scripts/notify-deployment.mjs)
- [scripts/github-release.mjs](../../scripts/github-release.mjs)
- [firebase.json](../../firebase.json)
- [package.json](../../package.json)
- [CHANGELOG.md](../../CHANGELOG.md)

## Primary API ownership

No module-specific HTTP endpoints. This module supports the shared application surfaces.

Read the exact request/response/error schemas in [OpenAPI](../../docs/openapi.json)
and the route handler in [app.js](../../functions/src/app.js) when changing an API.

## Data and invariants

Synchronized root/web/functions versions and lockfiles, build metadata, GitHub release, Firebase Hosting/functions/indexes, Pages and Dynatrace deployment events.

- Every main code/docs push advances SemVer and completes a dated changelog. API schema version is independent. Never overwrite tags, force-push or bypass failed checks.
- Use existing OIDC/WIF deployment flow, not new service-account keys. Preserve exact repository/project boundaries and secret bindings.
- Deploy api and four scheduled functions as required by dependencies; module ownership is logical, not separate deployable services. Current workflow deploys the shared salesdrone codebase.
- Rules/indexes precede dependent code, wait READY, then functions and Hosting. Shared contracts must remain compatible with queued jobs and active clients.
- Report verified commit/version, jobs and live metadata separately from monitoring acceptance. A reporting failure after deploy must not trigger blind redeployment or data rollback.

Every published change, including documentation-only maintenance, must update an affected module SKILL.md with behavioral or operational guidance. CI skills:check compares BASE_SHA to HEAD and requires an added/modified module playbook; catalog-only updates and deleted skills do not count. Inspect affected ownership rather than adding empty version notes.

Use salesdrone-release-readiness for the completion review and releases/<version>.json. release creates an unfinished impact template; fill it before CI. CI now checks exact live contract/version, unauthenticated denial and ACTIVE function metadata, then archives sanitized release/monitoring evidence. Pages has an independent versioned settings-guide check. Post-check failures affect deployment-event outcome; inspect actual artifacts before retrying.

## Change and diagnosis

Inspect the failing job and exact step before retrying; distinguish already-deployed app from failed telemetry/reporting. For rollback revert code into a new forward release, preserve compatible schema/outbox state and verify the prior working behavior.

## Verification

Use the release, metadata, secret, skill and curated documentation checks in the shared contract; inspect CI evidence.

Apply the shared verification matrix to the changed behavior; these are the
module-specific regression entry points, not a substitute for integration checks.

## Deployment and handoff

Production project sales-drone-avinya; region asia-south1. api (HTTP), reminders, analyzeNotes, leadIntelligence and exportTelemetry (scheduled every minute). Hosting and Pages are separate outputs. Finish only after CI and live metadata match the intended SHA.

Coordinate one integrated release; follow the shared agent handoff contract.
Adjacent owners:

- [salesdrone-data-platform](../salesdrone-data-platform/SKILL.md)
- [salesdrone-observability](../salesdrone-observability/SKILL.md)
- [salesdrone-documentation](../salesdrone-documentation/SKILL.md)
- [salesdrone-api-integrations](../salesdrone-api-integrations/SKILL.md)

Read for detailed behavior:

- [docs/RELEASE.md](../../docs/RELEASE.md)

The initial published-version check retries boundedly for Hosting propagation, using exact version and commit via check-published.mjs. Pages postchecks verify both settings.html and the complete product.html handbook. Do not bypass persistent mismatches.

Explicit human instructions may authorize a single same-version maintenance push. releases/maintenance.json pins the exact prior commit, version, date, instruction and reason; maintenance-policy rejects reuse for a later base. Default releases still require a SemVer advance. github-release verifies descendant status and preserves the original tag/notes instead of overwriting them; commit/run identify the maintenance deployment. The file alone never authorizes another agent to skip versioning.

Public guide builds stamp the exact source commit and hash-version reviewed screenshot URLs. Post-deploy guide checks require commit as well as version, including same-version maintenance, so stale Pages HTML cannot satisfy the release gate.

For a later explicitly authorized maintenance push, bind the record to that push’s immediate parent, not the immutable original tag. github-release checks the current commit parent and verifies descent from the original tag before preserving it; an earlier maintenance record cannot authorize a subsequent push.

Deployment BizEvents use application/cloudevent+json; CUSTOM_DEPLOYMENT markers remain application/json. Keep provider fields aligned and validate both transport paths using deployment-bizevents.test.ts. HTTP acceptance remains separate from tenant searchability.

## Conditional reference

For detailed UI, recovery and integration recipes, read [operations](references/operations.md) when the affected behavior requires it. Follow current source and the shared contract when older examples differ.

For normalized equality, deploy compatible writer code and ready composite indexes before publication. The reminders worker verifies its published SHA and drains old invocations before derived-only backfill. Check the private lead-filter-index-v1 readiness marker after release. A rollback must retain indexed writers or disable/rebuild readiness before legacy writers resume; no broad IAM or public maintenance API is authorized.

## Known gaps

These are tracked follow-ups, not implemented behavior: [#27](https://github.com/theharithsa/SalesDrone/issues/27), [#30](https://github.com/theharithsa/SalesDrone/issues/30), [#33](https://github.com/theharithsa/SalesDrone/issues/33), [#71](https://github.com/theharithsa/SalesDrone/issues/71). Check their current status before changing the contract.
