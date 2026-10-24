# Setup and operations

## Production configuration

Target project: `sales-drone-avinya`; default Firestore location verified read-only on 24 October 2026: `asia-south1`. Functions must retain the same `SDR_REGION` as the region in the Hosting `/api/**` rewrite. Do not create a second database or project.

1. Confirm Blaze billing and enable required Cloud Functions, Cloud Build, Artifact Registry, Cloud Run, Cloud Scheduler, Firestore and FCM APIs. Set budget alerts appropriate to expected use. Required deployment APIs were enabled and billing was confirmed during production release; budget alerts remain an operator task.
2. Enable Google in Firebase Authentication. Add the actual Hosting/custom domains to the authorized domains. Test popup and redirect login on Safari and mobile; configure the auth helper domain according to Firebase guidance for browsers that restrict third-party storage.
3. Register this web app with Firebase App Check (reCAPTCHA v3). Set the public key as `VITE_FIREBASE_APPCHECK_KEY` in the production build environment. The API verifies `X-Firebase-AppCheck` in production in addition to the Google ID token. Never deploy an emulator build; `VITE_USE_EMULATORS` must be false/unset.
4. Generate web-push credentials in Firebase Cloud Messaging. Set the public key as `VITE_FIREBASE_VAPID_KEY`. The public Firebase web configuration and public VAPID/App Check site keys are not admin credentials.
5. Configure Functions parameters using deployment environment/CLI: `SDR_REGION=asia-south1`, `APP_CHECK_MODE=enforce`, and a securely generated, stable `CURSOR_SECRET` (at least 32 random bytes). Keep the latter in the backend deployment environment, never in a VITE variable or browser code. If missing, a random process key is used: authorization remains enforced but cursors may expire across instances/restarts.
6. Review the restrictive Firestore rules and declared indexes. Index creation must finish before checking production filters/search; emulator integration does not prove composite indexes have finished building in production.
7. Regenerate contracts, run tests/build, and deploy only when release is requested. A normal release command is `npx firebase deploy --project sales-drone-avinya --only firestore,functions,hosting`. This implementation did not execute it.
8. Verify each named admin signs in through Google and is bound to its own Firebase UID. The first arbitrary user can never claim admin access. Other users see synthetic demo data until an admin creates an email-bound grant and the matching verified user accepts it. Grants expire after seven days; no invitation email is sent.

The public client config alone cannot enable services or prove IAM permissions/billing. Current CLI project visibility and database metadata were verified read-only; provider settings, App Check, VAPID, billing, deployed rules/indexes, and delivery have not been verified live.

## Access management

- Both bootstrap admins have the same capabilities and cannot be demoted through the app. Adding more administrators requires a deliberate trusted configuration change.
- Admins grant Viewer/SDR access with assigned/all-lead scope and explicit capabilities. All active workspace access includes read permission; import, assignment and user-management capabilities remain admin-only.
- Membership is checked on every request and again inside writes. Revocation takes effect on subsequent requests; a response/push already handed to a user/device cannot be recalled.
- Reassignment cancels pending lead tasks to prevent reminders being sent to the previous owner. Set the next task for the new owner after assignment. Standalone reminders remain personal.
- No live data is stored in persistent browser/worker caches. Sign-out and user switches clear in-memory records and drafts. Device association is revoked on sign-out when connectivity allows; generic lock-screen payloads contain no contact details.

## Import operations

- Accepted: `.xlsx` and CSV. Convert `.xls` to `.xlsx`. Macro-enabled files are not accepted. Workbook processing runs in a worker with a timeout, archive expansion bounds and limits on sheets/rows/columns/cells. Formulas and hyperlinks in mapped fields are flagged rather than evaluated.
- Import the customer workbook through **Import enquiries**. Select the worksheet/header row, review suggested mapping and date order, and map each legacy status explicitly. Phone cells already rounded or stripped of leading zeroes in Excel require human correction.
- Invalid rows are skipped with errors; duplicates are skipped without overwriting existing contacts. Initial imports are unassigned until an admin assigns them. An import can be resumed after a network interruption; the server stores progress by validated fingerprint and row/chunk identity.
- The complete error report is paginated from server-stored validation chunks. The on-screen preview shows the first 100 errors; the download includes all.
- Preview validity is 24 hours. The workbook is not stored as a file; normalized preview rows and error metadata are retained in Firestore. Define and implement retention/cleanup before long-term production use. Do not delete completed import identities or idempotency records casually: they prevent replay.

## Reminder operations

The exported `reminders` function runs every minute through Cloud Scheduler. It claims due deliveries with expiring leases, rechecks recipient membership/task version/lead access, creates a stable user inbox item, and sends generic FCM data messages. Per-device results avoid resending to devices already accepted by FCM. Failed device registrations are disabled; transient failures back off with a maximum of five attempts.

- No exact-time or exactly-once delivery guarantee. A crash between external FCM acceptance and saving that result can still produce a duplicate; stable notification tags reduce visible duplicates.
- A closed browser receives notifications only when its platform permits it. iOS/iPadOS require supported Home Screen installations. Device sleep, revoked permission, connectivity and OS policies may delay/suppress notifications.
- The Functions emulator does not automatically simulate Cloud Scheduler. Tests invoke the worker directly against test stores/the Firestore emulator and use a fake sender, avoiding outbound FCM.
- Watch structured `reminder_dispatch` logs (`claimed`, `sent`, `failed`, `cancelled`). Set an operational alert for failures, pending due records older than the expected processing window, and exhausted `Failed` records. Log/metric collection and alert policies still need production setup.
- Devices are private to each UID; the app supports at most ten registrations per user. Revoked/disabled registrations are checked again immediately before sending.

## Recovery, privacy and retention

- Keep regular Firestore backups/exports using trusted operator tooling, following the company's retention policy. Backups, PITR, recovery drills and automatic cleanup were not provisioned here.
- Calls and activity corrections retain old revisions; audit events record actor, action, time and request ID without copying whole contact records into logs. Archiving hides leads and cancels pending outreach; it is not permanent erasure.
- Plan a dedicated, authorized erasure/export flow before any data-retention requirement calls for it. The current UI does not claim that Archive permanently removes personal information.
- `requests`, `rateLimits`, import previews/chunks, old device delivery records and notifications need explicit lifecycle policies. Dates are currently ISO strings, so Firestore TTL cannot simply be enabled on these fields without a timestamp migration. Preserve replay/audit requirements when adding cleanup.
- To roll back, restore a known compatible Hosting/Functions release. Do not replace Firestore rules with permissive rules to work around a backend failure. Review schema compatibility before deploying older Functions against newer records.

## Gemini automatic reminders

The `analyzeNotes` scheduled Function uses the Secret Manager secret `GEMINI_API_KEY` and the non-secret parameter `GEMINI_MODEL=gemini-3.5-flash-lite`. Configure a new key with `firebase functions:secrets:set GEMINI_API_KEY --project sales-drone-avinya`; never add it to a web environment file or source. Redeploy the analysis function after secret rotation. See [automatic reminders](AUTOMATIC-REMINDERS.md) for processing, permissions, retries, API and date semantics. The worker uses its dedicated status/nextAttemptAt/id Firestore index; deploy indexes before activating a new worker.

## Appearance, field choices and task management

Use the top-right appearance toggle or Settings for light/dark/System. Admins can change field choices in Settings; see [field semantics and verification](UI-REFRESH.md). Task owners can edit title, time, kind and status, or delete tasks from the Tasks page. Deletion preserves audit history and cancels pending reminder delivery. No Firestore migration or additional index is required for this release.

## Custom fields and Settings navigation

Admins now manage custom lead fields separately from shared dropdown choices. Optional standard fields can be hidden/restored; removed custom fields retain historical values. See [configuration semantics and limits](SETTINGS-AND-FIELDS.md). New Google profile photos come from the verified identity and fall back to initials. Font assets and licenses are bundled with Hosting; no new credentials, migrations or indexes are needed.

## Lead notifications

The existing `reminders` scheduled function now also delivers new-lead and assignment alerts. Deploy both `salesdrone:api` and `salesdrone:reminders` with the frontend for this feature. It uses existing permissions, devices, outbox indexes and schedule; no new credentials are needed. See [notification behavior and limits](LEAD-NOTIFICATIONS.md).

## Multiple comment columns

On import, map ordinary lead fields, then select all desired discussion/follow-up columns under Import columns as comments. Nonempty cells become separate historical entries under each lead. Old previews remain resumable. See [import limits, compatibility and editing](COMMENT-COLUMN-IMPORT.md).

## Dashboard intelligence

See [INTELLIGENCE.md](INTELLIGENCE.md) for score factors, formula, privacy, caching, bounded scans, worker behavior and API operations. Deploy the activities actorUid/type/id DESC index before the dashboard, and bind the existing Gemini secret to both API and leadIntelligence functions. No additional browser credential is needed.
