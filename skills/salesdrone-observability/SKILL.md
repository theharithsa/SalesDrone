---
name: salesdrone-observability
description: "Maintain SalesDrone Dynatrace RUM, OpenTelemetry signals, committed business-event outbox and release reporting. Use for instrumentation changes; tenant investigations may use specialist Dynatrace tooling."
---

# Application observability

Read [the shared operating contract](../SHARED.md) before editing. Paths and commands
are relative to the repository root. Inspect current source rather than assuming
this map is an immutable schema or a standalone microservice.

## Responsibility and entry points

RUM action/request → authenticated API + store spans → committed business outbox → exportTelemetry worker → OTLP/BizEvent ingest; release workflow emits version/commit/deployment metadata.

- [functions/src/telemetry.js](../../functions/src/telemetry.js)
- [functions/src/telemetry-outbox.js](../../functions/src/telemetry-outbox.js)
- [functions/src/observable-store.js](../../functions/src/observable-store.js)
- [apps/web/src/lib/rum.ts](../../apps/web/src/lib/rum.ts)
- [apps/web/public/rum-bootstrap.js](../../apps/web/public/rum-bootstrap.js)
- [scripts/notify-deployment.mjs](../../scripts/notify-deployment.mjs)
- [scripts/collect-deployment.mjs](../../scripts/collect-deployment.mjs)
- [scripts/verify-monitoring.mjs](../../scripts/verify-monitoring.mjs)

## Primary API ownership

No module-specific HTTP endpoints. This module supports the shared application surfaces.

Read the exact request/response/error schemas in [OpenAPI](../../docs/openapi.json)
and the route handler in [app.js](../../functions/src/app.js) when changing an API.

## Data and invariants

telemetryOutbox committed CloudEvents; safe service/version/request context; private token only in Secret Manager/Actions secrets.

- Browser RUM is client-observed. Canonical business events come only from committed server transactions; retain at-least-once event IDs for deduplication.
- Allowlist low-cardinality fields; exclude contact/notes/task titles/URLs/bodies/tokens/prompts. Keep Session Replay disabled and normalize action names.
- Maintain real W3C trace context, request ID correlation, HTTP/protobuf OTLP and independently decoded transport tests. A client action is not proof of a successful backend write.
- Exporter failure must not roll back customer operations. Preserve bounded retries, leases, stable event IDs and rejected/pending work for repair.
- HTTP 202/201 proves ingest acceptance only, not tenant searchability, retention or native RUM-to-trace navigation. Verify each claim at its actual boundary.

Approved live workspace members now use their verified email as the RUM user tag, per the application owner's explicit privacy choice. Demo/unapproved users remain anonymous; backend telemetry still hashes UIDs and excludes emails. createRumIdentity handles account switches/sign-out and the late salesdrone:rum-ready event after bounded polling. A DOM diagnostic exposes only email/pseudonymous/anonymous mode, never the tag value. Test rum-identity.test.ts. An API call returning without error is not proof of tenant ingestion/searchability; query credentials can differ from ingest credentials.

Each deployment probes real SDK-generated OTLP traces, logs and metrics under salesdrone-deployment-check and validates rejected counts, then records separate deployment BizEvent/marker acceptance. monitoring.json is safe CI evidence, not proof of tenant searchability. Use deployment-signals.mjs and release-readiness.test.ts for missing/partial/malformed responses; a reporting failure cannot undo customer operations.

## Change and diagnosis

Inspect sanitized status/counts and correlation IDs. Test concurrent trace isolation, malformed parent contexts, redirected ingestion endpoints, failed exports and outbox retries. Use dt-obs if available for an instrumentation task; this skill does not require it to exist.

## Verification

- [functions/test/observability.test.js](../../functions/test/observability.test.js)
- [functions/test/app.test.js](../../functions/test/app.test.js)

Apply the shared verification matrix to the changed behavior; these are the
module-specific regression entry points, not a substitute for integration checks.

## Deployment and handoff

All affected functions when shared instrumentation changes (api, reminders, analyzeNotes, leadIntelligence, exportTelemetry), plus Hosting for RUM. Deployment reporting changes belong in the shared Actions workflow.

Use [the release skill](../salesdrone-release/SKILL.md) for authorized publication.
Adjacent owners:

- [salesdrone-data-platform](../salesdrone-data-platform/SKILL.md)
- [salesdrone-release](../salesdrone-release/SKILL.md)
- [salesdrone-api-integrations](../salesdrone-api-integrations/SKILL.md)

Read for detailed behavior:

- [docs/observability.md](../../docs/observability.md)

Send outbox and deployment envelopes using application/cloudevent+json, not ordinary JSON. Keep source and data event.provider identical to avoid conflicting provider normalization; preserve IDs on retries and never replay delivered legacy events merely to rename fields. deliveryFormat=cloudevent-v1 distinguishes corrected delivery receipts. salesdrone.bizevents.delivery counts finalized attempts by bounded outcome/status class, not unique business conversions. scripts/inspect-bizevents.mjs projects queue metadata only and requires existing operator IAM; tenant search needs separate query access. Test the independent collector header, deployment notifier, stale leases and safe metric dimensions.

SettingsAuditTransaction snapshots tracked writes and emits durable per-control metadata independently of OTel availability. queueSettingsAudits shares the domain transaction; never enqueue from client intent or outside commit. Audit change events use settings.audit.committed, bounded 40-key chunks, hashed actor/target/custom IDs and no values. Accepted delivery emits allowlisted settings.audit.delivered OTel logs; logs have normal bounded buffering while the canonical event remains durable. Do not treat collection summary events, chunks and logs as independent saves. Test settings-audit.test.js plus real emulator rollback/persistence. Use verify-settings-audit.mjs only as labelled synthetic transport proof, not a real customer setting change or tenant-search proof.

Font preference changes add fontStyle to normalized personal defaults and appearance audit definitions. Canonical settings.audit.committed carries changed key names only; no font choice value, preview text or comments may enter telemetry. Reuse committed outbox delivery and safe request OTel signals. Test no-op/default normalization, invalid/PAT/unapproved denials, persistence and rollback through font-style.test.js plus emulator integration.

## v1.8 operating notes

Desktop displayScale changes export only the changed key in personal appearance settings audits. Preserve atomic audit/outbox, no-op/denial suppression and existing safe request traces/metrics/logs. Do not emit cosmetic navigation events or values. Verify deployment receipts separately from tenant visibility.

## v1.9 operating notes

Attachment metadata joins observableStore as the low-cardinality leadAttachments domain. Committed events contain safe counts/actor/context only, never filenames, bytes, checksums or bucket paths. Bulk lead writes reuse atomic leads/journey/activity/recipient events. Firebase Storage network calls have named dependency spans (storage.upload/download/delete); no object attributes. Request methods include PUT. RUM uses fixed batch/attachment/content templates, never names. Cleanup emits removed/failed counts; delivery uses the existing committed outbox and deployment receipts remain separate from tenant searchability.
