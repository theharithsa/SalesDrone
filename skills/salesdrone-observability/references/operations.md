# SalesDrone observability agent operations

Use for instrumentation, release correlation and tenant validation. Read
`docs/observability.md`, `docs/BUSINESS-EVENTS.md`, `docs/OBSERVABILITY-PLAN.md`
and `docs/RELEASE.md` from the repository root before changing behavior.

## Scope and identity

Production is Firebase `sales-drone-avinya`, Functions codebase `salesdrone`, region
`asia-south1`. The API and four scheduled exports share one instrumented codebase.
Native app telemetry uses `service.namespace=avinyatech`, `service.version`,
`build.commit`, `deployment.environment.name` and a per-warm-process random
`service.instance.id`. Do not confuse Functions exports with internal dependency
spans or runtime/process measurements with host monitoring.

Ingest origin is `https://indiacs.live.dynatrace.com`. The India CS MCP resolves to
environment `bos01241` / `https://indiacs.apps.dynatrace.com`; verify its environment
before querying. Ingest uses the existing Classic `DYNATRACE_API_TOKEN` secret and
Api-Token realm. Query access is separate. Never print or persist a credential.
No skill authorizes IAM/token-scope/tenant-setting changes or customer writes.

## Before a release

1. Check the current branch/diff, domain and release skills. Preserve unfinished UI
   work and user-imposed version constraints. All main changes go through a PR.
2. Trace one actual operation through RUM/manual API action, normalized server route,
   Firestore SDK transaction, outbox, worker and delivery. Incoming context grants no
   authorization. Keep UID/email privacy policy and deny-all client rules.
3. Extend explicit SDK instrumentation rather than adding a second global SDK.
   RUM automatic actions stay disabled, Replay stays disabled. Pair action closure
   even if property recording fails. Guest browser IDs survive blocked storage only
   for that page; they are not hardware fingerprints.
4. Use independent protobuf decoding, concurrent identity/rollback/outbox tests and
   the actual Auth/Firestore/Storage emulator for backend changes. Use real CI
   reporter output for test-case events; never synthesize a pass from a case catalog.
5. Update module skill, event/metric/privacy contracts, version impact plan and fresh
   changed-screen captures. Create/attach a PR, wait for checks, then merge it.

## CI and test events

`ci-checks.mjs` runs bounded commands, stops after failure, records later checks as
not-run, and saves `ci-checks.json` plus `cases-*.ndjson`. The second Node reporter
hashes test identity and exports only file, status, measured duration and completion
time. Error/output/test-name text is excluded. The repository catalog includes
manual cases; these are never reported passed by a CLI run.

PR verification has no Dynatrace or production credentials. Only the trusted main
`observe` job receives ingestion credentials. It downloads safe result artifacts,
then `notify-ci.mjs` emits workflow/check/testcase CloudEvents and real SDK traces,
logs and bounded result/duration metrics. These are automation-confirmed, not domain
commits. Reporting spans describe report processing, not a fabricated trace running
through the original test process. Per-case event occurrence time is the actual
reporter completion time; duration is the measured test duration.

Event IDs bind commit/run/execution attempt/check/case. Consumers deduplicate IDs.
On a reporting-only rerun preserve the originating verification attempt; the
workflow outcome belongs to the current attempt. Artifacts retain recovery evidence
for 30 days. Retry only reporting after a reporting failure, not a successful deploy.
A 400/401/403 needs diagnosis, not credential switching or a retry loop.

## Post-deployment verification

Keep evidence under ignored `test-results/` and safe Actions artifacts. Record:
- exact version, merge SHA, PR URL, workflow run and all job conclusions;
- five ACTIVE function revisions, live version/contract/protected-route checks;
- separate OTLP traces/logs/metrics status and rejected counts, CloudEvent 202 and
  deployment marker result; preserve event and request/trace IDs;
- exact MCP query/time window and bounded projections for each signal;
- whether real RUM-to-backend navigation was performed (custom trace strings do
  not establish native linkage).

Use MCP `get_environment_info`, then generate/verify DQL and execute projected
queries. Filter release version/commit/run and short time windows. Discover metric
keys before timeseries aggregation. Metrics can retain the Classic route; if absent
in Grail, inspect the existing metrics API with authorized read access and record
which store was verified. Never broaden scopes or change pipelines to make a
verification report green. Avoid customer names, titles, emails or raw content.

Canonical domain events have server-confirmed authority, stable event IDs and
transaction IDs. `records.*` fields count committed writes/transitions, not revenue,
unique leads or sums across domains. CI and deployment events are separate
automation providers. Source operation traceparent and delivery-span context are
distinct. Missing spans can reflect sampling; a string join is not native linking.

## Recovery and operational limits

Runtime memory/CPU/event-loop gauges describe the function process, not the VM.
Exporter success means SDK completion; independent deployment receipts validate
partial acceptance, and tenant queries validate visibility. `telemetry.flush.*`
platform logs and bounded export counters expose callback failure/timeouts without
exporter error text. A failed exporter must not mask customer outcomes.

The export worker samples exact aggregate Pending/Sending/Rejected counts and the
oldest due work at drain start. These are sampled, nontransactional health views;
no customer documents are exported. `node scripts/inspect-bizevents.mjs` is a
read-only operator projection. Retain rejected/pending records. Fix the root
configuration, then reset only authorized rejected records to Pending preserving
event IDs. Never replay delivered events to restamp their provider/version.

No continuous shipping of local test output, new anonymous telemetry gateway,
OneAgent/host agent, tenant SLO/alert policy or IAM privilege is implied by this
workflow. Add such systems only for a concrete supported requirement and the
appropriate authorization. All-signal validation is bounded by available query,
RUM/session and tenant configuration evidence, not asserted from successful HTTP.

Keep operational ingress health on the shared non-reserved path, with its own bounded route label. A provider HTML/status failure is failed readiness, never an ingest or app success. Preserve partial deployment history when the forward patch completes rollout.
