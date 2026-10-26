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
git push origin main
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
