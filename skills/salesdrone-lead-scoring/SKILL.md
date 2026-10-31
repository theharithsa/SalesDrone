---
name: salesdrone-lead-scoring
description: "Maintain SalesDrone configurable Fit, Intent and Red-flag factors, grounded evidence extraction, deterministic scores and refresh workers. Use for scoring changes; dashboard brief prose belongs to dashboard."
---

# Lead scoring and qualification

Read [the shared operating contract](../SHARED.md) before editing. Paths and commands
are relative to the repository root. Inspect current source rather than assuming
this map is an immutable schema or a standalone microservice.

## Responsibility and entry points

Admin factor configuration + permitted lead/activity revisions → bounded leadIntelligence worker or authorized refresh → grounded signals → deterministic score/cache → scoped reads.

- [functions/src/scoring.js](../../functions/src/scoring.js)
- [functions/src/intelligence-gemini.js](../../functions/src/intelligence-gemini.js)
- [functions/src/app.js](../../functions/src/app.js)
- [apps/web/src/features/ScoringSettings.tsx](../../apps/web/src/features/ScoringSettings.tsx)
- [apps/web/src/components/LeadScore.tsx](../../apps/web/src/components/LeadScore.tsx)

## Primary API ownership

- GET /api/v1/scoring-settings
- PATCH /api/v1/scoring-settings
- GET /api/v1/lead-scores
- GET /api/v1/leads/{id}/score
- POST /api/v1/leads/{id}/score/refresh

Read the exact request/response/error schemas in [OpenAPI](../../docs/openapi.json)
and the route handler in [app.js](../../functions/src/app.js) when changing an API.

## Data and invariants

settings/scoring, settings/score-worker lease and scan cursor, leadScores keyed by lead, permitted source activities and lead versions.

- Gemini extracts signals with exact contiguous source quotes and IDs; the server computes weighted positive evidence minus penalties, normalized/clamped to 0–100.
- Unknown evidence is not false evidence; unknown-only leads remain unscored. Preserve conflict and stale states instead of manufacturing certainty.
- Company names, geography labels and absence of notes do not prove capacity, distance, credit or licences. Scores are outreach aids, not lending eligibility or independent checks.
- Separate extraction-rule hash from weight changes: reweight without unnecessary Gemini calls; stale source/rule versions need fresh evidence.
- Bound scans and respect worker lease, current scope, disabled settings and source-date uncertainty. Unknown imported event dates must not become fresh intent.

Configuration is under Settings → AvinyaIntelligence → Lead scoring, visible to Admins only. Dashboard insight generation mode does not disable background scoring.

Gemini model selection comes from the shared model-config default and the runtime GEMINI_MODEL parameter. Both adapters resolve the same parameter lazily; do not add a second workflow/environment fallback.

## Change and diagnosis

Inspect rule hash, source/lead version, worker cursor/lease and verified signal states before changing weights. Test quote mismatch, contradictions, unknown-only data, weight-only changes, stale caches and assigned-only reads.

## Verification

- [functions/test/intelligence.test.js](../../functions/test/intelligence.test.js)
- [functions/test/personal-access-tokens.test.js](../../functions/test/personal-access-tokens.test.js)

Apply the shared verification matrix to the changed behavior; these are the
module-specific regression entry points, not a substitute for integration checks.

## Deployment and handoff

api + leadIntelligence; Hosting for factors/score UI. Shared intelligence provider changes may also affect dashboard and must be tested there.

Use [the release skill](../salesdrone-release/SKILL.md) for authorized publication.
Adjacent owners:

- [salesdrone-dashboard](../salesdrone-dashboard/SKILL.md)
- [salesdrone-workspace-settings](../salesdrone-workspace-settings/SKILL.md)
- [salesdrone-conversations](../salesdrone-conversations/SKILL.md)
- [salesdrone-people-permissions](../salesdrone-people-permissions/SKILL.md)

Read for detailed behavior:

- [docs/INTELLIGENCE.md](../../docs/INTELLIGENCE.md)

## Conditional reference

For detailed UI, recovery and integration recipes, read [operations](references/operations.md) when the affected behavior requires it. Follow current source and the shared contract when older examples differ.

## Known gaps

These are tracked follow-ups, not implemented behavior: [#39](https://github.com/theharithsa/SalesDrone/issues/39). Check their current status before changing the contract.

Keep unknown/conflicting factor points hidden and unscored component totals as dashes; retain legitimate reported zero/positive points in spaced, wrapping rows and avoid negative-zero risk. This is presentation only, never change stored evidence/calculations. Focused component cases: lead score evidence values in workflows.test.tsx.
