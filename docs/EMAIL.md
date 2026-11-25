# Transactional email

SalesDrone sends outbound email through Resend from
notifications@salesdrone.in. The workspace starts paused. Each member can opt
into lead updates, shared-task updates, and daily and weekly digests under
Settings → Personal → Email preferences. Admins manage workspace controls,
synthetic previews, test sends and delivery history under Settings → Workspace →
Email notifications.

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
   the private preprodEmail function alongside the existing API.
4. Use scripts/preprod-email-schedule.sh configure to associate the five-minute
   UTC job with the private function through its OIDC identity. No pre-production
   traffic reaches the production database, worker or secrets. The workflow
   deploys to the preprod database and pre-production Hosting site.
5. Open the Admin template preview and use Send test email. The default recipient
   is Resend’s delivery simulator. A separately authorized test inbox can be
   set as SDR_EMAIL_TEST_INBOX on the private worker for a real inbox check.
   Use the bounce scenario only with synthetic data. In app Delivery history,
   compare Accepted with Delivered from the signed callback. Recheck pause,
   opt-out, retries, revoked access and all template layouts on the exact
   deployed candidate. Record actual receipt and client rendering separately
   from the provider test.
6. If Gemini selection must run in the pilot, provide an isolated pre-production
   key as SDR_EMAIL_GEMINI_KEY on the private worker. Read the actual Gemini
   usage and billed provider totals before promotion. Ordinary delivery works
   with the factual summary if the key is absent.

## Limits and recovery

The worker reads at most six due schedules and six due jobs per run. Each
environment has its own daily limits of 30 send attempts, 12 digest computations
and eight AI calls. Each task query is capped at 120 candidates with one
overflow check. Greater volumes skip the digest to avoid reporting a partial
count. Per-run queues use due time order. A job can be tried at most four times
in 20 hours, with a three-minute lease and exponential backoff inside Resend’s
24-hour idempotency window. The provider sees the same request and key on a
retry. An accepted request is not delivered until a matching signed receipt
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
