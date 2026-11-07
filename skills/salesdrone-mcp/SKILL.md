---
name: salesdrone-mcp
description: "Maintain SalesDrone HTTP integration compatibility with the standalone read-only MCP repository. Use for MCP API scopes and policy; adapter source, telemetry, tests and npm publishing belong to the separate MCP repository."
---

# Standalone MCP API integration

Read [SHARED.md](../SHARED.md), [release readiness](../salesdrone-release-readiness/SKILL.md)
and [continuation](continuation.md).

## Ownership

MCP implementation, screenshots, protocol tests, OTel runtime, lifecycle observer
and npm publication are owned by [theharithsa/salesdrone-mcp](https://github.com/theharithsa/salesdrone-mcp).
Do not recreate a package workspace or npm publisher in this repository.
SalesDrone owns the versioned HTTP contracts and policy the adapter calls.

## Primary API ownership

No module-specific HTTP endpoints. Existing API owners remain
[API integrations](../salesdrone-api-integrations/SKILL.md),
[Team](../salesdrone-team/SKILL.md), [people](../salesdrone-people-permissions/SKILL.md)
and the relevant lead/task/import domains.

## Compatibility invariants

Preserve active Admin ownership, opt-in team:read/people:read scopes, token revocation,
lead scope and Google members:write requirements. The directory returns only
id/name/active. tasks:read on shared lead tasks excludes unrelated personal work.
No PAT member/security administration or direct client Firestore access.

Keep current Team reporting distinct from presence, employee ratings and historical
conversion. Sparse pages can have nextCursor. Never bypass server policy to make a
client tool work. API and npm versions are independent; 1.0.0 remains immutable.

## Verification and release

Run [team.test.js](../../functions/test/team.test.js),
[personal-access-tokens.test.js](../../functions/test/personal-access-tokens.test.js)
and [emulator.integration.js](../../functions/test/emulator.integration.js) for
changed API/policy behavior. No backend changes are needed for repository extraction.
Adapter protocol/package and telemetry checks run in the standalone repo. Update
[API integration notes](../../docs/MCP.md) and the root MCP badge/link if ownership
changes. Follow normal checked PR/app release gates for changes here; no npm publish
from SalesDrone.

For new tools, follow the [contract design](../../docs/MCP.md#designing-cost-effective-tools) and [FinOps](../salesdrone-finops/SKILL.md) budgets. Prefer scoped counts and projections to collection paging. Preserve explicit time, partial coverage and cursor evidence.
