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
contracts, runs domain tests and the real Auth/Firestore emulator integration, and
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
narrow IAM-publication permissions and actAs on the runtime account. That actAs
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
