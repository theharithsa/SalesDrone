# Operational reference

Use the current source and [shared contract](../../SHARED.md) when applying these module-specific recipes. Release dates, prior approvals and screenshot versions are historical evidence in [CHANGELOG](../../../CHANGELOG.md) and [release plans](../../../releases/); they never authorize a new deployment.

## Display scaling

Desktop displayScale changes export only the changed key in personal appearance settings audits. Preserve atomic audit/outbox, no-op/denial suppression and existing safe request traces/metrics/logs. Do not emit cosmetic navigation events or values. Verify deployment receipts separately from tenant visibility.

## Attachment transport and privacy

Attachment metadata joins observableStore as the low-cardinality leadAttachments domain. Committed events contain safe counts/actor/context only, never filenames, bytes, checksums or bucket paths. Bulk lead writes reuse atomic leads/journey/activity/recipient events. Firebase Storage network calls have named dependency spans (storage.upload/download/delete); no object attributes. Request methods include PUT. RUM uses fixed batch/attachment/content templates, never names. Cleanup emits removed/failed counts; delivery uses the existing committed outbox and deployment receipts remain separate from tenant searchability.

## Observability agent workflow

This is the canonical repository skill for the Observability agent; do not create
an overlapping second owner. For an instrumentation-to-release task, follow the
[operations runbook](operations.md) for gap analysis, CI/test metadata,
PR-first deployment, safe MCP queries and recovery. The portable `dt-obs` skill is
an additional reference when installed, not a production dependency.

Current release additions: independent exporter/flush diagnostics, process
memory/CPU/event-loop metrics, sampled outbox backlog/due age, numeric known
lifecycle transition counts inside existing committed events, and trusted-main
workflow/check/testcase reporting. PR runs retain safe artifacts without secrets.
Never classify manual catalog cases as executed. CI spans describe report
processing; source/delivery/app traces remain distinct.

Entry points: `telemetry-health.js`, `ci-checks.mjs`, `ci-test-reporter.mjs`,
`ci-events.mjs`, `notify-ci.mjs` and the workflow's `observe` job. Tests include
`functions/test/telemetry-health.test.js`, the independent OTLP receiver,
`tests/ci-events.test.ts` and RUM lifecycle tests. The RUM helper closes actions
once even when attributes fail, and uses a random page fallback when storage fails.
The [gap plan](../../../docs/OBSERVABILITY-PLAN.md) and per-release query evidence
separate implementation, local test, deploy, ingest and tenant visibility.

## Archive browser

Read-only GET /archived-leads uses existing normalized HTTP metrics/logs/traces; no customer contents or canonical read event. The archive timestamp write reuses the existing committed lead lifecycle counter and task cancellation events, without duplicate outcome events. No new tenant configuration is required; local tests are not production tenant evidence.

## Lead-data reset

leadDataResets joins the observable-store domain catalog. Numeric records.reset_started, reset_completed and reset_blocked reflect observed job transitions atomically with job state. Deletion batches reuse safe committed domain counts, HTTP RED/log/spans and Storage/Firestore dependency spans; no customer data or object paths exported. Retain audit/outbox during reset. Local/emulator proofs do not certify production tenant events.

## Collaborative imports

Reviewed imports reuse committed domain outboxes with safe import_created/import_updated/import_unchanged/import_skipped and preparing/completed/blocked/details_deleted counters. Source comparisons stay private application data; never emit filenames, candidate names, contact values or comments. RUM names fixed plan/review/rows/report segments and redacts IDs/query values. HTTP/CI instrumentation remains existing; tenant verification is a separate post-deploy gate.

## API and deployment hardening

Deployment reporting now computes outcome from seven required phases through deployment-outcome.mjs; missing/index/Storage failures cannot report succeeded. Event schema and classic marker transport stay unchanged (#71 remains separate). Application-owned parser failures return bounded codes/messages while HTTP spans/metrics record actual 400/413 statuses. Outer Functions Framework parse failures can bypass Express instrumentation and remain tracked in #30. Duplicate conflicts emit no inaccessible IDs; successful token uploads reuse existing committed attachment lifecycle events.

