# Settings audit trail

Saved live changes are recorded atomically with the setting in the existing server-only `auditEvents` collection. The audit contains the verified actor UID, action, request ID, timestamp and `settingsChanges` (section, changed control keys, internal target ID and create/update/delete category). It contains no before/after values. Existing generic request audit entries remain for successful saves with no net setting change; those do not emit a settings-change event.

## Coverage

| Setting family | Changed controls tracked |
| --- | --- |
| Appearance & time | appearance, bookMode, timezone, including the quick theme switch |
| Automatic reminders | automaticReminders, reminderTime, nextWeekRule, moveWeekends |
| Reports & lead access | exportsEnabled, assignedOnly |
| Dashboard insights | instructions and insightMode; never instruction text |
| Lead scoring | enabled and each factor's label/group/weight/description/enabled metadata keys |
| Manage fields | Each built-in label and dropdown choice list, field visibility, custom-field properties |
| People & permissions | Active status, role, scope, capabilities; invitations and acceptance/revocation |
| Developer tokens | Name/scopes/expiry/active/revokedAt keys; never token values, hashes or names |
| Notification devices | Enabled status, token and label keys; never FCM tokens or device labels |

Custom-field/factor IDs are hashed in changed-key names; exported target and actor identities are hashed. The local audit keeps the internal target ID for authorized operators. For collection edits, keys identify changed properties without exporting labels, options, weights, descriptions or other values. Snapshots are taken before the first tracked write, and multiple writes to one record produce its final net difference.

Read-only Google profile fields, About/version labels, browser/OS permission prompts and device-resolved System theme are not saved application configuration changes. Send test is an action with existing request/audit/delivery telemetry, not a fabricated configuration change. Sidebar width/collapse and guest/demo preferences remain local; demo interactions never create live audit events. Infrastructure/secret/tenant configuration is managed outside app Settings and needs the respective provider's audit trail. Automatic worker device invalidation retains existing device-domain telemetry; the control-level audit described here covers authenticated configuration mutations.

## Dynatrace delivery

Each changed section is enqueued in the same Firestore transaction as `com.avinyatech.salesdrone.settings.audit.committed`, provider `com.avinyatech.salesdrone.backend`, authority `server-confirmed`. This queue is written even if OTel is temporarily unavailable. Rollback/failed validation/denied authorization cannot leave a success audit or event behind. Replayed idempotent operations do not duplicate changes.

Events include audit.id, a logical audit transaction.id, hashed actor/subject IDs, request/operation IDs, section, changed key names/count, mutation category, version/commit and genuine trace context when available. Large edits are split into chunks of at most 40 keys with stable event IDs and chunk metadata; the full key list remains in the local audit. Sum changed_count only after deduplicating event.id; count distinct audit.id to count saved audit operations. A section/chunk event is not a separate user save or sale.

The existing leased exporter sends CloudEvents and marks delivery only on HTTP 202. It then emits the allowlisted OTel log `settings.audit.delivered`, containing audit/event IDs, hashed actor, section, changed count and HTTP status. The log confirms accepted delivery, not a second setting change. `telemetry.delivery`, `telemetry.deliver` spans and the bounded `salesdrone.bizevents.delivery` counter retain retry/rejection diagnostics. Outbox retries never roll back the saved setting. Logs themselves have the existing bounded OTel buffering, not a separate durable log queue; the canonical audit event is the durable evidence.

No setting values, AI instructions, custom labels/options, invitation email, credential, FCM token, lead/comment content or task title is deliberately exported. Historical audits are not backfilled or invented. Retention of Firestore audit/outbox records and Dynatrace data are separate operator responsibilities; this change adds no destructive TTL or automatic purge.

## Query and operations

DQL template, requiring authorized tenant query access:

```dql
fetch bizevents, from:now()-24h
| filter event.provider == "com.avinyatech.salesdrone.backend"
  and event.type == "com.avinyatech.salesdrone.settings.audit.committed"
  and event.authority == "server-confirmed"
| dedup event.id
| fields timestamp, audit.id, event.id, settings.section, settings.changed_keys,
  settings.changed_count, actor.id, app.version
| sort timestamp desc
| limit 100
```

For OTel logs, filter service.name=`salesdrone-telemetry` and body/content=`settings.audit.delivered`; actual stored log field mapping should be checked in your tenant. Query access and native cross-signal linkage are not established by HTTP receipts.

`node scripts/inspect-bizevents.mjs` reads aggregate/projected outbox receipts through existing operator IAM. `node scripts/verify-settings-audit.mjs` sends a labelled synthetic probe using the actual audit producer and exporter with an in-memory queue. It modifies no production setting/audit record; provider `com.avinyatech.salesdrone.validation` and authority `synthetic-verification` exclude it from the production query above.

No audit viewer, audit REST endpoint or PAT audit scope is added. Application Firestore client rules remain deny-all; only authorized server/operator access can inspect stored audits. Existing Google/App Check, self-owned preferences, Admin configuration and version/idempotency checks remain authoritative.

## Verification

`functions/test/settings-audit.test.js` covers personal/default/no-op/invalid/denied changes, all editable families, invitation acceptance, replay safety, secret exclusion, CloudEvents delivery, OTel log metadata, rollback and bounded custom-field chunks. The real Auth/Firestore emulator verifies durable settingsChanges and the matching outbox record. A synthetic live probe verifies transport acceptance without customer edits; tenant-search verification is a separate stage.
