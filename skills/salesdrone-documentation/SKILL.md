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

Describe both insight modes in the public guide: manual is the default, automatic hides the action and requests once per dashboard visit. Keep AvinyaIntelligence settings paths and the current lead typography consistent with the app.

Document the Reports & lead access settings, selected-column filtered XLSX workflow and reports API limits. Public screenshots/exports must remain synthetic. Distinguish approved RUM email tags from still-pseudonymous backend actors and report tenant query limitations.

Every release regenerates docs/SETTINGS.md and publishes settings.html from the shared section/control catalogs, including every control’s default, scope, permissions, API, effect and example. The public API count comes from OpenAPI, not a hardcoded number. docs:check rejects stale settings and skill-tree outputs. No recursive publication of engineering docs or private evidence.

Document the local-only lead blade width, pointer/keyboard controls, reset, content-driven journey reflow and mobile/reduced-motion behavior in LEAD-BLADE.md. The appearance guide points to this gesture preference without presenting it as a server-side account setting. Use synthetic captures and state measured viewport limits.

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

For complete workflows and FAQs maintain docs/product-guide.json; docs:product generates PRODUCT-GUIDE.md and docs:build publishes product.html with escaped content and search. Follow [product documentation](../salesdrone-product-guide/SKILL.md) for UI screenshot refresh, affected-screen review and curated release-version evidence. The overview is not a substitute for the handbook or per-control settings reference.

When full-page identity layout changes, refresh both journey-demo.jpg and lead-workspace-demo.jpg from the actual synthetic app, with current-release manifest hashes. Check the handbook screenshot and README embed together.

Same-version maintenance remains visible in changelog/commit history. Document inline comment drafts, uncertain retries, left-aligned history and blocked-storage recovery; refresh affected desktop/mobile screenshots and retain explicit browser-only testing limits.

Public guide builds stamp the exact source commit and hash-version reviewed screenshot URLs. Post-deploy guide checks require commit as well as version, including same-version maintenance, so stale Pages HTML cannot satisfy the release gate.

## Conditional reference

For detailed UI, recovery and integration recipes, read [operations](references/operations.md) when the affected behavior requires it. Follow current source and the shared contract when older examples differ.

## Known gaps

These are tracked follow-ups, not implemented behavior: [#33](https://github.com/theharithsa/SalesDrone/issues/33). Check their current status before changing the contract.

Public release summaries include safe Archives restoration, author/Admin correction policy and the independently deployed API ingress before Hosting cutover. Keep README app version current; engineering ingress limits and native-provider boundaries belong in API-INGRESS.md. Preserve historical screenshot/release identities.
