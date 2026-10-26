---
name: salesdrone-lead-journey
description: "Maintain SalesDrone recorded stage transitions and current-stage journey UI. Use for flow/history changes; aggregate funnel and lead mutations belong to dashboard and leads."
---

# Lead journey

Read [the shared operating contract](../SHARED.md) before editing. Paths and commands
are relative to the repository root. Inspect current source rather than assuming
this map is an immutable schema or a standalone microservice.

## Responsibility and entry points

Atomic lead/call stage mutation → recordStage → leadTransitions → scoped journey response → current-stage path and known history.

- [functions/src/journey.js](../../functions/src/journey.js)
- [functions/src/app.js](../../functions/src/app.js)
- [apps/web/src/components/LeadJourney.tsx](../../apps/web/src/components/LeadJourney.tsx)
- [apps/web/src/lead-refinements.css](../../apps/web/src/lead-refinements.css)

## Primary API ownership

- GET /api/v1/leads/{id}/journey

Read the exact request/response/error schemas in [OpenAPI](../../docs/openapi.json)
and the route handler in [app.js](../../functions/src/app.js) when changing an API.

## Data and invariants

leadTransitions keyed from lead identity/version, with the current lead and configured stage choices.

- Record only committed creation and actual stage changes. Notes, rejected writes and replays do not create transitions.
- Never backfill fabricated stage history for existing leads. Current configured path and recorded historical transitions are different evidence.
- Custom/retired stage names must remain readable; stage order changes do not rewrite prior events.
- Authorize journey reads against the current lead and preserve bounded pagination/version ordering.

The journey responds to the LeadBlade container: wider desktop blades (500px+) use a horizontal path with internal overflow for long/custom stages; compact/mobile views remain vertical. CSS reflow must not request history again or imply prior-stage completion. Only the current stage is highlighted. Keep recorded history distinct, and verify orientation with the actual container width rather than viewport width.

## Change and diagnosis

If duplicate or missing transitions appear, inspect transitionId and expectedVersion/replay handling. Test old leads with no history, custom stages, backwards moves and a denied mutation.

## Verification

- [functions/test/journey.test.js](../../functions/test/journey.test.js)
- [functions/test/app.test.js](../../functions/test/app.test.js)

Apply the shared verification matrix to the changed behavior; these are the
module-specific regression entry points, not a substitute for integration checks.

## Deployment and handoff

api and Hosting. Coordinate lead route changes; no standalone journey Cloud Function exists.

Use [the release skill](../salesdrone-release/SKILL.md) for authorized publication.
Adjacent owners:

- [salesdrone-leads](../salesdrone-leads/SKILL.md)
- [salesdrone-workspace-settings](../salesdrone-workspace-settings/SKILL.md)
- [salesdrone-dashboard](../salesdrone-dashboard/SKILL.md)

## v1.8 operating notes

Journey uses a compact locally scrolling horizontal path. Current remains aria-current=step with highlighted text/point; the extra Current pill is removed. About this journey and Recorded stage changes are separate native disclosures; preserve honest recorded history and pagination. Test narrow/desktop/scale extremes.
