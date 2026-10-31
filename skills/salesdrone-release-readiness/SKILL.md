---
name: salesdrone-release-readiness
description: "Review SalesDrone feature and setting changes for complete docs, skills, API permissions, Dynatrace signals, tests and pre/post-deployment evidence. Use alongside the owning module for every release; publication still requires user authorization."
---

# Feature completion and release readiness

Read [SHARED.md](../SHARED.md), the affected module from [the skill tree](../../skill-tree.json), and [the release procedure](../../docs/RELEASE.md). This skill is the cross-module completion contract, not another API owner or permission to delegate/deploy.

## Before implementation

Resolve the intended behavior, defaults, personal/workspace scope, data exposure and migration impact. Inspect current source; the tree routes prompts to logical modules, not independently deployed services. Select only the relevant modules. A user request to improve a feature is not authorization to change unrelated tenant policy or query/export customer records.

## Before every version release

1. Update affected module SKILL.md files with behavior, invariants, diagnosis and tests. Update skills/intent-map.json when routing changes; run skills:tree and skills:check.
2. Explain every added/changed setting in docs/settings-reference.json: default, owner/scope, permission, API, behavior, effective timing, example and limits. Update the shared UI section catalog when navigation changes. Regenerate docs:settings; docs:check rejects stale references. Check the public guide as well as repository Markdown.
3. For domain features define/update the versioned API, input/output, errors, permissions, token allowlist/scopes, concurrency, pagination and audit. Generate OpenAPI, update API owners and add authorization/negative tests. For UI-only work record why no new API is needed; do not create cosmetic endpoints.
4. Review metrics, traces, logs, canonical business events and release deployment events separately. For changed business writes use committed outboxes, safe dimensions and privacy tests. A navigation change can reuse existing instrumentation; record that decision instead of inventing a business event. Keep email RUM tagging distinct from pseudonymous backend attribution and keep Replay disabled.
5. Advance SemVer once with release -- patch|minor|major, complete CHANGELOG.md and releases/<version>.json. The release helper creates a template; replace incomplete impact notes. Check API/version compatibility and rollback consequences. Keep credentials and production data out of plans/artifacts.
6. For visible UI changes, follow salesdrone-product-guide and refresh affected public screenshots. List filenames in the release plan screenshots array, retain measured viewport/privacy review and record the current version in the hash manifest. A changed screen must not ship with an old capture.
7. Run relevant behavior tests, types, real Auth/Firestore emulator integration for domain/policy changes, build, docs:check, docs:build, skills:check, release:check, release:readiness, security:scan and staged-path review. Verify affected UI interactions with synthetic data; record measured widths and actual limitations. No wording-only test can prove a feature works.

## After authorized publication

The main workflow deploys rules/indexes, waits for readiness, then Functions and Hosting. Post-deploy checks require exact version/SHA, matching OpenAPI, unauthenticated API denial and ACTIVE metadata for all five functions. The documentation job independently checks the versioned settings guide on Pages. Safe JSON artifacts retain results even when checks fail.

Notify Dynatrace with version, commit, run, outcome and function metadata. The workflow probes real OTLP metrics/traces/logs and checks partial-success rejection counts, then checks canonical deployment BizEvent and deployment marker acceptance. A failure after a successful app deployment is a reporting/verification failure; inspect before retrying, never blindly redeploy or roll back business data.

Separately verify affected read-only production UI and the browser RUM identity mode when applicable. Tenant searches and native cross-signal links need query access; if unavailable, report the boundary explicitly. Never mark a pending/manual check passed from a plan or an HTTP receipt. A plan names expected checks; workflow artifacts and observed behavior provide evidence.

## Entry points and tests

- [releases/](../../releases/): versioned impact plans, not prefilled success certificates.
- [readiness-policy.mjs](../../scripts/readiness-policy.mjs): rejects incomplete impact plans.
- [post-deploy-checks.mjs](../../scripts/post-deploy-checks.mjs): checks live release, contract and protected boundaries without credentials/data reads.
- [deployment-signals.mjs](../../scripts/deployment-signals.mjs): validates each signal receipt; HTTP acceptance is not tenant searchability.
- [release-readiness.test.ts](../../tests/release-readiness.test.ts): negative plans, deployment mismatches, permission regressions and partial telemetry acceptance.
- [settings-reference.test.ts](../../tests/settings-reference.test.ts): complete settings coverage, escaped rendering and route selection.

Use [salesdrone-release](../salesdrone-release/SKILL.md) for publishing mechanics. Do not bypass a failing gate; change implementation or state the actual external blocker.

Firebase CLI non-interactive deployments require explicit dotenv parameter values even when the SDK declares a default. scripts/write-function-env.mjs materializes the model from the shared model-config.js constant or optional GitHub override; keep defaults centralized and verify function-environment.test.ts before deployment.

## Conditional reference

For detailed UI, recovery and integration recipes, read [operations](references/operations.md) when the affected behavior requires it. Follow current source and the shared contract when older examples differ.

## Known gaps

These are tracked follow-ups, not implemented behavior: [#33](https://github.com/theharithsa/SalesDrone/issues/33), [#71](https://github.com/theharithsa/SalesDrone/issues/71). Check their current status before changing the contract.

Current release plans require a milestone reference with numeric scope and readiness. Planning state holds publication; CI checks live GitHub milestone/issue assignments and PR closing scope. Main publication requires completed issue states. See docs/RELEASE-GOVERNANCE.md and milestone-policy.test.ts; local review iterations do not advance SemVer.

Unpublished candidate recovery is bound to the exact failed base/run/deploy job,
skipped Functions/Hosting, older live version/SHA and absent candidate tag/release.
check-release verifies this with read-only GitHub/Hosting evidence; the record cannot
authorize another base or published maintenance. See candidate-recovery.mjs/tests.

For verified unpublished recovery, impact coverage uses the proven prior published
commit rather than only the index-fix PR base. The live evidence gate runs first.

The supported API now also requires the registered Cloud Run ingress identity/parser checks before Hosting cutover and live parser probes afterward. CSP source review must preserve Google/App Check/RUM and managed HSTS. Do not close #30 using only inner Express tests.

If Functions already activated but Hosting was held, index-only recovery is ineligible. Preserve the failed deployment and plan a new forward PATCH milestone/issue before bumping; never recycle a partially deployed version. Shared managed-health validation must precede Hosting cutover.
