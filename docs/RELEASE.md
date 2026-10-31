# Versions, delivery and rollback

The first published application baseline is v1.0.0. Later compatible features use
MINOR, fixes/docs/security/deployment repairs use PATCH, and incompatible application
changes use MAJOR. API contract versions are independent. All workspace package
versions must match. A main push without a higher version and a completed dated
CHANGELOG section fails verification, except the first repository commit.

```sh
npm run release -- patch  # or minor / major
# Complete the newly inserted CHANGELOG section.
npm run release:check
npm test
npm run security:scan
git add <reviewed paths>
git commit -m "fix: describe the customer-visible change"
git push -u origin <working-branch>
# Open a PR, wait for verification, and merge the PR through GitHub.
# Never push directly to main.
```

The main push runs the deployment workflow. PRs run verification only. GitHub Actions
pins actions to immutable commits, uses Node 22/Java 21, checks source/versions and
contracts, runs domain tests and the real Auth/Firestore/Storage emulator integration, and
builds production assets. The production job uses Google OIDC federation, deploys
rules/indexes and waits READY, deploys the salesdrone function codebase, then Hosting.
Every build stamps version, commit and timestamp. The workflow collects allowlisted
function revisions and reports the actual deployment outcome to Dynatrace as both
a CUSTOM_DEPLOYMENT marker and a versioned CloudEvent BizEvent. The workflow's
summary and artifacts preserve release metadata. Successful deployment is distinct
from telemetry acceptance; a rejected marker can make reporting fail after the app
has already deployed. Inspect the individual steps before retrying or rolling back.

Required repository variables: GCP_PROJECT_ID, GCP_WORKLOAD_IDENTITY_PROVIDER,
GCP_DEPLOY_SERVICE_ACCOUNT, DYNATRACE_TENANT_URL, VITE_FIREBASE_APPCHECK_KEY,
VITE_FIREBASE_APPCHECK_PROVIDER, VITE_FIREBASE_VAPID_KEY and VITE_ENABLE_RUM.
The private repository secret DYNATRACE_API_TOKEN is used only by the main deployment
job. Backend GEMINI_API_KEY, CURSOR_SECRET and DYNATRACE_API_TOKEN are separate
Secret Manager bindings. Never store credentials in the repository or public site.

The one-time operator provisioning scripts use the operator's existing Firebase/gh
login, preserve IAM policies with etags, and create no service-account private key.
Federation is restricted by numeric owner/repository ID, main ref and exact deploy
workflow. The deployment service account has product-specific deploy roles plus
narrow IAM-publication permissions and actAs on both the compute runtime account and the App Engine default service account (required by Firebase CLI preflight). That actAs
permission makes main a production trust boundary even without a direct data role.

The public documentation job uploads only site/ after its curated build. It does
not publish docs/, production captures, workbooks, local fixtures or internal evidence.
Screenshots in the site/ directory must come from synthetic demo sessions. Public
source does not expose Firestore customer records: live access remains server-owned.

Rollback: identify the last successful commit/version and its Firebase Hosting
release. An operator may restore a Hosting release for an urgent frontend issue.
For a code rollback, revert the relevant changes and release a new forward SemVer
version through the same workflow; never overwrite a published tag or move versions
backward. Restore compatible function/config versions when required, preserve schema
and outbox identities, and verify indexes/auth/suppression/reminder recovery. Disable
monitoring or pause its exporter only as an explicit operational measure; retain
pending/rejected events for later repair. Do not weaken access policy to verify a fix.

Every published change must update an affected `skills/salesdrone-*/SKILL.md`. CI compares `BASE_SHA` with HEAD and rejects changes without an added or modified module playbook; deleted skills and catalog-only updates do not count. Describe changed behavior, verification or operating guidance, rather than adding an empty version note.

## Mandatory feature completion and evidence

Every release uses the [readiness skill](../skills/salesdrone-release-readiness/SKILL.md) and an impact plan in releases/<version>.json. The release helper initializes the template; complete affected modules, docs/settings sections, API and permission decisions, metrics/traces/logs/business-event/deployment-event impact, tests and manual verification. Unchanged or inapplicable items need a reason. A new domain feature needs a versioned API; cosmetic navigation does not need a fabricated endpoint or business event.

Update every changed setting in settings-reference.json and regenerate SETTINGS.md. The shared UI section catalog plus token scopes generates the public settings.html reference. Update module skills, intent routing and skill-tree outputs. CI rejects stale generated docs, missing ownership, incomplete impact plans and missing module skill updates.

Pre-deployment: behavior/negative authorization tests, types, real Auth/Firestore/Storage emulator integration, generated API diff, settings/skill routing consistency, security scan, production and curated docs builds. Post-deployment: exact version/SHA, matching OpenAPI, protected unauthenticated endpoints including attachment listing returning 401 with current version, five ACTIVE function revisions, and the current settings guide on Pages. These checks never authenticate to or export customer data.

Dynatrace reporting sends release BizEvent and deployment marker plus synthetic SDK-generated metrics, traces and logs. Each signal must be accepted with zero partial rejections. release-verification.json, monitoring.json, deployment.json and docs-verification.json are sanitized Actions artifacts retained for 30 days. An impact plan is intent, not evidence. HTTP acceptance is not searchable tenant data or native trace linkage. Record manual browser checks and query-access limitations honestly.

If a post-check or telemetry export fails after Hosting succeeds, the application may already be deployed. Inspect the exact failing result; do not blindly redeploy, roll back business records or overwrite a release tag. A failed post-check reports the deployment outcome as failed and blocks the versioned GitHub release step.

## Private Storage release checks

The v1.9 workflow deploys deny-all Storage rules after index readiness and before
Functions/Hosting. Deployment metadata records only bucket configuration, deployment
outcome and function revisions. The postcheck requires public-access prevention
`enforced` and anonymous direct-Storage listing denial. Deploy dependent attachment
indexes before enabling list/cleanup code. Keep cleanup in the existing reminders
worker and retain compatible metadata states during rollback. Never make a bucket
public or create a permanent URL to diagnose an access failure.

## PR-first observability release

All changes must be submitted as a PR before main integration. On the working
branch, complete the release impact plan, reviewed synthetic capture manifest,
API/settings/skill docs and relevant backend/emulator tests. Push that branch,
create and attach a PR, inspect all required verification jobs and merge through
GitHub only after success. Do not push directly to main or use an administrative
bypass. Main's merge commit is the deployed identity; PR head/test identity differs.

The verify job runs ci-checks.mjs and archives safe check/leaf-case metadata on
success or failure. PR jobs have no Dynatrace/production secret. Deploy and Pages
remain dependent on successful verification. A trusted main observe job reports
workflow/check/testcase results, correlated reporting spans/logs and bounded
metrics independently. Failed/skipped deployment is still represented honestly.
CI signal failure does not undo a successful app deployment; repair/report again
using the retained run/attempt/artifact identity instead of redeploying business code.

After merge, verify the individual verify/deploy/documentation/observe jobs, live
version/commit, postchecks and signal receipts. Then use the existing Dynatrace MCP
to locate the exact release/CI event IDs, probe trace ID, release logs, runtime and
queue/CI metrics with short-window projections. App-domain events must come from
real committed operations; do not create customer changes merely to populate a
query. Native RUM-to-trace navigation is a separate check, with any unavailable
session/linking capability explicitly unverified. Maintain rollback source/config
and follow forward SemVer for any corrective code release.

## API and deployment hardening (2.3.1)

Pages requires both verification and the complete deployment job to succeed. Deployment reporting uses deployment-outcome.mjs with explicit Firestore/rules, index readiness, Storage, Functions, Hosting, published-version and postcheck outcomes. Any absent/skipped/cancelled/failed phase reports failed. A reporting failure can still follow an already successful app rollout; inspect live metadata before retrying. No intentional production failure is needed to test ordering.

## Counter TTL and model configuration

Deploy the rateLimits.expiresAt field override and wait for ACTIVE as well as composite-index READY before Functions/Hosting. A creation failure remains a failed deployment; do not bypass the wait. The reminders worker converts only internal legacy rate-limit timestamps in bounded transactions. Managed TTL deletion can lag expiry; admission control uses the minute bucket, not deletion.

GEMINI_MODEL defaults once in functions/src/model-config.js and is resolved through the Firebase runtime parameter by all AI adapters. The workflow does not write another default. Optional repository variable GEMINI_MODEL supplies an explicit override; leave it unset to use the shared default. API initialization requires the bound CURSOR_SECRET; Functions discovery defers secret reads and scheduled exports do not require that secret.

Dependabot opens reviewed weekly dependency/action PRs; it grants no auto-merge or deployment bypass. The lint gate and component tests execute in verification before production secrets are available.

## Exact match rollout

The additive Exact operator requires no lead-data migration. Retain existing default single-field indexes for source, stage and customFields keys; do not exempt these fields. The existing index-readiness gate still runs. A read-only managed planner probe with nonexistent values and document-name-only projection accepted combined equality predicates and returned no documents. The rate-limit TTL conversion is separate internal maintenance, not a lead rewrite.
