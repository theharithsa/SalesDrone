---
name: salesdrone-lead-assistant
description: "Maintain the lead-only Assistant, exact analytics and permission-filtered retrieval. Use for guarded lead questions and RAG; it cannot mutate leads or answer general knowledge."
---

# Lead Assistant

Read [the shared contract](../SHARED.md) and [release readiness](../salesdrone-release-readiness/SKILL.md).

## Implementation status

Implementation for enhancement #96; production readiness is gated by release evidence.
Follow [the agent plan](../../docs/LEAD-ASSISTANT-AGENT-PLAN.md) before publication.
Production availability is recorded by the verified PR and release workflow.
The access, retention and analytics contract is in [the feature contract](../../docs/LEAD-RESEARCH-CONTRACT.md).
API ownership below follows the generated contract. Histories remain creator-private; lead/source edits conservatively invalidate saved results.

## Policy and safety

Admins have access by default. Other members require explicit grants intersected with
current lead scope. Google/App Check only; no implicit PAT or anonymous/demo access to
live data. Recheck active membership, grants, assignment and workspace access policy
between pages and before publishing private data. Never share an Admin scan with an
assigned member. Persisted data is not an authorization authority.

Exact cohort counts use deterministic, complete authorized scans, never vector top-k counts.
Retrieve bounded versioned evidence with access filtering before retrieval and an authoritative
access/source check before prompts, citations and responses. The model cannot choose identity,
workspace, permissions or arbitrary database queries. Notes are untrusted data.
Stage meanings and historical conversion semantics require explicit configuration. Missing
history is unknown, not a conversion at import/creation time or a definitive count of zero.
Refuse general knowledge, secrets, code execution and every mutation. Validate citations and
numbers; distinguish sampled themes from whole-cohort prevalence.

## Data and signals

Never put workbook cells, names, phone/email, notes, prompts, replies or snippets into telemetry.
Use sanitized operation/status/counts and committed lifecycle outboxes. No provider network
call belongs in a database transaction. Reset must cover derived artifacts and block late
worker resurrection. Retention, deletion and stale-source behavior must be explicit.

## Verification and delivery

Test access revocation, assignment changes, more than 1,000 leads, incomplete scans and
provider failure with synthetic fixtures. Test real Firestore/Auth behavior before release.
Update API schemas, settings guide, screenshots, changelog and release impact evidence.
Local tests, CI, deployment, ingest acceptance and tenant searchability are separate claims.

Adjacent owners: [people permissions](../salesdrone-people-permissions/SKILL.md),
[leads](../salesdrone-leads/SKILL.md), [observability](../salesdrone-observability/SKILL.md).

## Primary API ownership

- GET /api/v1/lead-research-settings
- PATCH /api/v1/lead-research-settings
- GET /api/v1/lead-assistant/index
- POST /api/v1/lead-assistant/index
- POST /api/v1/lead-assistant/conversations
- GET /api/v1/lead-assistant/conversations
- GET /api/v1/lead-assistant/conversations/{id}/messages
- POST /api/v1/lead-assistant/conversations/{id}/questions
- GET /api/v1/lead-assistant/requests/{id}
- GET /api/v1/lead-assistant/requests/{id}/leads
- POST /api/v1/lead-assistant/requests/{id}/cancel
- DELETE /api/v1/lead-assistant/conversations/{id}

## Implementation and regression entry points

- [Shared access](../../functions/src/lead-research-access.js), [source invalidation](../../functions/src/lead-research-store.js) and [worker](../../functions/src/lead-research-worker.js).
- [Conversation interaction tests](../../apps/web/test/lead-assistant.test.tsx).
- [Behavior and permission tests](../../functions/test/lead-research.test.js).
- [Validated tools](../../functions/src/lead-assistant-tools.js), [conversation container](../../apps/web/src/features/LeadAssistantPage.tsx) and
- [Conversation design](../../apps/web/src/features/LeadAssistantView.tsx), [synthetic prototype](../../apps/web/src/review/LeadAssistantPrototype.tsx), [current container](../../apps/web/src/features/ResearchPage.tsx) and [Admin settings](../../apps/web/src/features/ResearchSettings.tsx).

The index is disabled by default. Admin enablement starts a bounded backfill; incremental source jobs are atomic with app writes. Gemini embeddings use 768 dimensions and Firestore cosine nearest-neighbor search with ACL prefilters and authoritative source checks. Counts never use the index. Calendar-month conversions count each lead once per month, ignore creation/import and intra-group moves, and explicitly report incomplete historical coverage. Retired outcome mappings require Admin review.

Use a dedicated Material 3 conversation page, on-demand history and collapsed sources.
Keep index operations in Settings. Calls next week use actual recipient-private task/date joins;
approved orders require configured field/value meanings. Never substitute a fixed intent
menu or vector sample for flexible structured queries and complete authorized results.

The model emits a strict composable plan. Server metadata, literal filter grounding,
current permissions and source/task epochs gate execution. Lists page via signed
request-bound cursors; exact counts scan complete scope. Cancel uses expectedVersion
and blocks later worker publication. Active never implies the New stage.
