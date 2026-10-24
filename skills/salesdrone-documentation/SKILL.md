---
name: salesdrone-documentation
description: "Maintain SalesDrone README, public guide, technical docs, demo screenshots and illustration provenance. Use for documentation changes; API schema and release machinery have their own skills."
---

# Public documentation and illustrations

Read [the shared operating contract](../SHARED.md) before editing. Paths and commands
are relative to the repository root. Inspect current source rather than assuming
this map is an immutable schema or a standalone microservice.

## Responsibility and entry points

Copy/source edit → review source facts → synthetic capture or generated illustration QA → curated hash/allowlist → docs:build → Pages deployment via main workflow.

- [README.md](../../README.md)
- [site/index.html](../../site/index.html)
- [site/guide.css](../../site/guide.css)
- [scripts/build-docs.mjs](../../scripts/build-docs.mjs)
- [site/assets/screenshots/manifest.json](../../site/assets/screenshots/manifest.json)
- [docs/TECHNICAL.md](../../docs/TECHNICAL.md)
- [THIRD-PARTY-NOTICES.md](../../THIRD-PARTY-NOTICES.md)
- [assets/salesdrone-guide-illustrations/QA.md](../../assets/salesdrone-guide-illustrations/QA.md)

## Primary API ownership

No module-specific HTTP endpoints. This module supports the shared application surfaces.

Read the exact request/response/error schemas in [OpenAPI](../../docs/openapi.json)
and the route handler in [app.js](../../functions/src/app.js) when changing an API.

## Data and invariants

Curated site/.build output, reviewed screenshot hash manifest and original illustration assets; engineering docs are source references, not the Pages publish root.

- Public screenshots must use synthetic demo data or public schemas only. Never publish imported workbooks, private captures, tokens or real lead records.
- Guide navigation and section numbers derive from matching anchors and SECTION_NUMBER markers; validate build instead of hand-numbering.
- Keep app version distinct from API contract version. Check technology claims against manifests/source; dashboards currently use custom SVG charts.
- Use image generation for requested raster artwork and preserve source/prompt/QA and licence attribution. Reuse canonical asset paths instead of duplicating uncontrolled copies.
- Only explicit curated files go into Pages; do not broaden build-docs to recursively publish docs or arbitrary captures. Badge/README links must be real and meaningful.

## Change and diagnosis

Check all local Markdown targets, image loading, anchor order and generated numbering. Run docs:build; inspect the actual public guide and README after publish, not only a local preview.

## Verification

- [functions/test/api-portal.test.js](../../functions/test/api-portal.test.js)

Apply the shared verification matrix to the changed behavior; these are the
module-specific regression entry points, not a substitute for integration checks.

## Deployment and handoff

GitHub Pages for guide; Hosting when About/portal/app copy/assets change. Documentation releases still advance app PATCH under current release policy.

Use [the release skill](../salesdrone-release/SKILL.md) for authorized publication.
Adjacent owners:

- [salesdrone-interface](../salesdrone-interface/SKILL.md)
- [salesdrone-api-integrations](../salesdrone-api-integrations/SKILL.md)
- [salesdrone-release](../salesdrone-release/SKILL.md)
