# Archives and lead-data reset (2.1.0)

Archives is a scoped, read-only Settings view over retained archived=true leads. New archives record archivedAt; legacy dates remain unknown. Viewing does not restore leads or restart reminders.

The human confirmed on 29 October 2026: **All lead data; retain workspace configuration**. The human separately authorized production publication on 29 October 2026. Neither instruction authorizes executing a reset against production for verification.

## Reset contract and retained data

Settings Lead data management is Admin-only. All four /lead-data-reset APIs require current active Google/Admin membership, members:write and baseline leads:read plus production App Check; PAT routes are intentionally absent. POST preview returns owner-bound ten-minute preview ID and approximate counts. POST start requires a UUID Idempotency-Key, previewId and exact DELETE ALL LEADS confirmation. Start consumes the preview and stores stable operation identity. Conflicting retries fail; a completed start replay never runs deletion again. Status and versioned POST :id/resume support recovery; no cancellation after acceptance.

Deletion covers reminder deliveries/per-device receipts belonging to lead tasks (and orphan deliveries), lead tasks, attachment metadata and fixed private lead-files prefix, activities/revisions, transitions, note analyses, scores, imports/chunks, dedupe keys and leads. Every member, including inactive members, has lead notifications and insight caches cleaned. Standalone tasks/delivery receipts/notifications remain. All API idempotency results are replaced with minimal expired tombstones so neither customer payloads nor old replay resurrection survive. A fresh import starts a new job.

Users, membership/protected admin bindings, permissions, tokens, devices, settings and personal preferences are retained. Security audit, cleanup progress and safe telemetry outbox remain. This control is not provider-level erasure of historical backups, soft-deleted storage versions or already exported external data.

## Concurrency and bounded recovery

index.js uses guardLeadData around the observable store, and createApp applies the same guard when tested directly. Every application/worker transaction reads the persistent reset lock, so Firestore retries racing transactions. Lead/task/import/activity/insight mutation routes additionally reject new external work with 503 LEAD_DATA_RESET. The reset runs through the underlying observable store while domain writes are paused.

Start waits five minutes, longer than current API/worker function request deadlines, before cleanup. The reminders worker advances at most four batches per invocation instead of dispatching reminders; note/scoring workers skip while active. Existing telemetry delivery continues. Each batch scans up to 30 raw document IDs (including documents without an id field), with a 150-second lease, cursor and persisted counters. Network file calls are outside transactions. Per-device receipt sets drain in bounded chunks before their parent delivery. Other batch writes stay well below the transaction limit.

Files are removed idempotently and a bounded fixed-prefix Storage sweep removes unreferenced current objects. A failure retains the lock, cursor and sanitized Blocked status; no raw provider error is persisted/exported. After diagnosis an authorized Admin resumes using expectedVersion. A crashed lease can be reclaimed; an old lease cannot advance progress. Counts reflect acknowledged commits and may undercount side effects completed before a retry.

The worker must not be rolled back/removed while a reset is active. Before release ensure the runtime identity can list/delete the existing private bucket prefix; this implementation creates no IAM changes. Deploy all affected api/reminders/analyzeNotes/leadIntelligence/exportTelemetry exports so every producer uses the lock. Scheduled worker health is required; a disabled scheduler leaves the operation Waiting/Running until repaired.

## Observability and validation

Reset job commits produce safe leadDataResets.committed outbox events with numeric reset_started/reset_completed/reset_blocked transitions; payloads and object names are excluded. Actual data deletion reuses existing per-domain committed deletion counts; transaction rollback also rolls back outbox evidence. HTTP/Firestore/Storage spans, RED metrics, numeric processed/removed/blocked worker results and sanitized logs reuse current telemetry. No new tenant settings, scopes or metric labels.

Local evidence: real Auth/Firestore/Storage emulator reset, files and orphan sweep, retained membership/settings, scoped archives and durable completed event. Memory/API tests cover confirmation, expiry, ownership, PAT/role/revocation, idempotency, blocked/resumed cleanup, concurrent workers and no resurrection. Synthetic Chromium checks cover archive paging and reset confirmation/focus/status on phone through wide layouts in both themes. These are not physical-device, production reset or tenant verification.

Official mechanics: [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions) and [Storage list pagination](https://docs.cloud.google.com/storage/docs/json_api/v1/objects/list). Do not infer successful physical erasure from an accepted start response.
