# SalesDrone technical guide

Current application: **1.1.0** (initial baseline **1.0.0**). Product: SalesDrone by AvinyaTech, part of Avinya
Enterprises. Code is MIT-licensed; third-party notices and trademarks remain separate.

## Stack and repository

| Layer | Implementation |
|---|---|
| UI | React 19, TypeScript 5, Vite 7, Lucide icons, Radix Dialog, responsive CSS |
| Fonts | Manrope body; Google Sans headings; Caveat first names in lead details; monospace contacts |
| API | Node.js 22, Express 5, Zod 4, Firebase Admin SDK |
| Identity | Firebase Auth Google provider, App Check, server memberships/capabilities |
| Persistence | Firestore Standard, transactionally consistent writes and service-owned outboxes |
| Hosting | Firebase Hosting SPA with function rewrites and immutable fingerprinted assets |
| Background | Cloud Functions v2 + Cloud Scheduler, Firebase Cloud Messaging |
| AI | Server-side Gemini structured JSON, validation and evidence grounding |
| Import | ExcelJS in a dedicated browser worker, CSV/XLSX, bounded validated chunks |
| Monitoring | Dynatrace RUM; OpenTelemetry HTTP/protobuf traces/logs/metrics; CloudEvents BizEvents |
| Delivery | GitHub Actions, Google OIDC federation, Firebase CLI, GitHub Pages |

`apps/web` owns presentation, in-memory demo state and authenticated API calls.
`functions/src` owns policy, validation, domain transactions and workers. `tests`
and `functions/test` hold unit/domain/integration tests. `site` is the curated public
product guide. `assets/salesdrone-guide-illustrations` retains original generated
illustrations. `scripts` contains release, contract, security and operator tooling.

## Request and domain lifecycle

A browser obtains a verified Google ID token and App Check attestation. The API
verifies both, resolves active membership and checks the operation capability.
Explicitly supported data routes also accept scoped Personal Access Tokens. Only active Admin users with Google/App Check sessions can issue and manage their own tokens. A token stores a hash, expires within 90 days, and is checked against current owner capabilities/scope and revocation state on every request and business transaction. Google-only routes remain protected by browser attestation. See [the API integration guide](API.md).

Every scoped lead read independently verifies assigned/all access. Business writes
recheck membership inside a Firestore transaction. Expected versions reject lost
updates; idempotency keys bind a logical create to its request fingerprint and
are reauthorized on replay. Domain changes, audit records and bounded telemetry
outbox entries commit together. Exporter/network calls happen after the transaction.

The UI never writes customer data with the client Firestore SDK. Unauthorized
Google accounts see only synthetic demo records. Signing out clears the live UI.
Admin access grants require the intended verified identity and can be revoked.

## Collections and state

Under `workspaces/avinyatech`: leads, activities, activityRevisions, leadTransitions,
tasks, members, invitations, dedupeKeys, imports/importChunks, requests, auditEvents,
settings, leadScores, noteAnalyses, reminderDeliveries, telemetryOutbox, personalAccessTokens and rateLimits.
Private user settings/devices/notifications/insights live under `users/{uid}`.

Lead contact normalization supports duplicate checks while preserving original
input. Sales stage, call outcome and disposition are separate concepts. Activities
are chronological notes/calls; corrections retain revisions. Imported follow-up
columns become individual historical notes. A lead transition records a real stage
change with a version and timestamp. Existing leads have no invented prior journey;
the current configured stage path is shown separately from known transition history.

Tasks have recipient, kind, due instant, state and optimistic version. Deletion is
soft and prevents pending delivery. Suppression cancels outreach while allowing
administrative tasks. Reminders use the recipient's timezone and enforce DST rules.

## AI boundaries

New call comments and lead notes enqueue an analysis tied to activity revision,
owner, assignment and scheduling preferences. A worker extracts a possible dated
next step using structured JSON, then validates evidence and resolves time rules.
Unclear, conditional or conflicting wording needs review. Manually supplied/edited
reminders take priority; stale inference cannot resurrect old work.

Qualification factors are configurable Fit/Intent/Red flags. Gemini extracts exact
quotes; the server computes normalized positive weights minus penalties, clamped to
0–100. Unknown-only evidence is unscored. Cache validity follows lead/rule versions;
weight-only changes recalculate without another extraction. Background scans are
bounded and initial population takes multiple runs. See INTELLIGENCE.md.

Dashboard briefs receive permitted aggregate facts and the user's own outstanding
task context. IDs and cited numeric facts are validated. AI prose remains a
suggestion. Charts are available if inference fails. The funnel uses current stage
counts, including zero/custom stages, and does not claim historical conversion.

## API contract

The generated OpenAPI and `/api/docs` describe operation permissions, request
schemas, response models, errors and cursors. App SemVer and API schema version are
independent. Pagination is bounded; cursors are signed and bound to identity,
membership version and filter context. Private responses are no-store. Examples:

- GET/PATCH leads, POST lead activities, POST corrections, GET lead journey.
- GET/POST/PATCH/DELETE tasks, owner-only inbox read/unread and device registration.
- Admin grants, members, field definitions, choices and scoring settings.
- Import preview/commit/recovery, score reads/refresh and dashboard/AI brief.

New APIs should reuse the existing policy/domain layers. No separate MCP surface
is provided; a future adapter should delegate to these contracts rather than bypass
membership, privacy or audit semantics.

## UI behavior

Desktop uses a collapsible sidebar and lead inspector. Mobile uses bottom navigation,
sheets and a Settings section selector. The notification bell opens a focus-managed
overlay without navigation; selecting an item opens the corresponding authorized
resource. Read/unread state persists privately. Escape, outside click and trigger
focus restoration are supported. The legacy notifications URL remains compatible.

The pipeline funnel is a current distribution with count-derived widths and bounded
entrance motion. It can widen between stages. Buttons open a stage-filtered lead list.
Lead journeys emphasize only the current stage; recorded changes confirm actual
movement. Reduced-motion users receive static equivalents.

## Monitoring, deployment and operations

See observability.md for signal contracts, resource identity, privacy, outbox retry,
OTLP transport and verification boundaries. See RELEASE.md for versioning, OIDC,
GitHub Actions, deployment events and rollback. Frontend assets carry the app version
and build metadata. Functions emit X-App-Version and resource service.version.

Production is `sales-drone-avinya`, with Firestore/functions in asia-south1. The
Firebase CLI reads runtime configuration; private keys are Secret Manager bindings.
Index creation is asynchronous: deploy indexes, wait READY, then publish dependent
queries. Do not redeploy shared/unrelated projects. Hosting route HTML revalidates;
content-hashed assets are immutable. The public Pages site is built from site only.

## Local development and tests

Use Node 22.18+ and Java 21. Run npm ci, npm test, npm run check and npm run build.
`npm run test:emulator` uses demo-salesdrone with real emulated Auth, Firestore,
transactions and deny-all client rules. For browser tests run the emulators plus
Vite with VITE_USE_EMULATORS=true and RUM disabled. Use synthetic accounts/data only.
Never attach production data or telemetry credentials to a rehearsal. See SETUP.md
for Firebase setup and SECURITY.md for deployment trust boundaries.
