# SalesDrone API integration guide

Application release **v1.6.1**, OpenAPI contract **1.12.0**. All application operations
use `/api/v1`; version numbers for the app and contract are independent.

- [Interactive Swagger portal](https://sales-drone-avinya.firebaseapp.com/api/docs)
- [Download OpenAPI 3.1 JSON](https://sales-drone-avinya.firebaseapp.com/openapi.json)
- [Public source contract](openapi.json)

The portal documents all **49 supported operations**, including GET (read), POST
(create or an explicit action), PATCH (update) and DELETE (removal/revocation).
It does not advertise unsupported PUT or permanent lead erasure. Try it out performs
real operations against the signed-in credential's workspace. Use synthetic test
records for write experiments, and archive them afterward.

## Choose authentication

### Personal Access Tokens for integrations

An active administrator opens **Settings → Developer settings → Personal Access
Tokens**, chooses Generate token, supplies a name, selects explicit scopes and a
7-, 30- or 90-day lifetime, then copies the one-time result into a trusted secret
manager. Choose at least one scope. The form initially selects `leads:read`, but you can replace it with a tasks-only or other specific scope. Up to 20 unexpired
active tokens are allowed per admin. Expired entries are retired when issuing a new
token. The list is paginated and shows only metadata and a safe prefix.

```sh
# SALESDRONE_TOKEN is supplied by your secret manager, not committed source.
curl 'https://sales-drone-avinya.firebaseapp.com/api/v1/leads?limit=10' \
  -H "Authorization: Bearer $SALESDRONE_TOKEN"
```

Send the raw token only in `Authorization: Bearer …`, over HTTPS. Never put it in a
URL, spreadsheet, browser bundle, screenshot, log or Git repository. A valid PAT
does not need App Check: its independent credential verification replaces the
browser attestation requirement for the explicitly supported data operations.
Google browser authentication still requires App Check in production.

In Swagger, open **Authorize**, enter the raw value under `personalAccessToken`
without the `Bearer` prefix, and authorize only one identity method at a time.
The portal keeps authorization in tab memory, clears it on page exit, disables the
remote schema validator, loads its pinned Swagger assets locally and permits API
requests only to its own origin. It has no RUM or session replay script. Clear
Authorize when finished and close the tab on shared devices.

Only a SHA-256 hash of the high-entropy credential is stored. The full token is
returned once by POST and cannot be recovered from the list. Token creation is
intentionally **not idempotent**, rejects Idempotency-Key and never puts the raw
credential into the replay store. If the creation response is lost, refresh the
list, revoke the unknown token and create a replacement. Names are not unique IDs.

Each request verifies the token, expiry, enabled Firebase Auth account with a Google provider and active Admin membership, then checks the
operation scope and the owner's current capabilities and assigned/all-lead scope.
A token never broadens its owner's access. Business transactions recheck current
membership and token policy. Demotion, suspension, revocation and expiry stop later
authorization checks; already completed operations are not rolled back. A request
already doing external work cannot be retroactively unsent.

### Google browser sessions

Google-only operations require **both** `Authorization: Bearer <Firebase ID token>`
and `X-Firebase-AppCheck: <attestation>`. The web app supplies these automatically.
Swagger documents the two schemes for advanced authenticated use; Settings is the
normal interface for administration. Unapproved Google accounts cannot read live
records. Token issuance/list/revocation requires Google sign-in, App Check, an active
Admin role and members:write; credentials can manage only their owner's tokens.

PATs cannot bootstrap identity, accept invitations, manage people, edit workspace
settings, register/test devices, issue/revoke tokens, or invoke AI brief/score
refresh endpoints. These operations remain in the portal with their Google-only
security requirements. Existing automatic reminder behavior still applies to new
notes, including notes created through an integration.

## Token scopes

| Scope | Allowed operations |
|---|---|
| `leads:read` | List/get permitted leads; read stage journey |
| `leads:create` | Create enquiries, including their initial discussion fields |
| `leads:edit` | Update enquiry details and sales stage |
| `leads:archive` | Archive a lead; does not permanently delete history |
| `assignments:write` | Change lead assignment, subject to existing member policy |
| `activities:read` | Read a lead's comments/call timeline |
| `activities:write` | Append calls/notes and correct entries; notes may enqueue automatic reminder analysis |
| `tasks:read` | Read the owner's permitted reminders |
| `tasks:write` | Create/edit/delete personal reminders and edit automatic reminders |
| `imports:read` | Read owned import jobs and validation errors |
| `imports:write` | Preview and commit imports, including their new leads/comments |
| `scores:read` | Read reported lead scores |
| `dashboard:read` | Read the permitted dashboard and summary |
| `configuration:read` | Read lead fields/dropdowns and scoring configuration |
| `notifications:read` | Read the owner's notification inbox |
| `notifications:write` | Mark the owner's notifications read/unread |

A call that includes `stage` also requires `leads:edit`. A call with a manual
`followUp` also requires `tasks:write`. These compound scopes are enforced again
inside the write transaction. Lead edits, lead creation and imports can append
source discussion comments as part of their documented operation. Suppression or
archiving may cancel pending outreach for safety without a separate task grant.

## Create, read, update and remove

The full request/response schemas are in Swagger; these are minimal examples.
Replace example IDs, dates and versions with the values returned by your API.
Only send write requests with scopes you intended to grant.

```sh
# CREATE: enquiryDate and name are required for an ordinary new enquiry.
curl -X POST 'https://sales-drone-avinya.firebaseapp.com/api/v1/leads' \
  -H "Authorization: Bearer $SALESDRONE_TOKEN" \
  -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $REQUEST_UUID" \
  --data '{"name":"Synthetic API enquiry","enquiryDate":"2026-10-25"}'

# READ: use the returned id; list responses have items and nextCursor.
curl "https://sales-drone-avinya.firebaseapp.com/api/v1/leads/$LEAD_ID" \
  -H "Authorization: Bearer $SALESDRONE_TOKEN"

# UPDATE: read the latest record first; expectedVersion prevents lost updates.
curl -X PATCH "https://sales-drone-avinya.firebaseapp.com/api/v1/leads/$LEAD_ID" \
  -H "Authorization: Bearer $SALESDRONE_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"expectedVersion":1,"stage":"Working"}'

# REMOVE A LEAD FROM ACTIVE WORK: archive, preserving its history.
curl -X POST "https://sales-drone-avinya.firebaseapp.com/api/v1/leads/$LEAD_ID/archive" \
  -H "Authorization: Bearer $SALESDRONE_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"expectedVersion":2}'

# DELETE A TASK: supply its current version; deletion is soft and stops delivery.
curl -X DELETE "https://sales-drone-avinya.firebaseapp.com/api/v1/tasks/$TASK_ID" \
  -H "Authorization: Bearer $SALESDRONE_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"expectedVersion":1}'
```

Calls/notes use `POST /leads/{id}/activities`; corrections preserve revisions rather
than overwriting history. Tasks use GET/POST/PATCH/DELETE. Imports use preview, owned
job/error reads and resumable commit actions. People, invitations, settings, devices,
intelligence and token administration are all documented in the same contract.
Successful operations use HTTP 200, with JSON bodies; check the operation schema.

## Pagination, concurrency and errors

Use `limit` 1–100 (default 30), then URL-encode `nextCursor` and send the same filters
until the cursor is null. A bounded column-filter scan may return an empty page
with a non-null cursor. Cursors are signed and bound to member version and filters.
Do not parse or manufacture them. Lead search, stage/source filters and combined
column filters are described in the list operation.

For endpoints that require `Idempotency-Key`, generate a UUID once per logical
request; retry an uncertain response with exactly the same key and body. A changed
body with the same key is a 409 conflict. Authorization is rechecked on replay.
For versioned edits/deletion, use the latest `expectedVersion`; a 409 stale response
means fetch and resolve the conflict, not overwrite blindly.

PAT requests are limited to 120/minute per token and 300/minute per owner across
tokens, plus the existing 180/minute mutation budget and AI/domain limits. A 429
includes `Retry-After: 60`. Back off instead of retrying in a tight loop. Last-used
metadata updates at most once per minute. Audit records distinguish Google and PAT
writes using a token's opaque ID, never its secret. Telemetry exports bounded domain
counts, not credentials, token names, customer data or response bodies.

Errors use `{ "error": { "code", "message", "requestId" } }` (optional details).
401 means missing/invalid/expired/revoked credentials or an inactive/non-Admin owner;
403 means insufficient scope/current capability or Google-only operation; 404 also
hides out-of-scope records; 409 covers stale versions/conflicts; 429 is rate limiting.
Use `X-Request-Id` for support, and `X-App-Version` for deployed app identification.
Server error text is intentionally generic. Do not log Authorization or full bodies.

## Rotation and revocation

Create a replacement with the smallest necessary scopes, update the integration's
secret manager, verify a read request, then revoke the old token in Settings. Tokens
are immutable: changing scopes or expiry requires a replacement. Revocation is
irreversible; if a credential is exposed, revoke it immediately and issue another.
Do not submit tokens to public GitHub issues. See [SECURITY.md](../SECURITY.md).

## Workspace personalization

GET and PATCH `/api/v1/ai-settings` are Admin-only Google/App Check operations, not PAT operations. The response includes `version`, `instructions`, `defaultInstructions` and `usingDefault`. PATCH accepts `{ "expectedVersion": 1, "instructions": "Focus on overdue callbacks; use concise bullets." }`; an empty instruction string restores default guidance. Unknown fields/oversized input return 400, insufficient access returns 403, and stale versions return 409. Settings changes invalidate cached AI insights, but do not trigger generation.

`GET /api/v1/field-options` includes `labels`, keyed by stable built-in field ID. Admin PATCH may include a partial `labels` object, for example `{ "name": "Project contact", "zone": "Industry" }`, along with the existing `expectedVersion` and `values` payload. Missing labels retain their current names. Unknown IDs, blank/oversized labels and normalized duplicate built-in/custom names are rejected. Labels do not rename API payload keys, change types or migrate lead records.

## Filtered reports and workspace controls

POST /api/v1/leads/export returns paged projected report data (not a binary file). Google/App Check members need leads:read; PATs require the separate leads:export scope. The workspace must enable exports. The strict body supports columns, filters, stage, source, search, field, cursor and limit (1–100). Follow nextCursor even on empty sparse pages. Cursors bind policy/config versions and column order. Rate: 120 pages/member/minute. Selected field values are never included in audit telemetry. See [Reports](REPORTS.md) for browser XLSX limits.

GET /api/v1/workspace-settings returns version, exportsEnabled and assignedOnly to active members (PAT configuration:read). PATCH requires Admin role, members:write, Google/App Check and expectedVersion; PAT writes are denied. assignedOnly defaults true and caps non-admin scope across all surfaces. exportsEnabled defaults true. Individual assigned scope is preserved when the workspace cap is disabled.

The v1.6.1 lead blade layout reuses existing stage/assignment/journey operations and permissions. Resizing is a local presentation preference, not a new API or workspace grant. Stage updates need leads:edit; assignment writes retain assignments:write and expectedVersion.

The /leads/{id} browser route and Comments/Tasks/Review tabs are presentation surfaces. Existing scoped lead/activity/task endpoints remain authoritative; Review filters loaded analysis states. Lead Tasks pages GET /tasks?leadId=... with optional state, limit and cursor and never expands recipient-private access.

Inline comment entry uses the existing POST lead activities operation, including expectedVersion, activities:write and Idempotency-Key. Uncertain retries retain the same payload/version/key; editing text starts a new attempt. No permission or API contract expansion is introduced by the UI maintenance.

### Lead activity views

All, Comments and Calls are presentation filters over the same authorized, paginated GET `/api/v1/leads/{id}/activities` result. Comments selects note entries (including imported discussions), Calls selects call entries, and All preserves all types and review metadata in source order. The Tasks tab uses recipient-private GET `/api/v1/tasks?leadId=...`; the task list is not repeated in All, and grants no access to another member’s tasks. No new endpoint, scope or API contract version is introduced. Earlier activity remains necessary to inspect unloaded history.

## Preferences: Book mode (contract 1.13.0)

GET /api/v1/me returns preferences.bookMode (false for missing records). PATCH /api/v1/me accepts optional boolean bookMode together with the existing required timezone and appearance. Omitting bookMode preserves the stored value; false explicitly disables it. This additive field changes no role or capability. Only the verified active Google/App Check caller can update their own preferences; Personal Access Tokens cannot use this route, and uid/owner fields are rejected. No new endpoint, token scope or lead access is introduced. Book mode is independent from light/dark/system. Tests: book-mode.test.js and the real Auth/Firestore emulator scenario cover persistence, old-client omission, isolation, invalid payloads and denied access.

## Settings audit side effects

Saved net changes through existing configuration/preferences, member/invitation, token and device routes atomically attach settingsChanges metadata to the existing server audit and enqueue safe Dynatrace audit events. Invitation acceptance participates as well. These internal side effects change no request/response schema, role, PAT scope or API version. Failed/denied/no-op/replayed changes do not emit duplicate success changes. No audit-read endpoint is introduced; direct client Firestore access remains denied. See [coverage, data exclusions and delivery semantics](SETTINGS-AUDIT.md).

## Personal interface font (contract 1.14.0)

`GET /api/v1/me` returns `preferences.fontStyle`, default `standard`. `PATCH /api/v1/me` accepts optional `fontStyle`: `standard`, `inter`, `source-sans`, or `lora`, alongside the existing required `appearance` and `timezone`. Omission preserves the stored value; invalid/null values and arbitrary font URLs are rejected with 400.

Example body: `{"timezone":"Asia/Kolkata","appearance":"system","fontStyle":"inter"}`. This remains an active-member, self-service Google JWT + App Check operation. Unapproved identities and PAT writes are denied; no new token scope is added. Book mode is independent and does not overwrite fontStyle. Successful net changes commit an appearance audit with the changed key `fontStyle`; values are excluded from exported telemetry. See [font behavior](FONT-CHOICES.md).

## Personal display scale (introduced in contract 1.15.0)

GET /api/v1/me returns preferences.displayScale, defaulting to 100. PATCH /api/v1/me accepts optional numeric 85, 90, 100, 110 or 125 alongside the existing required timezone and appearance. Strings, arbitrary numbers and non-finite values are rejected. Omitting displayScale preserves the saved value. From app 2.0.1, the UI applies the saved percentage on phones, tablets and desktops while retaining usable touch targets. Older app versions restricted it to fine-pointer desktops. The preference schema, route and permissions have not changed. This is a personal setting, not a workspace policy. Google JWT plus App Check and current active membership are required; the caller can edit only their own preferences. PAT access remains denied with no new scope or endpoint. The committed appearance audit exports the changed key displayScale without the value. Tests: functions/test/display-scale.test.js and the real Auth/Firestore emulator preference scenario.

## Batch edits and private lead files (contract 1.16.0)

POST /api/v1/leads/batch/preview and POST /api/v1/leads/batch accept {items:[{id,expectedVersion}],changes:{...},assignedToUid?:string|null}. The selection is explicit, unique and limited to 25. Preview writes nothing. Apply requires a UUID Idempotency-Key and runs atomically with current membership, lead scope, expected versions, field definitions and target validation. One failure rejects the whole batch. Replays reauthorize every lead. Allowed changes: stage, source, company, jobTitle, location, zone, legacyStatus, tags and merged customFields. Identity/contact, conversation, suppression and repair fields are excluded. No-op leads retain versions. Assignment needs assignments:write, cancels pending tasks and queues new-owner notifications. PATs require the new leads:bulk-edit scope and additionally assignments:write when assigning.

POST /leads/{id}/attachments reserves metadata {name,size,contentType} with a UUID Idempotency-Key. PUT /leads/{id}/attachments/{attachmentId}/content sends raw application/octet-stream bytes; only the reserving user can complete it. GET /leads/{id}/attachments lists Ready metadata with limit/cursor. GET the content path returns forced binary download with no-store/nosniff, never a public redirect. DELETE /leads/{id}/attachments/{attachmentId} takes {expectedVersion}; it immediately hides access and schedules byte cleanup. Read needs leads:read; writes need leads:edit. PAT scopes are attachments:read and attachments:write, intersected with current owner capability/scope.

8 MiB per file, 50 active/pending per lead; one-hour reservation expiry. Filenames cannot contain paths/control characters; declared size, extension/type and byte signatures must agree. Uploads are immutable; identical byte retries succeed. Recheck authorization after Storage I/O, before Ready commit or binary response. Metadata list excludes objectPath/checksum. Removed files have no app restore endpoint; expired pending and deletion work retry through the existing worker. Errors include 400 invalid file/fields, 403 capability/token, 404 unavailable scope/resource, 409 stale/version/quota/expired upload, 413 oversized binary, 415 wrong transport type, 429 mutation rate and 503 storage unavailable. Tests: bulk-and-files.test.js and real Auth/Firestore/Storage integration. See [file architecture](ATTACHMENTS.md).

Batch resource budgets also cap aggregate cancellation at 200 pending tasks and serialized old/new/task data at 2 MiB. Exceeding either rejects the whole batch; select fewer leads.

## Archived lead collection (contract 1.17)

GET /api/v1/archived-leads returns a Lead page with limit (1–100, default 30) and signed cursor. Requires leads:read, current active membership and effective assigned/all scope; PAT uses the existing leads:read scope. No stage/search/filter parameters are accepted. ArchivedAt is optional for historical records. The active /leads collection still excludes archives.

### Admin lead-data reset

GET /lead-data-reset returns active/job status. POST /lead-data-reset/preview returns an owner-bound, ten-minute preview and approximate counts. POST /lead-data-reset requires previewId, confirmation=DELETE ALL LEADS and UUID Idempotency-Key. POST /lead-data-reset/{id}/resume requires expectedVersion and only accepts Blocked work. All are Google/App Check Admin-only with members:write; PAT denied. Accepted jobs are not cancellable; the worker waits five minutes then cleans bounded batches. Domain mutations return 503 LEAD_DATA_RESET while active. Old request results become expired tombstones and return 409 RESET_REQUEST_EXPIRED. See [scope and recovery](LEAD-DATA-MANAGEMENT.md).


### Field visibility (contract 1.18.0)

`PATCH /api/v1/field-options` accepts `hiddenFields` for standard field IDs except
`name` and `enquiryDate`, including `phone`, `email`, `countryCode`, `stage`,
`comments` and workflow/report labels. At most 25 entries are accepted; unknown
IDs and hiding both `phone` and `email` return 400. This replaces the visibility
list, so use `[]` to restore all fields. Admin Google/App Check and `members:write`
remain required; PAT writes remain denied. `expectedVersion` rejects stale saves.

Visibility removes controls from enquiry entry and available configurable columns,
filters and new reports where applicable. It does not erase lead values, alter API
lead fields, hide every record header, or disable workflow/suppression actions.
New enquiries with hidden `stage` still default to `New`. Hidden `countryCode`
uses the first configured code in the manual form; edits retain existing values.
Name/date and a phone or email remain required by the unchanged lead-save policy.
Settings changes retain the existing transactional key-only audit/outbox.

## Collaborative imports (2.3)

Contract 1.19.0 adds GET /imports; GET /imports/{id}/rows and /report; POST /imports/{id}/plan, /review and /refresh; PATCH /imports/{id}/rows/{index}; DELETE /imports/{id}. Preview opts into reviewed:true; reviewed commit requires expectedVersion. Optional imports:read/write/share never replace lead scope/create/edit checks. New routes require Google/App Check; PAT allowlists stay unchanged. Import mutations have independent 180/minute route-template buckets. See [Imports](IMPORTS.md) for schemas, cursor bounds, retention and recovery.

## API and deployment hardening (2.3.1)

Contract 1.19.1 uses strict ArchiveInput (positive integer expectedVersion, no unknown fields). Missing/invalid archive input returns 400 VALIDATION; stale valid versions remain 409. Malformed JSON returns BAD_JSON (400); endpoint body-size failures return PAYLOAD_TOO_LARGE (413). Messages never echo body contents. Lead-creation DUPLICATE errors omit IDs universally. Existing reviewed import matching remains authorized and detailed. Binary PUT accepts attachments:write PATs and still rechecks current token, membership and lead scope after storage writes.
