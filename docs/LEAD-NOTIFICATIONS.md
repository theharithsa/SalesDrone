# Lead alerts and read states — 24 October 2026

New manual enquiries create an inbox alert for their owner. A changed lead assignment creates an alert for the new owner; assigning a lead to the same owner is a no-op and does not cancel tasks or generate another alert. Unassigned leads/imports do not broadcast to administrators or generate a mass push; assigning an imported lead generates its owner alert. Existing lead records are not backfilled with notifications.

The API transaction writes the lead, inbox item and push delivery together. Creation replays use the original idempotent response, so a replay cannot create another alert. Lead alerts do not create follow-up tasks. The inbox is available immediately; browser updates appear on navigation/refresh. The unread indicator refreshes on focus, foreground push and every minute while visible, checking up to 100 recent inbox records. It is an indicator, not a total unread count.

The existing once-per-minute `reminders` worker handles both due task reminders and immediate lead alerts using the same indexed delivery outbox. It rechecks current membership, access, assignment recipient/revision and archive state while claiming and immediately before every send. A transfer away and back cannot revive the old assignment alert. Old alerts are retained for history but hidden once ownership changes. No new index, schedule or Firestore migration is required.

Push uses enabled devices and existing notification permissions. Payloads include generic operational text, no lead name or contact details, and `/leads?lead=<id>` links that recheck access through the API. Task reminders retain their existing task links. Failed-device retries, successful-device suppression, stale-lease recovery, token invalidation and bounded attempts are shared with task delivery. Inbox read states are not overwritten by worker retries. Marking unread changes inbox state; it does not queue another push. Marking read also does not cancel a queued operational alert.

Push timing remains best effort: normally the next minute scan, with backlog, network, device and OS policies potentially delaying delivery. An external send cannot be atomic with a simultaneous reassignment; access is checked immediately beforehand and again when opening the lead. No exact-time or exactly-once push guarantee is claimed.

## API

OpenAPI 1.5.0 documents 36 operations. `PATCH /api/v1/notifications/{id}` takes `{ "read": true }` or `{ "read": false }`. The old empty-object request still means read. The server writes its own timestamp or null, rejects extra/untyped fields and enforces the recipient’s current access for both listing and updates. Existing reminder notifications without a kind continue to work. Notification responses optionally identify `task_reminder`, `lead_created` or `lead_assigned`; lead alerts have null taskId.

`PATCH /api/v1/leads/{id}/assignment` now explicitly validates expectedVersion and a nonempty assignee UID or null. Ownership revisions are server-maintained. All existing membership, capability, audit, App Check and no-store policies remain in force.

## Verification

- 55 tests pass: 50 API/domain and five TypeScript date/header/filter tests. New cases cover immediate owner-only alerts, replay, same-owner assignment, ownership cycles, unassignment, per-device retries, generic payload/deep links, read-state preservation, revocation/reassignment before send, explicit read/unread, legacy records and unauthorized access.
- Auth/Firestore emulator integration passes, including assignment to the second admin, per-recipient inbox visibility and persisted read/unread writes. No real FCM call is made in this integration test.
- Browser checks used synthetic local records. Both read-state directions were saved, reload retained the state, a new enquiry generated its alert, an assignment alert opened the correct lead, and the push destination URL opened the expected lead.
- The mobile inbox was inspected at 390px without horizontal overflow. Desktop and mobile screenshots are under `screenshots/lead-notifications/`. Physical-device delivery of this new event type has not been independently observed.
- TypeScript and the production build pass. Production release verification is read-only; no customer records or field settings are changed for testing.

## Production release

The API, `reminders` worker and Firebase Hosting deployment completed successfully. The live main asset and inbox module return HTTP 200, and the published contract is 1.5.0 with the NotificationPatch request schema. The authenticated production inbox displays the updated UI and a legacy reminder with its preserved Read state and Mark as unread control. This final production check was read-only and did not create new alerts or test pushes to a real device.
