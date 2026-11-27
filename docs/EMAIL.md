# Transactional email

SalesDrone sends outbound email through Resend from
notifications@salesdrone.in. The workspace starts paused. Each member can opt
into lead updates, shared-task updates, and daily and weekly digests under
Settings → Personal → Email preferences. Admins manage workspace controls,
synthetic previews, test sends and delivery history under Settings → Workspace →
Email notifications.

All templates use the SalesDrone drone mark and Open Sans in the Astryx Neutral
layout. Supporting numbers and the next action are visible in the message.
Mail clients that block web fonts use the Astryx system font stack. The text
wordmark remains readable when images are blocked. Clients that support dark-mode CSS display a white drone mark. Other clients use
the blue mark on a light tile with contrast baked into the image. The marks and
font are fixed public Hosting assets with no recipient data, tracking parameters or new
Firestore reads. Template Preview loads them from the app inside its sandbox.

## Events and recipient rules

| Event | Recipient and condition |
| --- | --- |
| Invitation | Address on an active invitation. Admins can resend it from People & access. Acceptance completes the invitation. |
| Access approved | Verified Google account newly enabled by an Admin. |
| Lead assigned | The new assignee with access to the lead. |
| Lead converted or failed | The current assignee when a lead enters a stage configured under Lead research. An Admin can choose a member who can view unassigned leads to receive outcomes for those leads. |
| Task assigned or reassigned | The new responsible member, if a teammate assigned the shared lead task. |
| Task completed, rescheduled or reopened | The current responsible member when a teammate makes the corresponding change to a shared lead task. |
| Daily reminder | An opted-in member with shared lead tasks due that day or overdue. |
| Release announcement | Active workspace members with verified Google email, once per version after the app and public release notes are live. An Admin enables announcements in Workspace email. |
| Weekly recap | An opted-in member with recorded completions from the previous Monday through Sunday. |

Workbooks and history imports generate no email. Routine changes require the
recipient’s corresponding opt-in. Drafts and queued emails are bound to the
workspace control version. Editing those controls invalidates queued work from
the previous version. The worker rechecks source state, the recipient’s
verified account and current lead access before each send. The message links
to the appropriate environment and enforces access after sign-in. Templates
omit customer names, contact details, private reminders, task titles and
comments.

The day rolls over in the selected IANA time zone. The daily digest separates
overdue tasks from tasks still due that day. The weekly recap compares the
preceding two calendar weeks, counts distinct accessible leads, and includes
the next seven days of work. On-time counts require a recorded due time at each
completion. The date range in the weekly link opens that member’s authorized
completed lead tasks. No digest is generated for an empty period. A selected
local time missing or ambiguous during a clock change is skipped. Scheduler
runs more than 30 minutes late move on to the next scheduled period.

Members with AvinyaIntelligence access can opt into a model-selected takeaway.
The model receives the verified counts and dates and selects a supported fact
key. The server writes the final sentence and numbers. A factual summary
works when the feature is off, model output is invalid or the model budget is
exhausted. The worker reserves one model attempt per delivery.

## Pre-production setup and verification

Before the first email candidate deploys, use the index operator identity to
run node scripts/preprod-email-indexes.mjs and verify the three indexes in
the named preprod database are READY. Use --verify for subsequent checks.
The GitHub deployment identity does not need Firestore index administration.

1. Verify outbound authentication for salesdrone.in with the records assigned
   by Resend. DKIM and the provider return path are added at GoDaddy. Preserve
   the existing DMARC enforcement policy and Hosting records.
2. Use a sending-scoped key and signed webhook dedicated to SalesDrone. Register
   the pre-production callback /api/v1/email/receipts/resend for sent,
   delivered, delivery delayed, failed, bounced, complained and suppressed
   events. Where the provider offers workspace-wide callbacks, use a
   SalesDrone-only workspace or a callback scoped to this sender. Preserve the
   provider's original JSON and Svix headers.
3. Store PREPROD_RESEND_API_KEY and PREPROD_RESEND_WEBHOOK_SECRET in the project’s
   Secret Manager. Grant only the pre-production runtime access to those
   secrets. Set PREPROD_EMAIL_ENABLED=true in the GitHub pre-production
   environment and run the checked Deploy pre-production workflow. This adds
   the private preprodEmail function alongside the existing API. Each workflow
   run and retry uses a distinct build archive, including for the same commit.
   The pre-production build identity reads only the worker’s managed source
   archive. The deployment identity updates the named worker. Creation requires
   authentication and subsequent deployments preserve the scheduler's invocation
   grant. The workflow checks that unauthenticated requests receive 401 or 403.
   Confirm that a scheduled invocation can still process a synthetic send.
4. Use scripts/preprod-email-schedule.sh configure to associate the five-minute
   UTC job with the private function through its OIDC identity. No pre-production
   traffic reaches the production database, worker or secrets. The workflow
   deploys to the preprod database and pre-production Hosting site.
5. Open the Admin template preview and use Send test email. The default recipient
   is Resend’s delivery simulator. To check hard-bounce handling, select
   **Simulated bounce** in the pre-production preview. A separately authorized test inbox can be
   set as SDR_EMAIL_TEST_INBOX on the private worker for a real inbox check.
   Use the bounce scenario only with synthetic data. In app Delivery history,
   compare Accepted with Delivered from the signed callback. Verify the brand
   mark, type, compact layout and fallback when an inbox blocks assets. Recheck pause,
   opt-out, retries, revoked access and all template layouts on the exact
   deployed candidate. Record actual receipt and client rendering separately
   from the provider test.
6. If Gemini selection must run in the pilot, provide an isolated pre-production
   key as SDR_EMAIL_GEMINI_KEY on the private worker. Read the actual Gemini
   usage and billed provider totals before promotion. Ordinary delivery works
   with the factual summary if the key is absent.

## Release announcements

Enable **Email new releases to all active members** after the production
sender and pilot are verified. It starts off and the workspace email switch
also applies. Pre-production can preview or test the template using synthetic
data. Production announcements are the only category sent outside the
ordinary pilot recipient list. The worker rechecks live membership, verified
email and suppression before delivery. An announcement contains public
release notes only.

The published Pages build emits a small marker for the verified application
version and commit. The worker checks it at most once per quarter hour while
waiting for publication. It saves a durable member cursor and stages up to
six recipients per pass and twelve per UTC day. The existing daily send cap
still applies. Unattempted announcements can wait until the next UTC day
when that cap is reached. If a prior campaign is still in progress, it
finishes before the worker stages the current release. Ordinary service
settings and signed receipts remain authoritative.

## Limits and recovery

The worker reads at most six due schedules and six due jobs per run. Each
environment has its own daily limits of 30 send attempts, 12 digest computations
and eight AI calls. Each task query is capped at 120 candidates with one
overflow check. Greater volumes skip the digest to avoid reporting a partial
count. Per-run queues use due time order. A job can be tried at most four times
in 20 hours, with a three-minute lease and exponential backoff inside Resend’s
24-hour idempotency window. The worker pins the template revision on its first send attempt, so a retry
uses the same request body and key across deployments. An accepted request is not delivered until a matching signed receipt
arrives. Duplicate and late callbacks cannot regress a delivered outcome.
The callback has a per-instance rate limit of 120 requests per minute before
parsing or verifying signatures. Hard bounces and complaints suppress that address. Suppressions retain only
an address hash, the reason category and date. The worker retires delivery
records after 30 days and deletes expired counters in bounded batches.

To pause ordinary mail, turn off the workspace switch. To stop all pre-production
mail including tests, run scripts/preprod-email-schedule.sh pause, clear
PREPROD_EMAIL_ENABLED and redeploy the same way. Production remains gated by
its own SDR_EMAIL_ENABLED and pilot member allowlist, with at most twenty
approved addresses. Provision the separate SALESDRONE_RESEND_API_KEY and
SALESDRONE_RESEND_WEBHOOK_SECRET and grant only the production runtime access
before enabling it. Production uses the existing scheduled worker. Clear the
production master switch and the environment flag for rollback. Never reuse a
key disclosed in chat for a production pilot.

If the pre-production callback shares a Resend workspace with production, disable
that subscription before any production send. Resend subscriptions can deliver
workspace-wide events. Use a separate pilot workspace when both endpoints need
to stay enabled.

## Lead correspondence (Email Beta)

Open **Email** to read a conversation, compose to a lead’s current email address,
or reply. On a phone, tap a conversation to open it, then use **Conversations**
to return. A linked thread appears in the lead’s **All** timeline. **Send email**
on the lead opens a composer with that lead selected. Messages appear in time order with the newest one open. Expand earlier
messages and quoted text when you need context. Long messages have a short
preview and a **Read full message** control. Use Bold, Italic, Bulleted list
and Preview in the composer. New outgoing messages include formatted HTML
and a plain-text fallback. Incoming mail is rendered as text. For an attachment, the inbox shows that one is present.

Admins can open **Settings → Workspace → Email notifications → Inbox Beta**.
The inbox starts off. Admins may grant inbox access to up to 50 active members.
Each conversation follows current lead view permission. Sending to a linked lead
requires edit access and a current, contactable email address. Admins manage the
Unlinked inbox and confirm links, including any suggested unique email match.
An Admin can delete a conversation by typing DELETE. Visibility ends at once.
A bounded worker removes stored message bodies. Copies held by Resend or
recipients follow their own retention.

### Pilot activation

Provision a dedicated sending and receiving domain in Resend for each
environment. Use `mail-preprod.salesdrone.in` for pre-production and
`mail.salesdrone.in` for production. Add Resend’s records on those subdomains.
Keep the root-domain MX and transactional sender unchanged. Configure a separate
signed callback to `/api/v1/email/beta/receipts/resend` on each environment’s
own host. Subscribe to received, sent, delivered, delayed, failed, bounced,
complained and suppressed events.

Grant each environment’s runtime service identity access to its own
`*_EMAIL_BETA_SEND_KEY`, `*_EMAIL_BETA_RECEIVE_KEY` and
`*_EMAIL_BETA_WEBHOOK_SECRET` in Secret Manager. The prefixes are `PREPROD`
and `SALESDRONE`. Set `PREPROD_EMAIL_BETA_ADDRESS` and the controlled
`PREPROD_EMAIL_BETA_TEST_INBOX` before enabling `PREPROD_EMAIL_BETA_ENABLED`.
Prepare and verify the pre-production email indexes with
`PREPROD_EMAIL_BETA_ENABLED=true node scripts/preprod-email-indexes.mjs` under
the index operator identity. The production equivalents are
`SDR_EMAIL_BETA_ADDRESS` and `SDR_EMAIL_BETA_ENABLED`. Enable workspace access
only after the checked environment deployment and provider configuration.
Verify one synthetic outbound message, an inbound reply, a delivery callback,
manual linking, a denied lead access case, a duplicate callback and deletion.
Verify pre-production independently before activating a production pilot.
When enabled, version-announcement replies reach the Admin-only Unlinked inbox.

When pre-prod shares the Resend team with transactional email, set
`PREPROD_EMAIL_BETA_SHARED_WEBHOOK=true` and add `email.received` to the
existing signed `/api/v1/email/receipts/resend` subscription. Leave the other
subscriptions in place. The callback checks Beta recipient addresses and
environment tags before it queues any Beta work. This configuration uses the
existing signing secret. The separate send and receive credentials still apply.

The signed receipt endpoint accepts up to 32 KiB. The worker retrieves up to
2 MiB and stores at most 16,000 plain-text characters per message. HTML-only
messages show a placeholder. A recognized reply alias or referenced message ID,
matching correspondent and a passing DMARC result are required to append
automatically. Other accepted inbound messages wait in Unlinked. Provider
retries are bounded. Admins can pause sending and visibility from Inbox Beta.
