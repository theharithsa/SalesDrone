---
name: salesdrone-data-platform
description: "Maintain SalesDrone store adapters, transaction behavior, cursor/query infrastructure, indexes and deny-all client rules. Use for data-layer changes; domain schema and records remain owned by feature skills."
---

# Firestore data platform

Read [the shared operating contract](../SHARED.md) before editing. Paths and commands
are relative to the repository root. Inspect current source rather than assuming
this map is an immutable schema or a standalone microservice.

## Responsibility and entry points

Domain operation → store.run reads/queued writes → Firestore atomic flush → worker queries with bounded pagination → explicit observable-store spans.

- [functions/src/store.js](../../functions/src/store.js)
- [functions/src/observable-store.js](../../functions/src/observable-store.js)
- [functions/src/app.js](../../functions/src/app.js)
- [functions/src/contracts.js](../../functions/src/contracts.js)
- [firestore.rules](../../firestore.rules)
- [firestore.indexes.json](../../firestore.indexes.json)
- [scripts/indexes.py](../../scripts/indexes.py)
- [scripts/wait-indexes.mjs](../../scripts/wait-indexes.mjs)

## Primary API ownership

No module-specific HTTP endpoints. This module supports the shared application surfaces.

Read the exact request/response/error schemas in [OpenAPI](../../docs/openapi.json)
and the route handler in [app.js](../../functions/src/app.js) when changing an API.

## Data and invariants

Workspace-root domain collections plus private users/{uid} subcollections; path() and ROOT define scope. No client Firestore customer reads/writes.

- Buffered store writes permit all transactional reads before flush. Maintain rollback and memory/Firestore parity; never move network inference or push inside transactions.
- Business data, audit and telemetry/delivery outboxes commit atomically. New query predicates require stable sort/id tie-breaks and matching indexes.
- Signed cursors bind to identity, membership version and filter context. CURSOR_SECRET must stay stable across deployments; never rotate casually to debug pagination.
- Do not hard-delete production data, migrate schemas or reassign records as a side effect of a query repair. Design compatibility and recovery before an authorized migration.
- Memory tests are insufficient for Firestore query/transaction validity. Deny-all client rules remain a required security boundary.

## Change and diagnosis

Reproduce index errors, transaction write-limit failures, tie pagination and membership changes in demo-salesdrone. Compare actual index readiness to required query shape; do not remove scope predicates to make a query succeed.

## Verification

- [functions/test/emulator.integration.js](../../functions/test/emulator.integration.js)
- [functions/test/app.test.js](../../functions/test/app.test.js)
- [functions/test/workbook-and-filters.test.js](../../functions/test/workbook-and-filters.test.js)

Apply the shared verification matrix to the changed behavior; these are the
module-specific regression entry points, not a substitute for integration checks.

## Deployment and handoff

Firestore rules/indexes plus affected api/workers. Wait READY before dependent code; deploy through the shared release workflow and preserve backward-compatible queue records.

Use [the release skill](../salesdrone-release/SKILL.md) for authorized publication.
Adjacent owners:

- [salesdrone-leads](../salesdrone-leads/SKILL.md)
- [salesdrone-imports](../salesdrone-imports/SKILL.md)
- [salesdrone-tasks-reminders](../salesdrone-tasks-reminders/SKILL.md)
- [salesdrone-observability](../salesdrone-observability/SKILL.md)
- [salesdrone-release](../salesdrone-release/SKILL.md)

Settings audit snapshots are requested immediately before each first tracked write, before memory-adapter mutation and before buffered Firestore flush. Keep snapshot read failures transactional and observe the final net write. Do not move audit/outbox writes outside the transaction or depend on OTel enabled state. Real emulator tests verify the adapter boundary.
