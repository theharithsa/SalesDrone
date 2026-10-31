---
name: salesdrone-lead-hygiene
description: "Maintain scoped full-list Lead Hygiene scans, shared-contact evidence and archive-review findings. Use for hygiene checks; merging, deletion and outreach remain outside this module."
---

# Lead Hygiene

Read [the shared contract](../SHARED.md) and [release readiness](../salesdrone-release-readiness/SKILL.md).

## Implementation status

Implementation for enhancement #95. Production availability is recorded by the verified PR and release workflow.
The access, retention and analytics contract is in [the feature contract](../../docs/LEAD-RESEARCH-CONTRACT.md).
API ownership below follows the generated contract. Histories remain creator-private; lead/source edits conservatively invalidate saved results.

## Policy and safety

Admins have access by default. Other members require explicit grants intersected with
current lead scope. Google/App Check only; no implicit PAT or anonymous/demo access to
live data. Recheck active membership, grants, assignment and workspace access policy
between pages and before publishing private data. Never share an Admin scan with an
assigned member. Persisted data is not an authorization authority.

Full authorized-list checks must be resumable, with explicit complete/partial/stale coverage.
Compare actual lead records using the existing phone/email normalization. Shared contact
is evidence for review, never proof that two enquiries are duplicates. Name alone is not
a duplicate key. Do not automatically archive, merge, delete, reassign or contact leads.
Archive-review rules require explicit Admin configuration and pending-task safeguards.
AI summaries are optional and cannot replace deterministic findings or source evidence.

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

- POST /api/v1/lead-hygiene/scans
- GET /api/v1/lead-hygiene/scans
- GET /api/v1/lead-hygiene/scans/{id}
- GET /api/v1/lead-hygiene/scans/{id}/findings
- GET /api/v1/lead-hygiene/scans/{id}/findings/{findingId}/leads
- DELETE /api/v1/lead-hygiene/scans/{id}
- POST /api/v1/lead-hygiene/scans/{id}/summary

## Implementation and regression entry points

- [Shared access](../../functions/src/lead-research-access.js), [source invalidation](../../functions/src/lead-research-store.js) and [worker](../../functions/src/lead-research-worker.js).
- [Behavior and permission tests](../../functions/test/lead-research.test.js).
- [UI](../../apps/web/src/features/ResearchPage.tsx) and [Admin settings](../../apps/web/src/features/ResearchSettings.tsx).

Reports scan active accessible leads and contact-index references in resumable pages. Shared-contact details paginate independently. Archive review needs configured stages/threshold, real recorded contact and no pending task; no task details are exposed. A source epoch or policy/configuration change invalidates the entire report. Admin deletion hides the report immediately and background cleanup removes its findings/evidence.
