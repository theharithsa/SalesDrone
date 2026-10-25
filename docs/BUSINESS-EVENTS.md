# SalesDrone business events

BizEvents were already configured before v1.6.2. Business transactions atomically append privacy-safe outbox records; exportTelemetry drains them about once per minute. The GitHub workflow separately sends deployment events. v1.6.2 corrects the CloudEvents media type and provider consistency so Dynatrace can normalize source/type/id and data into searchable event fields. Prior HTTP 202 receipts do not establish that old events were normalized as intended.

## Catalog and authority

| Event type suffix (`com.avinyatech.salesdrone.` prefix) | Meaning |
| --- | --- |
| leads.committed | Lead records written, changed or archived |
| activities.committed | Notes and logged calls committed; operation identifies the route, without note contents |
| activityRevisions.committed | Revision-preserving corrections |
| leadTransitions.committed | Actual recorded stage transitions |
| tasks.committed | Task lifecycle writes, including background follow-ups |
| members.committed / invitations.committed | Access-administration writes |
| personalAccessTokens.committed | Token lifecycle metadata; no secret/hash/name |
| imports.committed | Import progress writes; not imported row contents |
| leadScores.committed | Ready/Failed score results, without AI evidence |
| settings.audit.committed | Durable per-setting net changes; see [settings audit](SETTINGS-AUDIT.md) |
| settings.committed | Allowlisted workspace configuration writes |
| notifications.committed / devices.committed | Private inbox/device lifecycle counts; no message/device tokens |
| deployment.succeeded / deployment.failed | GitHub automation-confirmed deployment outcome |
| instrumentation.verified | Explicit synthetic connection check, excluded from business totals |

Canonical backend provider: `com.avinyatech.salesdrone.backend`. Deployment provider: `com.avinyatech.salesdrone.github-actions`. Test probes use `com.avinyatech.salesdrone.validation` and `validation.synthetic=true`. Missing live activity is not evidence that a UI demo interaction should emit a business event: the demo is deliberately isolated.

Backend events have server-confirmed authority and one stable ID per transaction/domain. They contain schema.version, transaction/operation/request IDs, a hashed actor, bounded route/domain, app version/commit and records.written/known_created/known_changed/deleted. They **count committed document writes**, not unique leads, revenue or sales conversion. A task state change and a later reminder worker update can both write the same task. Do not sum these as new tasks or sales. `known_created` is only known when the transaction read the prior absence; it is not a universal creation total.

## Transport and retries

POST `/api/v2/bizevents/ingest` with `Content-Type: application/cloudevent+json`, server-side `Api-Token` and a CloudEvents 1.0 envelope. source and data event.provider agree. source/type/id map to event.provider/event.type/event.id. The classic CUSTOM_DEPLOYMENT marker endpoint continues to receive ordinary application/json.

Only HTTP 202 finalizes the owned lease as Delivered. deliveryFormat=cloudevent-v1 distinguishes the new transport from legacy-json receipts. Expired leases recover; 408/429/5xx/network failures back off. Persistent 400/401/403 stop as Rejected for operator repair. No network call occurs in a business transaction. A worker that lost its lease cannot finalize or count a successor's result. Response loss can duplicate delivery: deduplicate event.id before aggregating. Do not resend already-delivered historical events just to rename fields.

`salesdrone.bizevents.delivery` is a delta counter of finalized delivery attempts, by outcome (delivered/retried/rejected) and bounded HTTP status class (or network). It is not a count of distinct business outcomes. Existing telemetry.delivery logs and telemetry.deliver spans retain safe event IDs/status and real trace context; no event payloads, customer text, emails or credentials are logged.

## Find events and diagnose gaps

DQL examples are templates; validate them with your own tenant query access:

```dql
fetch bizevents, from:now()-24h
| filter event.provider == "com.avinyatech.salesdrone.backend"
| dedup event.id
| summarize events=count(), by:{event.type}
```

```dql
fetch bizevents, from:now()-24h
| filter event.provider == "com.avinyatech.salesdrone.github-actions"
| fields timestamp, event.id, event.type, app.version, build.commit, deployment.outcome
| sort timestamp desc
| limit 20
```

Old application/json envelopes may instead have type/source/id at the top level and data encoded as a string. To locate those without exposing payloads:

```dql
fetch bizevents, from:now()-7d
| filter startsWith(type, "com.avinyatech.salesdrone")
| fields timestamp, type, source, id
| limit 20
```

Run `node scripts/inspect-bizevents.mjs` with the existing authorized Firebase CLI operator account. It reads aggregate counts plus at most 20 projected receipt metadata rows; it does not read leads/comments/tasks or print credentials. Run `node scripts/verify-bizevents.mjs` to send an explicitly synthetic event through the actual outbox transport with an in-memory queue, not a fake production business operation.

Check in order: domain commit → outbox Pending/Sending/Delivered/Rejected and lastStatus → secret binding/scope and scheduled exporter health → ingest receipt → tenant bucket/pipeline/time range and authorized search. A working deployment BizEvent does not by itself verify the scheduled business exporter, and a 202 does not prove searchability. Do not broaden application permissions to investigate the queue.

## Evidence and boundaries

On the 26 October 2026 release review (Asia/Kolkata), read-only production diagnostics found 3 Delivered records, 0 Pending, 0 Sending and 0 Rejected; the three previous receipts were HTTP 202. The separately configured Dynatrace query context returned HTTP 401, so tenant searchability and native RUM-to-trace navigation remain unverified. Local tests independently verify media types, envelopes, decoded OTLP signals/metric dimensions, retries, idempotency, rollback and stale-lease behavior. Each release archives its own safe ingest receipts and exact commit in GitHub Actions.

References: [Dynatrace CloudEvents ingestion](https://docs.dynatrace.com/docs/observe/business-observability/bo-events-capturing/bo-events-capturing-external-sources), [API ingestion reference](https://docs.dynatrace.com/docs/platform/openpipeline/reference/api-ingestion-reference), [observability contract](observability.md).
