---
name: salesdrone-release
description: "Release SalesDrone modules through SemVer, GitHub Actions, Firebase and GitHub Pages with deployment evidence. Use for publishing or rollback; a module skill alone does not authorize production actions."
---

# Release and deployment

Read [the shared operating contract](../SHARED.md) before editing. Paths and commands
are relative to the repository root. Inspect current source rather than assuming
this map is an immutable schema or a standalone microservice.

## Responsibility and entry points

Reviewed module changes → tests/contracts/security/skills checks → one integrated version/changelog → push main → verify → Firebase deploy + Pages → safe deployment metadata → Dynatrace reporting → versioned release → live version checks.

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
