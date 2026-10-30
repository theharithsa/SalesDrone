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

Lead All/Comments/Calls tabs reuse existing safe navigation and API telemetry. Local filtering creates no canonical business event or new trace/log/metric payload. Review details, call comments and unsaved drafts remain excluded. Same-version maintenance deployment signals retain exact commit/run identifiers.

## v1.6.2 BizEvents normalization

See [the business event catalog, diagnostics and DQL templates](BUSINESS-EVENTS.md). The committed outbox and GitHub deployment notifier now send application/cloudevent+json with consistent provider fields. The original ordinary-JSON receipts were accepted but their intended field normalization was not tenant-verified. Preserve historical IDs; do not replay delivered records. A bounded salesdrone.bizevents.delivery counter records finalized delivery attempts by outcome/status class; lease-loss attempts cannot report success. Source/delivery trace limits and privacy exclusions remain unchanged.

Book mode (v1.6.3) is a self-owned cosmetic preference. Reuse existing safe PATCH /me request spans/logs/metrics and release BizEvents. Do not emit a lead/business conversion or capture text, palette values or per-keystroke events for a style change; preference records remain excluded from the business-domain outbox.

The v1.6.4 lifecycle-button and task-tab layout correction reuses existing suppression/archive request telemetry and committed events. Do not create conversion events for cosmetic button changes, expose customer text or change private task scopes.

## Durable per-setting audit (v1.6.5)

[Settings audit coverage](SETTINGS-AUDIT.md) now includes personal preferences, closing their previous export gap. Atomic auditEvents.settingsChanges and settings.audit.committed outbox records are produced even when OTel is unavailable. Only committed net changes emit events, with hashed identities/control keys and no values. Large definitions use 40-key chunks. Accepted export emits settings.audit.delivered logs using the existing genuine trace, delivery counter and retry diagnostics. No new metric dimensions, request body logging, audit-read API or token permissions. Demo and OS-only changes remain excluded. The earlier statement that preference records produce no events is superseded for this explicit audit stream; generic preference document summaries remain excluded.

Personal font changes reuse the appearance section of the transactional settings audit. The only new exported change key is fontStyle; no preference value, sample text or activity content is added to telemetry. Existing OTel request traces/metrics/logs and canonical audit delivery remain authoritative. Invalid, denied, unchanged and rolled-back updates emit no committed font change. Tests: functions/test/font-style.test.js and the Auth/Firestore emulator integration.

## Desktop display scale audit

Display-scale saves reuse the personal appearance audit and atomic settings.audit.committed outbox. The new exported key is displayScale; values, names, screen text and customer records are excluded. No-op, invalid and denied writes emit no committed change. Existing request traces, metrics and safe logs cover the API without new cosmetic events. The release workflow reports version 1.8.0, commit and deployment outcomes through the existing deployment signals; HTTP acceptance still does not prove tenant-searchable data. Tests: functions/test/display-scale.test.js, settings-audit.test.js and emulator.integration.js.

## Batch leads and private files

Atomic batch updates reuse committed lead, journey, activity and assignment notification signals. Attachment metadata commits use the leadAttachments domain in the existing safe outbox, with count-only dimensions. Storage upload/download/delete have explicit dependency spans; no object paths, names, checksums or bytes are attributes. Frontend RUM operation templates now distinguish fixed batch paths and attachment/content routes, including PUT. Cleanup logs export removed/failed counts and failures never break reminder dispatch. Storage Rules and bucket public-access prevention keep direct access closed. Deployment events include v1.9.0/SHA and Storage deployment is part of the main pipeline. Unit privacy tests inspect events; HTTP receipts remain separate from tenant searchability.

## Local v2 visual redesign

The Material 3 preview retains current RUM page identities, API route templates,
member-email identity policy and canonical backend outboxes. No colour, layout or
tab selection invents a backend business event. The separate fictional admin review
entry has no RUM tag or API transport. No deployment event is sent for local work.
After design approval the existing workflow must report the real version/SHA and
verify delivery independently of tenant searchability.

### Local mobile patch 2.0.1

Mobile filter drafts do not create business events or server writes. Apply changes
only the existing lead query. Saved display zoom reuses PATCH /me and its committed
preference-key audit/outbox; no new telemetry field, email policy or event type is
introduced. Client page identities and authenticated API traces/logs/metrics are
unchanged. Deployment events are reserved for a later authorized publication.

The local task-list refinement reuses existing task API metrics, traces, sanitized
logs and server-committed task events. Header/status/menu presentation introduces
no API, permission or new event. Demo completion/cancellation is in-memory only;
no deployment signal or live task-delivery claim is made during local review.

The local theme-button redesign changes only the shared control's presentation.
Existing personal appearance saves retain their current API/audit/outbox path;
login/demo changes remain local. No new metric, trace attribute, log payload or
business event is introduced.

Leading mobile lead checkboxes and workspace logo removal are presentation-only.
They keep existing batch selection/open navigation, API permissions and safe RUM
behavior; they introduce no server write, business event or telemetry payload.

## v2.0.1 instrumentation and CI completion

See [the completed gap analysis](OBSERVABILITY-PLAN.md) and the repository
[Observability agent](../skills/salesdrone-observability/SKILL.md). Follow
[its operations runbook](../skills/salesdrone-observability/references/operations.md)
for PR-first release, bounded MCP validation and recovery. Current Classic token
transport is supported by the official [OTLP API](https://docs.dynatrace.com/docs/ingest-from/opentelemetry-classic/otlp-api)
and [authentication reference](https://docs.dynatrace.com/docs/dynatrace-api/basics/dynatrace-api-authentication).

New contracts (in addition to the existing request/worker/delivery signals):

| Instrument | Type / unit | Bounded dimensions / meaning |
| --- | --- | --- |
| salesdrone.runtime.memory | Gauge / By | kind=rss,heapUsed,heapTotal,external; process memory |
| salesdrone.runtime.cpu | Delta observable counter / s | mode=user,system; process CPU, not VM utilization |
| salesdrone.runtime.event_loop_utilization | Gauge / 1 | utilization since previous collection in this process |
| salesdrone.telemetry.exports | Delta observable counter / batch | signal=traces,logs,metrics; outcome=success,failure; SDK callback result |
| salesdrone.telemetry.flushes | Counter / flush | outcome=success,failure,timeout; recorded after bounded flush for subsequent export |
| otel.sdk.processor.span.* / log.* | SDK self-observability | queue capacity/size, processed and queue_full drops; bounded SDK component/type/error labels |
| salesdrone.outbox.records | Gauge / record | state=Pending,Sending,Rejected; exact aggregate sampled before drain |
| salesdrone.outbox.oldest_due_age | Gauge / s | age of earliest due Pending/expired Sending work observed at drain start |
| salesdrone.ci.results | Counter / result | check, outcome, kind=case/check; no IDs as metric labels |
| salesdrone.ci.duration | Histogram / s | same dimensions; measured source duration, not report processing time |

Each warm process has a random service.instance.id resource to prevent merging
independent delta streams. Cardinality is bounded by deployed runtime instances,
not users or requests. Process/runtime metrics are not infrastructure monitoring.
The explicit MeterProvider is shared with SDK batch processors for supported queue
self-observability; it is not a second SDK. Shutdown flushes/stops both providers.

Exporter callbacks are observed once, normalized to safe error categories, and
produce a sanitized platform diagnostic on failure. Customer data/error messages
and exporter URLs/credentials are never diagnostic attributes. A callback success
is not independent partial-acceptance validation; deployment probes decode the
actual OTLP response, and tenant queries check visibility. Exporter diagnostic
counters can be delivered only after the exporter recovers. No durable OTLP queue
is promised; business outcomes retain their separate durable outbox.

Existing domain CloudEvents now include optional numeric known-transition fields:
records.completed/cancelled/reopened/soft_deleted on tasks, and
records.archived/suppressed/unsuppressed/stage_changed/assignment_changed on leads.
These require a read-before-write snapshot and count final document transitions
once within the domain transaction. Failed transactions cannot emit them. They do
not export old/new values, add historic facts or create additional event totals.

Trusted main CI emits `com.avinyatech.salesdrone.github-actions.ci.workflow.completed`,
`.ci.check.completed`, and `.ci.testcase.completed` CloudEvents. `ci.kind`, `ci.check`,
`ci.status`, `ci.duration.ms`, and hashed `ci.case.id` describe actual execution.
Source test names/errors/output and fixture contents are excluded. A skipped/todo
case stays skipped; checks after a failure remain not-run. Case events and step
summaries are different aggregation levels; do not add them together.
CI spans/logs describe processing the retained execution report, not fabricated
historic test spans. Actual source completion time/duration are event metadata.
All carry automation-confirmed authority, stable event/transaction IDs, release,
commit and GitHub run metadata; native app commits retain server-confirmed authority.

PR verification receives no ingestion or deploy secret. A separate always-run main
observe job downloads safe artifacts after verify/deploy/documentation settle and
reports all their outcomes. HTTP 202 is required per CI event. On network loss,
retry the same event ID; on 400/401/403 stop and diagnose. Artifacts preserve safe
results/receipts for 30 days. Reporting failure never rolls back an app deployment.
A reporting-only retry preserves source verification attempt IDs. Test catalogs,
manual cases and browser/physical tests are never silently labelled executed.

RUM storage denial now retains a distinct random per-page fallback instead of a
shared browser:session tag. Request actions close exactly once even when property
recording throws. Existing approved live-email policy, account switch/sign-out,
manual route names, first-party propagation and Replay exclusion remain unchanged.
No browser OTel gateway, new credential, scope, API or tenant setting is introduced.

The connected MCP was verified as bos01241 / indiacs.apps.dynatrace.com and found
existing SalesDrone 2.0.0 logs. Release-specific 2.0.1 transport, tenant search and
native RUM linkage evidence are recorded after deployment; this section alone is
implementation guidance, not a verification certificate.

## Archive browser (2.1)

GET /archived-leads is a read-only scoped list: existing normalized HTTP RED metrics, request traces and allowlisted logs cover it, without customer field attributes or a canonical read event. Archiving reuses the existing transactional leads.committed records.archived and tasks.committed cancellation counts; adding archivedAt does not introduce a second event. Release-time tenant and production evidence is recorded separately from this contract.

### Global lead reset

leadDataResets.committed uses the backend provider and server-confirmed authority. Job state commits include numeric reset_started/reset_completed/reset_blocked transition counts. Existing per-domain records.deleted summaries cover acknowledged deletion batches without names, titles or file paths. Worker/HTTP RED metrics/logs/traces remain bounded; no new labels or tenant settings. Audit and telemetry outbox records are retained. Observe completion separately from POST acceptance; never execute a production reset simply to generate tenant evidence.


## Field visibility and Settings layout (2.2)

Expanded hiddenFields choices reuse the existing Admin PATCH /field-options RED
metrics, request traces, sanitized logs and atomic settings.audit.committed outbox.
The change key remains hiddenFields; no labels, contact values or new dimensions
are exported. No-op/denied/stale/rolled-back saves produce no committed change.
Text spacing and icon rendering produce no domain event. Production deployment
and tenant verification remain separate from configuration-preview interactions.

## Collaborative imports (2.3)

Committed import writes reuse domain outboxes and HTTP traces/logs. Safe lifecycle counts include import_created, import_updated, import_unchanged, import_skipped, import_preparing, import_completed, import_blocked and import_details_deleted. Never export source baselines, filenames, candidate identities or comments. RUM redacts IDs/query values. Local lifecycle tests/emulator persistence are separate from production/tenant searches, pending authorized publication.
