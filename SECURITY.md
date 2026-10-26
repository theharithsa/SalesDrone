# Security policy

## Supported releases

Security fixes target the latest 1.x application release. The HTTP API contract
has its own version. Report suspected vulnerabilities privately through this
repository's Security > Report a vulnerability feature. Do not put customer data,
access tokens, account screenshots or exploit credentials in public issues.

## Trust boundaries

- Google identities must be verified by Firebase Auth; server membership and
  capabilities decide live access. A successful Google login alone grants no data.
- Protected bootstrap admins are bound to their first verified Auth UID. Other
  accounts use demo data until an admin grants access. Demo writes remain in memory.
- The API enforces Firebase App Check in production. It independently checks
  authorization and assigned/all scope on lead-related reads, scores, journeys,
  task actions, inbox entries, AI context and idempotent replays.
- Client Firestore access is denied. Admin SDK operations use the function identity.
- Updates use optimistic versions; selected creates use idempotency keys. Imports
  are validated, bounded and resumable. Call corrections preserve prior revisions.
- Do-not-contact and incomplete-contact review gates suppress outreach and stale
  reminder jobs. Workers recheck membership and assignment before delivery.

## Secrets and deployment

Gemini, Dynatrace and cursor secrets live in Google Secret Manager. The deployment
workflow uses GitHub OIDC / Workload Identity Federation; it has no service-account
private key. The trust policy binds the numeric repository/owner IDs, main ref and
exact deploy workflow. Production credentials are unavailable to PR verification.
A deployment principal can run code as the application's runtime identity: control
of main is therefore a production security boundary. Protect it appropriately.

The Firebase web config, App Check site key, public VAPID key and RUM script URL
are browser configuration, not authentication credentials. Never put a private API
key or ingestion token in VITE_* variables, workflow logs, examples or screenshots.
Environment files, credential files and local captures are ignored. Run
`npm run security:scan` and review staged paths before publishing. This local scan
is a guardrail, not a guarantee that arbitrary secrets cannot exist.

## AI and monitoring privacy

AI inputs are untrusted data; Gemini has no tools for arbitrary external actions.
Automatic reminders validate times, ambiguous wording, permissions and stale
source revisions. Lead scores require exact source quotations and use deterministic
admin weights. Scores are sales prioritization aids, not credit/lending eligibility
or independent verification of business claims.

Backend telemetry exports only allowlisted operation names, release identifiers,
counts, outcomes and pseudonymous actor identifiers. It excludes names, contacts,
comments, task titles, request bodies, authorization headers and Gemini content.
Session Replay is disabled by the integration; private UI content is marked for
masking and action names are normalized. RUM still observes standard browser
performance/network/session data according to the tenant's privacy/consent settings.
The integration does not silently change tenant-wide consent, IP or retention policy. By explicit application-owner choice, approved live members’ verified emails are used only as browser RUM user tags; backend telemetry remains pseudonymous. Demo users stay anonymous, and sign-out/account switching ends the former RUM session.

Business events describe committed server transactions and use a durable outbox.
Ingestion is at least once; deduplicate by event.id before aggregating. Application
data deletion does not automatically erase already exported telemetry. Define tenant
retention and erasure processes independently. Query permissions differ from ingest.

## Public repository and documentation

Never publish lead spreadsheets, exports, source notes, real contact records,
production screenshots or authentication/session data. Only reviewed synthetic demo
screenshots belong in site/assets/screenshots. docs/screenshots, docs/demo and the
local verification ledger are excluded. The public site is a curated static build,
not a copy of the engineering workspace. Avoid embedding private issue/run details
or secret values in release notifications. Third-party libraries and fonts retain
separate licences; see THIRD-PARTY-NOTICES.md.

## Known operational boundaries

Firestore emulator tests do not enforce production composite indexes. Verify index
readiness before enabling new queries. Push delivery depends on device/browser
permissions; iOS requires a supported installed web app. Monitoring can be sampled,
blocked or unavailable and must never authorize an operation or certify a business
commit. Runtime errors and failed exports should be repaired without weakening
App Check, Firestore rules or membership checks.

## Personal Access Tokens

Admin-issued PATs use 256-bit random secrets, SHA-256 storage, one-time display and
7/30/90-day expiry. Only authenticated Google/App Check Admin owners with
members:write can list, create or revoke their own credentials. PATs cannot manage
tokens, members, security settings or devices and cannot invoke AI generation.
Explicit data scopes intersect the owner's current capabilities and lead scope.
Disabled/deleted Firebase Auth owners are rejected on admission. Credential validity and membership policy are rechecked in business transactions; scoped
idempotency replays are reauthorized. Per-token/owner limits bound API traffic.

Keep credentials in an integration secret manager. Never put them in browser
bundles, query strings, screenshots, exports or logs. The Swagger portal is
self-hosted, has no RUM/replay, disables remote validation and allows requests only
to its own origin. Authorization is in memory and cleared on page exit. Revocation
blocks subsequent authorization checks, not already-completed operations. A lost
creation response cannot recover the secret: revoke its metadata entry and reissue.
Rotate before expiry and revoke exposed tokens promptly. Treat the token owner as
the integration's data controller; no client Firestore access is granted by a PAT.

## Lead attachments and batch updates

Attachments use authenticated API transfer into private Firebase Storage. Client
rules deny every direct request; bucket public-access prevention is enforced. No
permanent download URLs are issued. Current membership and lead scope are checked
after Storage I/O too. Downloads force attachment disposition, octet-stream,
no-store and nosniff; uploaded documents are never rendered or sent to Gemini.
Type signatures and quotas are admission checks, not malware scanning.

Removal hides metadata immediately and queues retryable physical cleanup. Pending
reservations expire after an hour and receive an additional cleanup grace period.
Bucket soft-delete retention is independent from application access. File names,
bytes, object paths and checksums are excluded from telemetry. Integration tokens
need explicit attachments scopes; existing tokens gain no file access implicitly.
Bulk edits require explicit selected IDs, optimistic versions and current policy
for every lead, with no partial transaction on conflict.
