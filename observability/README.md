# SalesDrone monitoring handoff

This pack contains source-owned queries, detection policies and an offline notebook. It does **not** install anything in Dynatrace. Tenant setup, notification destinations, thresholds, permissions and retention remain with the app owner. No additional app setting or API permission is introduced.

## Files and commands

- `detections.json`: five reviewable policies, units, groups, lookback windows, minimum volumes, evaluation/recovery and missing-data rules. This is an application policy contract, **not** a Settings API payload.
- `salesdrone-runtime.notebook.json`: versioned Document Store notebook envelope (`name`, `type`, `content`), generated from the DQL sources. For a UI content-only import, extract `content` with `jq '.content' observability/salesdrone-runtime.notebook.json > /tmp/salesdrone-notebook-content.json`. Retain the source envelope for review; import it as a new document, never overwrite another notebook's ID.
- `queries/`: production-only charts and lookback detector inputs. The notebook includes deployment markers beside runtime mean and estimated histogram p95, error rates, queue/outbox health, dependency timing, typed errors and native RUM request IDs.
- `npm run obs:build` regenerates the offline notebook. `npm run obs:check` rejects stale generated content. Neither contacts Dynatrace.
- `npm run obs:verify` executes only **read-only** `dtctl query` calls using the already selected context. Inspect the context first. Reports go under ignored `test-results/`; they retain query hashes/counts/status, not returned tenant records. Required warnings/errors fail validation; valid empty queries are `valid-no-data`, not proof of health. Optional bucket queries report setup/traffic requirements separately.
- `node scripts/verify-monitoring-inputs.mjs` deliberately sends a synthetic failure/recovery probe through the existing OTLP exporters. It reads the existing ingestion secret into memory, uses `salesdrone-validation` / `verification`, simulated Gemini responses, and in-memory health snapshots. No production database, real provider request, installed alert or notification is involved. Run against stamped source (`npm run build:metadata`) and record its exact commit/version/trace IDs. HTTP/SDK acceptance is separate from tenant searchability.

## Owner setup

1. Validate the pack against the intended tenant with the read-only verifier. Review data availability and proposed thresholds. Do not enable an alert from a query with missing input or warnings.
2. Import the notebook as a new document; keep its generated query text and explicit lookback windows together. Review rendering in the UI. These repository assets have no installed document ID and are not proof of a configured dashboard.
3. Create tenant anomaly detectors using the five policies below. `queries/*detector*`, rejected-outbox, export-failures, reminder-due-age and gemini-failure-rate return a **scalar lookback summary per group**. The generated notebook appends `eligible` and `breach` for inspection. They are not native anomaly-detector timeseries payloads: configure the tenant evaluator to evaluate the full lookback every 60 seconds, with the same volume/persistence/recovery semantics. If converting to per-minute timeseries, preserve the rolling window and volume calculation; do not substitute per-bin averages or sum percentages.
4. Select the notification destination yourself and test the tenant detection/recovery and routing separately. The repository has no recipient/channel IDs, alert installation script or automatic settings writes.
5. Keep the existing `avinyatech` namespace, `salesdrone-` services, `com.avinyatech.salesdrone*` provider, SalesDrone security context and bucket routing. This work does not change tenant IAM or the existing 3657-day retention.

## Initial detection policies

Evaluate each complete lookback once a minute. Three consecutive **eligible** breaches open; three consecutive eligible non-breaches recover. An absent/null/invalid or low-volume sample resets both streaks and retains an already open incident as **unknown**; it must never silently recover. These starting thresholds need owner review, not an assertion that they were statistically baselined.

| Policy | Input/window | Breach | Minimum volume | Group |
|---|---|---|---|---|
| HTTP server failures | 5xx / all completed attempts, 10 min | >5% | 20 requests per service/operation | service, operation |
| Rejected business-event outbox | max Rejected gauge, 5 min | >0 records | a reported gauge | service |
| Telemetry export failure | sum of delta failures, 5 min | >0 batches | a reported series | service, signal |
| Late pending reminders | max oldest due-work age, 5 min | >300 s | a reported gauge | service, reminders queue |
| Gemini failures | failed / all provider calls, 10 min | >20% | 10 calls per group | service, model, operation |

Groups exclude release version/instance so a rolling release does not reset the policy identity. A five-minute maximum deliberately retains a transient rejection/age breach until it leaves the lookback. A fully broken telemetry connection cannot report its own failure reliably: missing-data handling or an independent tenant availability monitor is still required. Do not infer healthy from absence of an export-failure series.

HTTP “server success” means **non-5xx**, including expected 4xx denials; it is not user-task success or authorization success. Count ingress and API separately, never sum them as unique user requests. `http-error-rate.dql` uses 5-minute display bins; detector inputs use the explicit 10-minute volume window. Rates are request-weighted, not averages of per-instance percentages. No requests/calls means unknown, not 100% success. Type counts in journey-errors are log-record counts and may include multiple records for one rejected request; use the request counter for rates.

## Histogram p95 and reminder semantics

`runtime-latency.dql` returns **mean seconds**. `http-latency-p95-buckets.dql` uses `percentile(salesdrone.http.duration_bucket,95)`: an interpolated estimate over exported explicit buckets, not an exact percentile or percentile of averages. Bucket precision is limited by the emitted boundaries. The request histogram covers completed server attempts, not only exported traces.

The app already exports **delta explicit histograms**, including sum/count/ordered finite boundaries/bucket counts, verified by an independent protobuf receiver. Dynatrace can retain only min/max/sum/count unless explicit bucket ingestion is enabled. The owner controls `builtin:histogram-metrics`; no tenant flag is changed here. See [OTLP metric configuration](https://docs.dynatrace.com/docs/ingest-from/opentelemetry/otlp-api/configure-otlp-metrics) and [histogram percentile semantics](https://docs.dynatrace.com/docs/analyze-explore-automate/metrics/histograms). Read-only verification on 6 November 2026 found the HTTP `_bucket` series with numeric p95 values in the existing tenant, without any settings change.

`worker-lag-p95-buckets.dql` is optional: it describes **processed job** lag and needs actual processed work. No processed jobs means no p95, not zero delay. Pending reminder alerts instead use the already exported `salesdrone.queue.oldest_due_age`, which stays zero for an observed empty queue and becomes absent/unknown on failed collection. Research backlog currently has no truthful original enqueue/due timestamp; do not fabricate research age.

## Controlled verification and data boundaries

`tests/observability-pack.test.ts` rehearses transient/sustained failures, volume boundaries, absent data and recovery against the versioned policies. The SDK/protobuf test verifies the actual HTTP and worker histogram export, delta temporality, units, bucket totals and privacy. The synthetic live probe demonstrates transport/searchability of failure/recovery inputs; it **does not** certify installed alerts, real Gemini availability, tenant notifications or customer transactions.

Use the exact probe trace IDs with `fetch spans` and `fetch logs` (`trace_id` on logs). Query the probe metrics with `service.name=="salesdrone-validation" and deployment.environment.name=="verification"`; never remove the production filter from operational charts to manufacture a passing detector. Record production query results, synthetic signal results and owner setup as separate evidence. Raw request bodies, contacts, notes, task titles, prompts and secrets remain excluded; Session Replay remains disabled.
