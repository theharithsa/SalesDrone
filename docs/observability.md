# SalesDrone observability

This document is the implementation contract and release evidence ledger. Entries
are marked by actual evidence; configuration alone is not end-to-end verification.

## Signal map

| Journey | Trace boundary | Canonical evidence | Sensitive data excluded |
|---|---|---|---|
| Login/API | Browser request → authenticated Express span → policy/store spans | Verified membership, not a browser success claim | Google token, email, profile name |
| Lead/call/note/journey | API → Firestore transaction | Per-domain committed transaction outbox event | Contact values, note text, factor evidence |
| Task/reminder | API/worker → persisted task/inbox/push outcome | Committed task/notification counts; worker result logs | Task title, FCM token, phone |
| Import | Validated chunk → Firestore transaction | Unique committed domain-write counts per transaction | Workbook rows, cells, errors with source text |
| AI | Request/worker → Gemini dependency span → validated persisted result | Score/task state commits; no prompt/response capture | Notes, prompts, free text, evidence quotations |
| Token lifecycle | Google/App Check → Admin owner → token transaction | Hashed credential; safe metadata; audit with opaque token ID | Token secret/hash, name, response body |
| Admin | Verified capability → member/settings transaction | Committed versioned domain changes | Invite address, custom-field values |
| Release | GitHub main → verified Firebase deployment | Version/commit/run/build/deployment event | Credentials, source data, customer screenshots |

## Identity and transport

Tenant ingestion: https://indiacs.live.dynatrace.com (not an apps UI host).
RUM uses the user-provided CDN tag. Backend service namespace is avinyatech;
service names distinguish API, reminder, note-analysis, scoring and telemetry workers.
Resources include service.version, deployment.environment.name and build commit.
The secret is DYNATRACE_API_TOKEN. Classic dt0c01 tokens use Api-Token auth;
OTLP uses HTTP binary protobuf at /api/v2/otlp/v1/{traces,logs,metrics}. BizEvents use
/api/v2/bizevents/ingest; deployment markers use /api/v2/events/ingest.

Backend spans use real OpenTelemetry context and validated W3C traceparent input.
Verified user IDs are hashed before export. A request ID identifies an attempt;
a transaction ID survives Firestore retries; event.id survives export retries.
Incoming context provides correlation only, never authorization. Export requests
are not auto-instrumented, preventing recursion. Firestore spans describe the SDK
boundary, not Google's managed database internals. Scheduled jobs start genuine
worker traces; the original request context is continued/linked only when persisted.

Browser RUM tags approved live workspace members with their verified Google email, as explicitly approved by the application owner. Demo/unapproved users remain anonymous. Account switches and sign-out end the previous session. Backend actor IDs remain hashed; lead contact details, notes and form values are never deliberately added. RUM normalizes operation/route names, masks private content and disables Session Replay. The late script-ready event retries identity application after bounded polling expires. A DOM diagnostic exposes only the identity mode, never the email value. Tenant consent, IP-masking, retention and
server-side RUM settings remain tenant-controlled. Local/emulator sessions do not
load RUM. Browser observations never certify a database commit. RUM-to-backend
navigation requires compatible tenant linking/configuration and is verified separately.

## Committed events and delivery

The observable store records bounded, allowlisted collection summaries in the same
transaction as domain writes. Multiple writes of the same document are counted once
per transaction. Events describe committed writes, not customer business revenue or
unique lead-count deltas. Failed/retried transactions and idempotent replays do not
produce extra committed events. No request body, result object or free-text source
is serialized. Background writes use system attribution unless a trusted caller is
available. Outbox/lease/rate-limit/audit-internal writes do not recursively emit events.

The scheduled exporter leases bounded records, sends individual CloudEvents and
marks delivered only on full documented acceptance. Timeouts/429/5xx retry with
bounded exponential backoff; persistent 400/401/403 stop automatic attempts until an
operator repairs configuration. Expired leases recover. A lost response can duplicate
an accepted event: consumers must deduplicate event.id before summing record counts.
Retain pending/rejected records; never delete them as a retry shortcut. For recovery,
fix the secret/scope/endpoint then reset a selected rejected record to Pending with
nextAttemptAt=now through an authorized operator, preserving its event ID/payload.

## Operational signals and privacy

Request counts/outcomes, request duration (seconds), domain transaction results and
worker/export results use bounded operation/method/status dimensions. Entity IDs,
UIDs, URLs and exception strings are not metric dimensions. Logs contain bounded
semantic event names, result categories, release IDs and genuine trace context.
Export queues/timeouts/flush waits are bounded. Monitoring errors do not replace a
business response or undo a committed operation. The outbox itself adds a bounded
number of transaction writes; preserve Firestore write-limit headroom for imports.

No customer records, lead text, task titles, notes, AI content, tokens or raw URLs
are exported deliberately. Deleting source app data does not erase tenant telemetry.
Retention/erasure must be managed separately. This integration does not create tenant
SLOs, dashboards or alert policies merely by emitting telemetry.

## Verification ledger

| Stage | Required evidence | Release result |
|---|---|---|
| Local OTLP | Independent protobuf receiver decodes all signals and resources | Passed: independently decoded real OTLP protobuf in the automated suite |
| Policy/resilience | Concurrency isolation, retry/idempotency, invalid context, exporter failure | Passed: concurrency, idempotency, rollback, leases, retries and failed-export tests |
| RUM | Approved tag load, masked UI, identity/sign-out, beacon delivery | Build includes approved masked loader; production beacon and native linkage require browser/tenant verification |
| Deployment | Secret bindings, function versions, worker health | See the versioned GitHub Actions deployment artifact and function revisions |
| Ingest | Distinct accepted response for traces, logs, metrics, BizEvents and release marker | Live synthetic probes: OTLP traces/logs/metrics HTTP 200, zero rejected; BizEvents 202; event marker 201 with OK result. Workflow verifies each deployment separately. |
| Search | Authorized tenant query locates exact IDs/versions | Requires query access; ingest alone is insufficient |
| Cross-signal | Navigate actual RUM action to backend trace | Requires tenant configuration and direct verification |

Release-specific deployment evidence is retained in GitHub Actions artifacts. Do not silently promote
HTTP acceptance to tenant searchability or assert cross-signal linkage from a custom
trace-id field alone.

## Email tagging verification

The RUM identifyUser call accepts the approved member email. Local lifecycle tests cover late readiness, stale login cancellation, account switches and sign-out. Tenant query credentials were checked during this release and returned HTTP 401; searchable email-tagged sessions remain unverified. Do not treat a successful browser API call as proof of tenant-side visibility. New sessions must use the updated app; historical hashed sessions are not relabelled.

## Per-release instrumentation probes

The deployment workflow forwards synthetic SDK-generated OTLP traces, metrics and logs under salesdrone-deployment-check, without reading customer data. It decodes partial-success responses and requires zero rejected records for every signal. Separate deployment BizEvent and CUSTOM_DEPLOYMENT marker receipts must be accepted. monitoring.json records only signal status/rejection counts and safe release IDs. This verifies ingest acceptance, not tenant searchability, live user behavior, worker health or native RUM-to-trace navigation.

Lead blade resizing is local presentation only. Do not export pointer coordinates, lead names, per-drag logs or fabricated business events; stage/assignment mutations retain the existing server-confirmed instrumentation. Release verification still checks OTLP and deployment-event acceptance.

Lead workspace navigation reuses safe RUM navigation and existing API instrumentation. Overlay resize, tab switches and sidebar collapse do not create canonical domain events or send comment contents. Release probes continue to verify logs, traces, metrics, deployment BizEvent and marker receipts separately from tenant searchability.

The explicit same-version v1.6.1 maintenance deployment is identified by commit SHA and workflow run, preserving the original release tag. Composer typing sends no inference request or telemetry content; the existing sanitized activity API instrumentation and committed event outbox remain authoritative.
