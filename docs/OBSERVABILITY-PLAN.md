# SalesDrone observability completion — 2.0.1

Scope: preserve the reviewed mobile UI and existing versioned HTTP contracts,
complete instrumentation/CI gaps, publish through a PR and verify via India CS
Dynatrace MCP. Deployment authorization was given in the current task; future
agents still require authorization for publication. Canonical agent instructions:
[observability module](../skills/salesdrone-observability/SKILL.md) and
[operations](../skills/salesdrone-observability/references/operations.md).

The complete dt-obs entrypoint, RUM, OTel, business-event, worked-example,
verification references and plan template were read before implementation. Current
Dynatrace authentication/OTLP documentation confirms Classic Api-Token plus binary
HTTP protobuf remains a supported path. No tenant/credentials/consent is copied
from the workshop example.

## Gap decisions and boundaries

| Area | Existing behavior | Completion |
| --- | --- | --- |
| RUM | Approved email for live members; anonymous guests; manual pages/API actions; Replay off | Random per-page fallback on storage denial; action closure survives property failure and double completion |
| API/dependencies | Real OTel context, safe route/actor, DB/Gemini/FCM/Storage boundaries | Preserve explicit SDK and normalization; avoid duplicate auto-instrumentation |
| Process health | Request/worker/result counters and duration | Memory bytes, CPU seconds, event-loop utilization, per-process resource ID |
| Export health | Bounded queues/flush timeout; failures swallowed | Bounded success/failure counters and safe platform diagnostics; explicit flush success/failure/timeout |
| Async outbox | Atomic commits, leases/retry/rejections, delivery logs/counter | Sample Pending/Sending/Rejected aggregate gauges and oldest due age before draining |
| Lifecycle | Per-domain committed write counts | Known task completion/cancellation/reopening/deletion and lead archive/suppression/assignment/stage transition counts without values |
| GitHub checks/tests | Verification runs and deployment receipts | Safe check/leaf-case artifact reporter; automation-confirmed workflow/check/testcase events; correlated reporting spans/logs and bounded metrics |
| Release | OIDC/WIF, indexes/rules/functions/Hosting/Pages, postchecks, OTLP probes | Mandatory PR before merge; trusted-main reporting job observes failed/skipped jobs without PR secrets |
| Agent skill | Existing module entrypoint | Maintained repository-specific operations/query/recovery instructions; no duplicate skill |
| Tenant evidence | Prior ingest receipts; query access previously unavailable | MCP connection verified; baseline SalesDrone 2.0.0 logs found. Exact 2.0.1 signals must be queried after deployment |

No new domain API, browser OTel gateway, anonymous server identity, tenant capture
policy, host monitoring agent or IAM scope is necessary for these gaps. Such
systems would add unsupported trust/cost assumptions. Standard RUM-to-API context
is preserved where the installed agent emits it; native session navigation must
be validated separately, not fabricated by filling trace ID fields.

## Coverage and privacy

Lead/contact/import/activity/stage/assignment writes, task completion/cancellation,
soft deletion, membership/token/settings administration and worker recovery reuse
the actual domain transaction/outbox. Failed/replayed transactions cannot create
another committed outcome. Completion and reversal fields are numerical metadata
on existing events; they are not new independent totals to add to records.written.
No contacts, comments, titles, prompts, tokens or field values leave the backend.

CI events are automation-confirmed observations of real check/test execution.
Case identity is a digest of repository file plus test name; names/failure output
are excluded. Check/file names come from fixed local execution plans. Labels on
metrics are bounded check/outcome/kind or signal/state/memory-kind/CPU-mode only;
run/commit/case IDs remain resource/log/span/event context, never metric labels.
Reports preserve passed/failed/skipped/not-run; browser and physical/manual cases
stay separate. Per-case processing traces do not pretend to be test-execution spans.

## Verification stages

Local tests decode actual OTLP protobuf and inspect privacy, units, delta counters,
trace/log context, failure isolation, event IDs, rollback and leases. New tests
exercise bounded exporter callbacks/flushes and CI failure/retry/privacy behavior.
The release runs full verification and emulator gates once for the integrated
backend/instrumentation change, rather than repeating them for each CSS refinement.

Publishing must refresh changed synthetic screenshots, pass PR checks and merge
normally. Record merge/run/version metadata, individual transport receipts and
MCP projections for release/CI/domain events, logs, traces and metric samples.
Only actual evidence can mark a stage passed. Tenant query results, absent
records, query/storage constraints and RUM linkage limitations belong in the final
release evidence. No current entry claims 2.0.1 deployed or tenant-verified yet.
