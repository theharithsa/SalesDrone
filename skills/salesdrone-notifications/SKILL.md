---
name: salesdrone-notifications
description: "Maintain SalesDrone owner-only inbox, read/unread state, lead-assignment alerts, FCM registration and notification overlay. Use for push/inbox/overlay bugs; task scheduling belongs to tasks-reminders."
---

# Notification service

Read [the shared operating contract](../SHARED.md) before editing. Paths and commands
are relative to the repository root. Inspect current source rather than assuming
this map is an immutable schema or a standalone microservice.

## Responsibility and entry points

Domain write → recipient inbox/outbox → reminders dispatch → FCM data message → foreground/background service-worker handling → overlay/deep link → read-state patch.

- [functions/src/notifications.js](../../functions/src/notifications.js)
- [functions/src/reminders.js](../../functions/src/reminders.js)
- [functions/src/app.js](../../functions/src/app.js)
- [apps/web/src/lib/api.ts](../../apps/web/src/lib/api.ts)
- [apps/web/public/firebase-messaging-sw.js](../../apps/web/public/firebase-messaging-sw.js)
- [apps/web/src/components/NotificationOverlay.tsx](../../apps/web/src/components/NotificationOverlay.tsx)
- [apps/web/src/features/NotificationsPage.tsx](../../apps/web/src/features/NotificationsPage.tsx)

## Primary API ownership

- GET /api/v1/email/settings
- PATCH /api/v1/email/settings
- GET /api/v1/email/preferences
- PATCH /api/v1/email/preferences
- POST /api/v1/email/preview
- GET /api/v1/email/deliveries
- POST /api/v1/email/test
- POST /api/v1/email/receipts/resend
- GET /api/v1/email/beta/settings
- PATCH /api/v1/email/beta/settings
- GET /api/v1/email/threads
- POST /api/v1/email/threads
- GET /api/v1/email/threads/{id}
- GET /api/v1/email/threads/{id}/match
- POST /api/v1/email/threads/{id}/replies
- PATCH /api/v1/email/threads/{id}/read
- PATCH /api/v1/email/threads/{id}/lead
- DELETE /api/v1/email/threads/{id}
- POST /api/v1/email/beta/receipts/resend
- GET /api/v1/notifications
- PATCH /api/v1/notifications/{id}
- GET /api/v1/devices
- POST /api/v1/devices
- DELETE /api/v1/devices/{id}
- POST /api/v1/devices/{id}/test

Read the exact request/response/error schemas in [OpenAPI](../../docs/openapi.json)
and the route handler in [app.js](../../functions/src/app.js) when changing an API.

## Data and invariants

users/{uid}/notifications and devices; reminderDeliveries and deviceDeliveries; current membership, lead assignment revision and task version.

- Lead creation/assignment writes inbox and push job atomically, targeting the assigned person. Unchanged assignment must not enqueue a new alert.
- Reassignment away and back does not revive old alerts: compare assignmentRevision, not only owner UID. Recheck access on reads and immediately before sends.
- Read/unread updates are explicit and private; delivery retries preserve read state. Lock-screen text stays generic and contains no customer details.
- Request browser permission in an intentional user action; VAPID public key is not a private server credential. Device tokens are private. Unregister/sign-out must not leave another user’s device active.
- Bell opens a focus-managed overlay without navigation. Preserve Escape/outside click, trigger-focus return and authorized deep links. Keep legacy notification URL support.

deliveryContext resolves the current effective member scope before old task/assignment deliveries are sent. Disabling cross-owner access must suppress stale deliveries even if membership.version did not change.

## Change and diagnosis

Test both foreground and background on a supported browser, permission denied, inactive device, failed-device retry, ownership transfer and unread state. API test acceptance alone is not proof that an OS notification appeared.

## Verification

- [functions/test/notifications.test.js](../../functions/test/notifications.test.js)
- [functions/test/app.test.js](../../functions/test/app.test.js)

Apply the shared verification matrix to the changed behavior; these are the
module-specific regression entry points, not a substitute for integration checks.

## Deployment and handoff

api + reminders for inbox/delivery rules; Hosting for overlay/service worker. Recheck service-worker updates and existing device compatibility.

Use [the release skill](../salesdrone-release/SKILL.md) for authorized publication.
Adjacent owners:

- [salesdrone-tasks-reminders](../salesdrone-tasks-reminders/SKILL.md)
- [salesdrone-leads](../salesdrone-leads/SKILL.md)
- [salesdrone-authentication](../salesdrone-authentication/SKILL.md)
- [salesdrone-interface](../salesdrone-interface/SKILL.md)

Opening or reloading the overlay clears prior cached rows before fetching; generation guards prevent read/navigation completions from acting on a different open/account context. Preserve focus return to the bell and read/unread semantics; clearing UI cache must not modify server read state.

## Conditional reference

For detailed UI, recovery and integration recipes, read [operations](references/operations.md) when the affected behavior requires it. Follow current source and the shared contract when older examples differ.

## Known gaps

These are tracked follow-ups, not implemented behavior: [#25](https://github.com/theharithsa/SalesDrone/issues/25), [#39](https://github.com/theharithsa/SalesDrone/issues/39), [#40](https://github.com/theharithsa/SalesDrone/issues/40). Check their current status before changing the contract.

The inbox shows unread counts for the loaded rows only. Keep the overlay compact and retain independent pagination.

## Transactional email

Follow [the email runbook](../../docs/EMAIL.md) for transactional email and Email Beta. Beta stays off until isolated sending and receiving, scope, and erasure are verified. Pre-prod can share the transactional callback using address and tag checks. Use signed callbacks, current lead access, idempotent sends and bounded queues. Keep all correspondence and provider payloads out of telemetry. Verify scheduler authorization separately from delivery.

Email uses an Astryx layout, Open Sans, fixed first-party light and dark marks
and a text wordmark. Release mail waits for published notes and batches eligible members.
Pin template revisions and reply destinations to keep retries stable. Beta formats outgoing text and keeps quoted replies expandable.
