---
name: salesdrone-dashboard
description: "Maintain SalesDrone dashboard aggregates, charts, current-stage funnel and grounded Gemini outreach briefs. Use for analytics/visualization and insight issues; per-lead scoring belongs to lead-scoring."
---

# Dashboard and AI insights

Read [the shared operating contract](../SHARED.md) before editing. Paths and commands
are relative to the repository root. Inspect current source rather than assuming
this map is an immutable schema or a standalone microservice.

## Responsibility and entry points

Scoped dashboardSnapshot/summary → deterministic charts → mode-controlled dashboardBrief via Gemini → verifyBrief → private cached suggestion with source context.

- [functions/src/dashboard.js](../../functions/src/dashboard.js)
- [functions/src/intelligence-gemini.js](../../functions/src/intelligence-gemini.js)
- [functions/src/app.js](../../functions/src/app.js)
- [apps/web/src/features/DashboardPage.tsx](../../apps/web/src/features/DashboardPage.tsx)
- [apps/web/src/components/PipelineFunnel.tsx](../../apps/web/src/components/PipelineFunnel.tsx)
- [apps/web/src/intelligence.css](../../apps/web/src/intelligence.css)

## Primary API ownership

- GET /api/v1/dashboard
- POST /api/v1/dashboard/insights
- GET /api/v1/summary

Read the exact request/response/error schemas in [OpenAPI](../../docs/openapi.json)
and the route handler in [app.js](../../functions/src/app.js) when changing an API.

## Data and invariants

Scoped current lead/activity aggregates, current user’s outstanding tasks, users/{uid}/insights caches and version/config context.

- A funnel shows current stage counts, not historical conversion rates; it can widen. Include configured zero-count and custom stages.
- Charts use custom SVG/HTML/CSS, not Recharts. Keep count-derived geometry, meaningful labels, keyboard stage filtering and reduced-motion equivalents.
- AI receives permitted aggregates and the user’s own task context only. Verify cited IDs/numeric facts and reject invented evidence.
- Use a compact Get insights action in the card header, with a mobile touch target and no full-width primary CTA. Default to manual generation. In automatic mode, request once after the dashboard mode loads and hide the action. Chart refreshes must not repeat generation; demo never requests inference. Keep errors visible without retry loops. Keep duplicate-click protection and label the summary with its own snapshot time.
- Workspace AI guidance is read server-side and changes the cache fingerprint; recheck its version before publishing an in-flight summary. Never let preferences override grounding, permissions or blocked-lead rules.
- Charts remain usable when briefs fail; stale cache or unavailable inference must not hide deterministic data. Never infer creditworthiness from a score.

Workspace accessPolicyVersion and effective scope participate in brief source fingerprints and publication rechecks. A policy change while Gemini runs must reject the old brief, including when membership.version is unchanged.

## Change and diagnosis

Compare deterministic API aggregates to filters/membership before debugging chart geometry. Test no data, custom stage order, backlog, inaccessible tasks and invalid AI citations; verify a stage click opens matching leads.

## Verification

- [functions/test/intelligence.test.js](../../functions/test/intelligence.test.js)
- [functions/test/journey.test.js](../../functions/test/journey.test.js)
- [functions/test/personal-access-tokens.test.js](../../functions/test/personal-access-tokens.test.js)

Apply the shared verification matrix to the changed behavior; these are the
module-specific regression entry points, not a substitute for integration checks.

## Deployment and handoff

api for aggregates/briefs and Hosting for charts. Shared provider changes can require leadIntelligence verification. Do not create a new scheduler merely for chart refresh.

Use [the release skill](../salesdrone-release/SKILL.md) for authorized publication.
Adjacent owners:

- [salesdrone-lead-scoring](../salesdrone-lead-scoring/SKILL.md)
- [salesdrone-leads](../salesdrone-leads/SKILL.md)
- [salesdrone-lead-journey](../salesdrone-lead-journey/SKILL.md)
- [salesdrone-interface](../salesdrone-interface/SKILL.md)

Read for detailed behavior:

- [docs/INTELLIGENCE.md](../../docs/INTELLIGENCE.md)

Chart reading uses HTML y-axis/date labels and a centered HTML ring total; retain SVG accessible descriptions and authorized aggregate data. A native Chart day selector provides a touch/keyboard alternative to the dots. Clamp selectedIndex when data shrinks; an empty chart has a disabled fallback. Selecting a day changes local presentation only: no new Gemini request, API scope or conversion event. Check first/last/empty selection, resizing and both palettes/Book mode. Dashboard content-container thresholds govern chart columns, not outer-window width.

## Material 3 v2 local-review guidance

Material v2 places metric cards before the briefing, uses horizontal stage cards and one chart hierarchy. Current-stage counts are still snapshots, not historic conversion. Manual/automatic AI generation policy is unchanged. Review the redesigned chart labels, small-screen scrolling and both palettes before approval.
