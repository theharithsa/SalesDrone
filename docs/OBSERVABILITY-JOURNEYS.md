# Observable application journeys

v2.9.4 implements the instrumentation contract for #97 and the native SDLC transport in #71. Runtime acceptance is a separate entry in the verification ledger; source, local OTLP, HTTP acceptance and tenant searchability are different gates.

## Privacy and authority

Logs contain stage names, canonical field names/counts, finite errors, versions and pseudonymous references. Never export request bodies/URLs, contact values, task titles, notes, workbook cells/headers, custom field labels/values, provider error messages, prompts, completions, credentials or private chats. Request body presence and bounded declared size are diagnostic metadata, not payload capture. Session Replay stays disabled. Existing RUM identity policy remains unchanged.

The application audit and semantic event outboxes commit with domain writes even when OTel initialization fails. An SDK outage cannot disable committed audit capture. Failed transactions produce no committed events. A database callback retry reuses the transaction/event identity; replayed API calls do not create new success outcomes. Enqueue and delivery are distinct: `audit.delivered` means Dynatrace accepted that event, not that its source operation happened at delivery time. `event.occurred_at` and `origin.trace_id`/`origin.span_id` preserve origin; native log trace/span IDs refer to the actual delivery span. Outbox delivery remains at-least-once; deduplicate by `event.id`. Like-typed events are grouped at most ten per durable record to protect Firestore write limits. Each event is still sent as one CloudEvent and checkpointed independently. PendingBatch/SendingBatch isolate grouped records from older workers during rolling deployment; older code leaves them queued. The new consumer drains both formats, with four concurrent records, twenty records per run and an 80-second budget. Partial acceptance resumes at nextEvent; interrupted acknowledgement can resend the same stable ID. Rejected groups preserve progress and require operator repair with the group-aware consumer. Existing outbox Pending/Sending gauges aggregate both formats and count durable records, not unique events.

## Logs and trace context

`observability-contract.js` owns event names, stages, field allowlists, collection names, stat keys and error vocabulary. `http.received`, authenticated/authorized/envelope-validated/executing/responded stages, `http.rejected`/`http.failed`, `domain.transaction.committed`, dependency failures, worker stages/outcomes and accepted audit delivery provide breadcrumbs. The `validated` route stage covers the request envelope/query; domain schema validation can still reject execution. Authentication rejected before route matching is deliberately `operation=unmatched`, never a raw path.

All logs inherit actual active OTel context plus request/operation/transaction IDs and a hashed verified actor. Console copies also carry service/version/environment and native IDs; GCP runtime project configuration adds `logging.googleapis.com/trace`, spanId and sampled fields. Do not ingest console copies into Dynatrace again alongside OTLP. Only server-owned explicit audit attribution can override the current actor for legacy settings delivery.

4xx completions/rejections are WARN, 5xx/failures ERROR, normal milestones INFO. Idle worker and successful generic delivery summaries are DEBUG. `TELEMETRY_DEBUG_UNTIL` is an operator-only runtime environment variable: default unset/off, per-function scope, deployment-operator permission, no HTTP/UI setter. It must be an ISO timestamp in the next 15 minutes; expired or farther future values emit no DEBUG logs. It never changes privacy filtering. Unknown event/attribute, oversized record and logger drops increment `salesdrone.telemetry.dropped{reason}`; records cap at 8192 bytes and strings at 180 characters. OTel queues/exporter self-health remain bounded and observable.

Application errors use the committed finite set; gRPC numeric errors map to canonical `GRPC_*`, Firebase Auth/FCM codes to explicit finite aliases, TimeoutError to DEPENDENCY_TIMEOUT (before its DOM numeric code), AbortError to DEPENDENCY_ABORTED, ZodError to SCHEMA_INVALID and unknown codes to INTERNAL. Vendor messages/stacks are never exported.

Firestore client spans, including reads inside each transaction attempt, expose allowlisted collection/operation, numeric query-result count and actual callback attempt count. Internal reminder/analysis/index jobs retain an optional source traceparent; their later transaction spans add genuine OTel links, not fabricated continuous parentage. Older jobs without this metadata remain valid and unlinked.

Gemini spans use current OTel `gen_ai.provider.name=gcp.gemini`, bounded model/operation, server address, actual HTTP status, available input/output tokens and finish reason. Content is never recorded. HTTP provider failure, timeout and schema validation are distinguishable; unavailable token metadata is absent, never fabricated as zero. FCM sends expose messaging system/operation and finite normalized errors. Existing API error responses and inference behavior are unchanged.

## New metric catalog

Every resource keeps service.name/namespace/version, deployment.environment.name and build.commit. IDs and free text are forbidden as metric dimensions.

| Metric | Type/unit | Dimensions and meaning |
|---|---|---|
| salesdrone.http.requests | Counter/requests | operation, method, status, finite error.type (`none` for success) |
| salesdrone.http.duration | Histogram/s | operation, method, status; excludes error.type |
| salesdrone.db.operations | Counter/operations | allowlisted operation, collection, outcome |
| salesdrone.db.duration | Histogram/s | operation, collection |
| salesdrone.gen_ai.requests | Counter/calls | bounded model, generate_content/embeddings operation, outcome; HTTP transport outcome |
| salesdrone.gen_ai.duration | Histogram/s | same labels; HTTP/metadata duration |
| salesdrone.gen_ai.tokens | Counter/token | model, operation, input/output type; reported usage only |
| salesdrone.worker.items | Counter/item | finite worker and outcome; claimed increments at claim, other result counts at summary |
| salesdrone.worker.lag | Histogram/s | worker; claim time minus the current task dueAt for reminders or recorded note-analysis referenceAt for analysis; absent timestamps produce no age sample |
| salesdrone.queue.backlog | Gauge/item | queue reminders/analysis/research; full Pending-and-due count at drain start (research uses all Pending jobs) |
| salesdrone.queue.oldest_due_age | Gauge/s | queue; age of earliest eligible nextAttemptAt, **not original enqueue age**; research jobs have no recorded enqueue/due time, so their age is absent |
| salesdrone.telemetry.dropped | Counter/record | reason event/attribute/size/logger |

Scoring remains a bounded scan, not a durable Pending queue; do not invent a scoring backlog. Worker partial failures are WARN and increment run outcome partial_failure. Research errors do not prevent scoring. Queue sampling failures are explicit WARN without stopping business work. Counts reflect samples, not a global distributed instantaneous gauge; multiple function instances can expose separate samples.

## Canonical business events

Existing `<domain>.committed` summaries remain. New `audit.operation.committed`, `leads.stage_changed`, assignment/archive/restore/suppression, `activities.logged`, task completed/cancelled/reopened and import completed events share the server-confirmed transactional outbox. Event IDs hash transaction + semantic type + record path; one per observed transition in a committed transaction. Entity references are domain-prefixed SHA-256 values. Standard known stages/outcomes may be emitted; arbitrary admin options/source text are opaque option references. Canonical changed field names are allowed; custom field keys/labels/values are not. Import totals are captured once on completion, duration only when recorded timestamps exist. No historic event dates or absent facts are inferred.

## Browser actions

All actual JSON/upload/download API paths use one outcome vocabulary: success, failure, network_error, cancelled. Failed actions carry bounded API error code/status class and a valid request ID. Page visits record a bounded view intent and valid app_version property. Mutation action names describe a finite user intent; reads retain sanitized route templates. Caught API failures, render failures and global errors report bounded custom error codes, never original messages/component stacks. RUM finisher/error reports run once and cannot block business work.

Tenant setup: in the SalesDrone web application declare short-string action properties `app_version`, `operation_outcome`, `request_id`, `http_status_class`, `error_code`, `interaction_intent` from the RUM JavaScript API (String, user action storage). Classic RUM property keys permit lowercase letters, digits and underscores; dotted backend attribute names cannot be used as RUM property keys. Declare custom error key `salesdrone.error`. Preserve Replay disabled and current privacy/capture restrictions. Verify the application uses W3C trace context for same-origin API requests; never add blanket cross-origin propagation. API ingestion tokens do not imply configuration permission. See the verification runbook below; source alone cannot prove tenant capture.

## Routing, SDLC and detection

Routing is a compatibility contract: namespace **avinyatech**, services prefixed **salesdrone**, providers prefixed **com.avinyatech.salesdrone**. CloudEvent data now carries service name/namespace; CI uses salesdrone-ci/environment ci. Production runtime uses environment production. Validation uses verification/production-verification and must be excluded from production views. Dedicated bucket retention remains the existing tenant-owned 3657 days; this release does not change IAM, retention or privacy policy.

Deployment notification uses JSON `/platform/ingest/v1/events.sdlc` with event.category task, type deployment, status finished, service identity, release version, commit/run link, cicd.deployment.status and task.outcome. Classic access token scope is `openpipeline.events_sdlc`; HTTP202 is required. Platform token scope differs (`openpipeline:events.sdlc:ingest`). The existing credential passed an empty-batch authorization probe. The versioned deployment BizEvent remains separate. `verify-monitoring.mjs` sends a synthetic SDLC validation event, no CUSTOM_INFO/Davis marker. Native SDLC event ID is stable across notifier retries; HTTP acceptance is not bucket routing proof.

`observability/queries/` contains production-filtered deployment, latency/error and journey views. `observability/detections.json` records reviewable thresholds and minimum-volume windows. These definitions do not claim installed alerts or invent a notification destination. Open the deployment and runtime queries in adjacent notebook tiles with the same time window/commit for regression analysis.

## Verification runbook

1. Run decoded OTLP, contract/privacy/rollback/retry and actual api() RUM component tests, then required full checks and real emulators. Preserve artifacts outside Git.
2. After deployment check exact version/commit, revisions, API denials and all signal HTTP rejection receipts.
3. Query production logs/spans by build.commit; verify finite errors, DB attributes, Gemini usage when provider reports it and worker throughput/backlog. Query metrics with `timeseries`, never `fetch metrics`.
4. Query events by SDLC event ID/run and require `dt.system.bucket=salesdrone_events`, app.name SalesDrone; inspect all four existing dedicated bucket names/retention separately.
5. Read a synthetic/browser action's request.id in RUM and find the server span with that ID. Verify actual request traceparent and native parent linkage. The ingress and API must preserve validated W3C tracestate as well as traceparent, including Dynatrace dtr. Native IDs in DQL require `trace.id == toUid("32hex")`; comparing a native UID with a string silently misses. Do not call a UUID match alone native RUM trace linkage.
6. Check one new semantic BizEvent type and metric in the tenant. Use `node scripts/verify-observability-journeys.mjs` for verification-labelled, memory-only source transactions and genuine OTLP/CloudEvent transport. It uses the existing Secret Manager credential, never the production database. Do not edit customer records just to produce telemetry.
7. Record missing config access, RUM properties/linkage or tenant alert installation as pending, retain the relevant issue open, and never substitute HTTP202 for searchability.

References: [OTel log model](https://opentelemetry.io/docs/specs/otel/logs/), [sensitive data](https://opentelemetry.io/docs/security/handling-sensitive-data/), [Dynatrace SDLC](https://docs.dynatrace.com/docs/deliver/pipeline-observability-sdlc-events/sdlc-events), [deployment conventions](https://docs.dynatrace.com/docs/deliver/release-monitoring/version-detection-strategies-latest), [RUM JavaScript API](https://docs.dynatrace.com/javascriptapi/doc/types/dtrum.html).
