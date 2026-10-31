# Lead Hygiene and Lead Assistant — implementation contract

Enhancements [#95](https://github.com/theharithsa/SalesDrone/issues/95) and
[#96](https://github.com/theharithsa/SalesDrone/issues/96). Implementation contract; production availability and verification are recorded by the release workflow.

## Confirmed access model

Admins receive feature access by default. Members receive no implicit access from
Viewer/SDR roles, imports or ordinary lead editing. Admins may explicitly grant
`hygiene:read`, `hygiene:run`, `hygiene:ai` and `assistant:query`.
Every capability intersects `leads:read` and the effective assigned/all lead scope.
Running a scan also requires hygiene read access; AI summaries require hygiene
read and AI access. Assistant query access does not grant Hygiene access.

Browser Google identity and App Check remain required. PATs do not inherit these
features. Existing members must not require a migration to gain the Admin default;
non-admins must not gain it on upgrade. All grant changes use current member edit
optimistic versions and committed audit behavior.

Only server policy determines identity and scope. Reports/chats are private to the
creator by default, including between Admins. A report created with broader scope
cannot be reused after scope reduction; rerun under current access. A member
version or workspace access-policy change invalidates work in progress. Read each
page under current policy and recheck again before publication. Cached membership,
index ACLs and saved artifact ownership never override current lead access.

## Versioned API 1.22.0

These routes are implemented in the generated OpenAPI contract.
All lists use bounded signed cursors bound to owner, scope, policy version, filters
and operation. Replays require current authorization; mutations take an
Idempotency-Key and optimistic versions where they update an existing job.

| Method | Path under /api/v1 | Permission / behavior |
| --- | --- | --- |
| POST | /lead-hygiene/scans | hygiene:read + hygiene:run; enqueue scan |
| GET | /lead-hygiene/scans | hygiene:read; private paginated history |
| GET | /lead-hygiene/scans/{id} | hygiene:read; private job status and coverage |
| GET | /lead-hygiene/scans/{id}/findings | hygiene:read; paginated current-access evidence |
| POST | /lead-hygiene/scans/{id}/summary | hygiene:read + hygiene:ai; bounded verified facts |
| DELETE | /lead-hygiene/scans/{id} | Explicit owner/Admin deletion; current authorization required |
| POST | /lead-assistant/conversations | assistant:query; private conversation |
| GET | /lead-assistant/conversations | assistant:query; private paginated history |
| GET | /lead-assistant/conversations/{id}/messages | assistant:query; reauthorized private messages |
| POST | /lead-assistant/conversations/{id}/questions | assistant:query; bounded read-only request |
| GET | /lead-assistant/requests/{id} | assistant:query; private request status/result |
| DELETE | /lead-assistant/conversations/{id} | Explicit owner/Admin deletion; current authorization required |

Use fixed safe errors: FORBIDDEN, NOT_FOUND (including inaccessible artifacts),
STALE_ACCESS, STALE_VERSION, SETUP_REQUIRED, INVALID_QUERY, RATE_LIMITED,
PROVIDER_UNAVAILABLE and LEAD_DATA_RESET. No customer text in errors/telemetry.
Validate all request schemas strictly and reject arbitrary collection/query code.
Current auth must be rechecked during work and before returning sources/results.

## Hygiene behavior

Scan all accessible active records in bounded resumable pages. Include archived leads optionally, with separate counts and contact groups. Show progress, start/end, scanned count, configuration
and source versions, incomplete/stale states and limits. Never call a dashboard
sample or the first 1,000 rows a full scan. A scan across changing data is not a
point-in-time snapshot; show its observation window and detect source changes.

Shared phone/email groups identify actual accessible records and the matching
field. Use existing normalization. Name alone is not a duplicate. Shared contacts
may represent separate enquiries; unnamed records are explicit. Compare index
references against records before flagging stale/orphan dedupe entries. Do not
repair indexes automatically. Check missing/invalid minimum/required fields,
Needs review and retired choices. Findings link to the existing lead workflow.

Archive candidates require configured evidence, not age/score/shared contact or
Won alone. Check pending tasks without exposing another member's private tasks.
No automatic archive, merge, deletion, reassignment or outreach is permitted.
Optional AI summaries consume bounded deterministic findings, with citations;
provider failure leaves the scan intact.

## Assistant behavior

Allow only lead questions and insights. The model produces schema-validated
allowlisted intents, never executable database queries. Refuse general knowledge,
web lookup, secret/system disclosure, code execution and every mutation request.
Treat source notes and instructions embedded in them as untrusted evidence.

Counts, rates and dates come from exact deterministic complete-cohort analytics.
Vector top-k results cannot count conversions/failures. Return cohort/filter,
timezone, date interval, observed history coverage and limitations. Unknown
conversion dates cannot be replaced with lead creation or workbook import dates.

For qualitative questions, use a private incremental semantic/lexical index with
stable source IDs, revisions/fingerprints and deletion invalidation. Filter access
before retrieval, recheck sources and assignment before prompting and again before
publishing. Only bounded verified evidence goes to Gemini. No full-database prompt
on each question, no unnecessary contact embeddings, no index-as-authority.
Citations and numeric claims are server-validated. Sample themes are not full-cohort
prevalence or proven reasons for loss. Index lag and incomplete evidence are visible.

Answer states: Grounded, Partial, Clarify, Insufficient, OutOfScope, Unavailable.
Questions, prompts, messages and retrieved snippets are excluded from telemetry;
mask private UI and keep Session Replay disabled. Apply request/token/concurrency
budgets, bounded retries and explicit indexing progress/cost controls.

## Confirmed retention and analytics rules

Keep reports and private chat history until explicitly deleted. Members can delete
only their own chats; Admins can delete Hygiene reports. Source access and source
deletion still apply regardless of artifact retention. Reset removes derived data.

Admins configure converted/failed stage sets and inactivity threshold in Settings.
Unconfigured results show Setup required rather than guessing stage meanings.
Calendar-month windows use the configured reporting timezone, inclusive month start
and exclusive next-month start. Count each lead at most once in the requested month
when a recorded transition enters the converted group from outside that group.
Moves within the converted group do not add conversions. Creation/import timestamps
are not conversion dates. Missing history remains an explicit limitation.

Configured custom stage values must be used dynamically. Retired mappings/history
require explicit interpretation rather than silently remapping old transitions.

## Delivery and evidence

Register module skills before implementation. Extend reset cleanup/locks to derived
artifacts; stale workers must not resurrect deleted records. Preserve atomic audit
and safe committed lifecycle outboxes. No network calls inside transactions.

Test full pagination, per-feature grants, old Admin records, assigned scope,
revocation/reassignment during work, ownership/cursor tampering, reset, concurrent
source changes, provider faults, malicious notes and citation rejection. Use real
Auth/Firestore emulators for new adapter/query behavior. Review synthetic UI at
phone/tablet/desktop widths, both themes and keyboard focus. Update settings/API
guides, module skills, changelog and the minor-version release impact plan. Create
one linked PR, pass required CI, merge and deploy through the standard workflow.
Verify exact production version/SHA, docs, functions and signal receipts separately
from tenant-query visibility. Keep issues open until their acceptance criteria pass.

## Operational limits

Hygiene scans use 25-lead pages and five contact-index documents per diagnostic page. Actual contact groups cover every scanned lead; diagnostics examine up to 100 references per index entry and explicitly flag larger entries as requiring further verification. This is not an automatic index repair or proof that every reference in a large index entry is valid. Task changes invalidate archive-review reports independently from Assistant counts.

Scans are limited to five per member per hour, with one current scan at a time. Questions are limited to five per member per minute and one pending question per conversation. Indexing is opt-in and bounded by the shared worker budget. Long sources have a 12,000-byte context ceiling with bounded overlapping UTF-8 chunks; qualitative answers remain partial/sampled. Histories are private, not shared workspaces for chat. Direct out-of-band database changes require an Admin index rebuild.

Implementation uses the official [Gemini embedding model](https://ai.google.dev/gemini-api/docs/models/gemini-embedding-001) and [Firestore vector search](https://firebase.google.com/docs/firestore/vector-search) contracts. Embedding input is minimized and obvious contact tokens are masked; this is not a guarantee that arbitrary free text contains no personal data. No full customer workbook is uploaded by this feature.

## Composable Assistant extension (API 1.22.0)

The dedicated `/assistant` page uses a strict server-validated tool plan. Standard and
active custom fields support AND Equals/Contains/date-number Before/After filters;
unsupported meanings and rankings clarify. Active means unarchived across all stages.
Each proposed comparison value must be literal in the question or a valid prior plan.
Model inputs contain field metadata and bounded conversation context, not all lead rows.
Complete deterministic scans produce exact counts and bounded distributions (100 groups,
remaining groups explicitly combined); note insights use bounded RAG with current filters.

GET `/api/v1/lead-assistant/requests/{id}/leads` returns paginated compact results with
signed owner/request/scope/source-bound cursors (limit 1–100). Results remain private and
are reauthorized against current lead and task epochs. POST
`/api/v1/lead-assistant/requests/{id}/cancel` requires expectedVersion and a Pending owned
request; stale versions or completed requests return 409. Cancellation prevents later
publication; persisted artifacts remain until chat deletion. No PAT access is added.

Follow-up tools require tasks:read in addition to assistant:query, use only recipientUid
matching the caller, Pending outreach tasks, and current eligible accessible leads.
Weeks are Monday–Sunday in the saved reporting timezone. Multiple matching reminders
count a lead once; current task changes invalidate prior answers. Approval timing must
use an explicit recorded date; createdAt/updatedAt cannot substitute for approval dates.
