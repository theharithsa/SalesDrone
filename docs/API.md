# SalesDrone API integration guide

Application release **v1.1.1**, OpenAPI contract **1.9.0**. All application operations
use `/api/v1`; version numbers for the app and contract are independent.

- [Interactive Swagger portal](https://sales-drone-avinya.firebaseapp.com/api/docs)
- [Download OpenAPI 3.1 JSON](https://sales-drone-avinya.firebaseapp.com/openapi.json)
- [Public source contract](openapi.json)

The portal documents all **47 supported operations**, including GET (read), POST
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
