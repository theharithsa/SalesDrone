---
name: salesdrone-product-guide
description: "Write SalesDrone module workflows, feature options, troubleshooting and FAQs; refresh reviewed synthetic screenshots after UI changes. Use for the user handbook and visual documentation, not API contract ownership or release authorization."
---

# Product handbook and screenshot maintenance

Read [SHARED.md](../SHARED.md) and the affected module skill before writing. The handbook teaches current product behavior; the overview introduces it, the settings guide explains every control and technical documentation supports maintainers. Do not substitute one for the other.

## Source and outputs

- [docs/product-guide.json](../../docs/product-guide.json): audience, ordered steps, explanations/limits and troubleshooting for each product module.
- [scripts/product-guide.mjs](../../scripts/product-guide.mjs): escaped HTML and Markdown renderer, stable unique module anchors and local text search.
- [docs/PRODUCT-GUIDE.md](../../docs/PRODUCT-GUIDE.md): generated repository handbook.
- [scripts/build-docs.mjs](../../scripts/build-docs.mjs): explicit public asset allowlist and product.html build.
- [site/assets/screenshots/manifest.json](../../site/assets/screenshots/manifest.json): reviewed captures with hash, measured viewport and release version.

## Workflow

1. Trace each described option to the actual form, capability and HTTP schema. Distinguish call outcomes from sales stage, current-stage funnels from history, private tasks from team assignment and AI suggestions from verified facts. Explain defaults, permissions, empty/error/loading states, pagination and recovery.
2. For UI changes list every affected public screenshot, including README embeds and overview images. Capture those screens again with the approved browser tool using isolated synthetic demo data or a fresh public-schema-only Swagger tab. Disable RUM in local rehearsals. Never capture real leads, imports, tokens or signed-in customer details.
3. Measure actual viewport dimensions and inspect each image before copying it to the curated path. Record sha256, capture date, measured viewport, mode, current app version and a short privacy/visual review. Reuse canonical filenames so README and guide references update together. Do not label desktop screenshots as mobile or an old capture as current.
4. Add new images explicitly to build-docs; never recursively publish docs/, workbooks or capture directories. Keep release plan screenshots listing affected filenames. Validate their manifest version before publication. Unchanged screenshots can retain honest historical metadata; replace any image whose visible design or controls changed.
5. Run docs:product, docs:settings, skills:tree, docs:check and docs:build. Inspect the generated handbook in a browser: search a feature, clear search, follow module anchors, open FAQs and settings/API links. Check that navigation labels match the real app and Documentation remains above Settings.
6. Update the owning module skill, README links, changelog and version impact plan. After authorized release check product.html and Settings reference versions independently of the application. Publication permission comes from the user, not this skill.

## Primary API ownership

No module-specific HTTP endpoints. Reuse domain contracts and the API integrations skill. The handbook must not invent CRUD routes or imply a shared task endpoint can expose another recipient’s reminders.

## Verification and limits

[tests/product-guide.test.ts](../../tests/product-guide.test.ts) exercises escaping and duplicate/incomplete anchors. Browser rehearsal proves interactions and screenshots; generated text checks do not prove the product works. If a physical-device test or tenant query was not performed, report that boundary.

Adjacent owners: [documentation](../salesdrone-documentation/SKILL.md), [interface](../salesdrone-interface/SKILL.md), [release readiness](../salesdrone-release-readiness/SKILL.md).

For visual preference features include how to enable, save, combine with theme and disable; distinguish personal from workspace scope and visual styling from offline/hardware behaviour. Book mode uses separate reviewed day, night, mobile and settings captures so standard screenshots can remain accurate with Book mode off. Keep explicit public asset allowlists; never publish a fixture directory.

When showing narrow-screen screenshots in the handbook, constrain the figure to its measured capture width rather than stretching a phone image across the desktop article. Update the screenshot allowlist and release manifest for new list/detail captures, record isolated administrator fixtures explicitly, and link typography guidance to the project design system. Do not equate enlarged root text fixtures with native Dynamic Type or physical-device verification.

An all-screen UI release needs reviewed phone, tablet, laptop and desktop captures with measured source viewports. Include login/import/settings when affected; isolated real-component fixtures must be labelled in the manifest as stubbed, with no claimed server writes. Refresh hashes/version and the curated build allowlist. Follow UI-REVIEW-1.6.7.md for the observed review model; temporary QA entrypoints must be removed before build.

When removing repeated UI, expand disclosures before capturing/verifying: count action sets and contact fields across full page and inspection overlay. Record the sidebar reminder as a menu row, not a banner. Same-version maintenance still needs refreshed affected images/hashes, exact commit-stamped public docs and the current authorization record; preserve historical unchanged captures explicitly.

Document editing as open lead then Edit lead; remove instructions to edit directly in table/card rows. For desktop-density claims distinguish data columns from former sticky Actions, quote measured viewport/fixture counts and keep custom-schema limits. Refresh desktop shell/table captures and mobile-list captures when row actions change; unchanged login/isolated-component images can retain honest prior metadata.

Document personal font styles under Appearance & time, draft preview/save timing, defaults, Book override and branding/monospace exceptions. Refresh changed activity and Appearance screenshots with synthetic data; keep unchanged captures honest. Retain self-hosted font licence/source documentation and browser-check native font selection at narrow widths.

Explain Exact match separately from Equals: only source, stage and available custom dropdowns support literal case/space/Unicode matching. Curate desktop and mobile filter captures and keep unchanged historical captures honest.

Explain Admin field setup before import preview, schema persistence on cancellation, explicit exclusions, duplicate/blank headers and stable field reuse. Explain the Today personal grouping selector and automatic hidden-stage fallback, bounded groups and unchanged KPIs. Refresh affected desktop/mobile import, category and popup captures without relabelling unchanged historical assets.

## Conditional reference

For detailed UI, recovery and integration recipes, read [operations](references/operations.md) when the affected behavior requires it. Follow current source and the shared contract when older examples differ.

## Known gaps

These are tracked follow-ups, not implemented behavior: [#4](https://github.com/theharithsa/SalesDrone/issues/4), [#15](https://github.com/theharithsa/SalesDrone/issues/15), [#21](https://github.com/theharithsa/SalesDrone/issues/21), [#37](https://github.com/theharithsa/SalesDrone/issues/37), [#55](https://github.com/theharithsa/SalesDrone/issues/55), [#56](https://github.com/theharithsa/SalesDrone/issues/56), [#58](https://github.com/theharithsa/SalesDrone/issues/58), [#59](https://github.com/theharithsa/SalesDrone/issues/59), [#60](https://github.com/theharithsa/SalesDrone/issues/60). Check their current status before changing the contract.

Capture Source, Zone and custom-field selections with configured labels, mapped import destinations/conflicts, and empty groups. Keep primary/helper rows separate; refresh affected states without restamping unchanged captures.

Explain explicit stage analytics separately from form hiding and Automatic fallback. Document retained shared-contact edits versus newly acquired duplicate contacts. Use fresh synthetic filled-select captures for dialog fixes.
