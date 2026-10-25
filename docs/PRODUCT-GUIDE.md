# SalesDrone product handbook

Version 1.6.3

[Complete settings reference](SETTINGS.md) · [API guide](API.md) · [Technical architecture](TECHNICAL.md)

## Getting started and signing in

Everyone

1. Open SalesDrone and choose Continue with Google. Use the account your administrator approved. Allow the sign-in window; if your browser blocks it, use the redirect sign-in option.

2. An approved active member enters the live workspace. An unapproved identity sees isolated demonstration records. Signing in alone does not grant access to company leads.

3. For a safe rehearsal, choose Explore the demo on the login screen. Changes are temporary and reset when you leave or choose Reset demo.

4. Check your profile and timezone in Settings before scheduling follow-ups. Enable notifications on each browser where you want alerts.

SalesDrone by AvinyaTech, part of Avinya Enterprises, helps small teams move from enquiry spreadsheets to a clear next step for each relationship. Start with imports, then capture new enquiries through the app form. No telephony integration is implied: you log the outcome of calls you make.

Navigation includes Today, Leads, Tasks, Notifications, Documentation and Settings. Administrators also see Import enquiries. The bell opens an inbox overlay; it does not replace your current working page. Documentation opens this handbook in another browser tab.

Use the bottom sidebar control to collapse or expand desktop navigation. Icons retain the same alignment and accessible labels. On narrow screens, use the menu or bottom navigation. The top-right appearance control switches theme; Settings also offers system appearance. Reduced-motion preferences reduce movement.

### Questions

**Why do I see sample data after Google login?**

Your identity is authenticated, but workspace membership is missing or inactive. Ask an administrator to approve your account under Settings > People & permissions. Do not enter real customer information in demo mode.

**Does this application call leads automatically?**

No. Phone and email links open your device’s handler. Call logging, reminders and AI analysis help you record and plan outreach; they do not place calls.

## Today: dashboard, insights and funnel

Members with access to the underlying leads

1. Open Today to review your accessible pipeline and outstanding work. Check due or overdue tasks before starting outreach.

2. Use Get insights to request a grounded outreach brief in manual mode. If automatic insights are enabled by an administrator, the button is hidden and the brief is requested when you visit the dashboard.

3. Read the current-stage funnel and other charts together with the task list. Use Leads filters to examine the records behind a pattern.

Graphs describe currently accessible records and aggregates. The funnel counts leads in each current stage; it does not prove those leads passed through every earlier stage or measure historical conversion.

AvinyaIntelligence uses reported workspace evidence. Insights are suggestions, not guaranteed sales outcomes. Missing information is not proof of disinterest. Administrator instructions shape the brief but do not bypass access controls. Manual mode avoids requesting a new summary on every dashboard visit.

Changing the lead list, completing tasks or refreshing may update aggregates. If a brief seems stale, request another in manual mode. AI availability depends on the server configuration and provider.

### Questions

**Why is Get insights missing?**

Automatic mode may be enabled, or your identity does not have access to that feature. Check Settings > AvinyaIntelligence > Insights.

**Can I use the funnel as a conversion report?**

Use it for current distribution only. Recorded stage history on a lead is the evidence of its actual transitions.

## Leads: capture, search, filters and editing

Members; actions depend on capability

1. Open Leads and select New enquiry. Complete the required name and contact information and any workspace-specific fields. Save once and wait for confirmation.

2. Choose a search field, enter the text and run search. Combine stage/source shortcuts with Filter any column for company, city, sector, name, dates or supported custom fields.

3. Click a customer name for quick inspection. On desktop the lead opens above the page as an overlay; the table keeps its original columns and width. Close it using Back to leads or Escape while focused inside the overlay.

4. Drag the overlay’s left edge to change its width. Arrow Left/Right resize the focused separator; Shift doubles the step, Home/End select the limits, and double-click resets it. Width is remembered in this browser.

5. Choose Edit in the table or Edit lead inside the overlay to update an existing enquiry. Save against the current version; reload if another change caused a conflict.

The source worksheet naming is made readable in the application: Enquiry source, Customer name, Phone number, Company name, City / location, Sector, Enquiry date and Enquiry status. Sales stage is separate from original imported status. Serial number is not a required application field.

Administrators can customize labels and supported field options under Manage fields. Labels change presentation; stable internal field IDs keep imports and API integrations consistent. Retired fields preserve existing data rather than erasing history.

Non-admin lead visibility follows workspace Reports & lead access policy and membership scope. Administrators can require assigned-only access. Filtering and exporting do not grant access to additional records.

Do not contact pauses eligible outreach; a review flag means the contact should be checked before outreach. Archive removes a lead from ordinary active work and cancels pending outreach; it is not permanent deletion.

### Questions

**Why does a filter show no results?**

Clear other filters, check spelling and the selected search field, then confirm the record is within your current assignment scope. Multiple filters narrow the result together.

**Why did my edit fail?**

A newer version may exist, or your access changed. Refresh and reapply the intended change. Do not repeatedly resubmit an outdated version.

## Full lead page: All, Comments, Calls, Tasks and Review

Members who can read the lead

1. In the lead overlay, select Open full lead page. The URL becomes /leads/{leadId}; you can bookmark it or use normal browser Back navigation.

2. Use the stage and assignment controls at the top. Assignment editing is an administrator action. Read-only users see status rather than gaining access to the people directory.

3. Read the horizontal journey. Expand Recorded stage changes for actual recorded transitions. Open Lead details & score when you need the full enquiry context.

4. All opens first and includes every loaded activity, review information and your private linked tasks. Choose Comments for notes and imported discussion comments, Calls for call entries only, Tasks for your linked work, or Review for issues needing attention. All and Comments include the inline Write a comment field. Arrow keys move between tabs; Home/End select the first/last tab.

5. Use Back to leads to return to the list. Filters remain available during the current session; a shared link still requires sign-in and current permission.

Comments includes only note entries, including imported discussion columns. Calls includes only logged calls and their outcomes. All includes both plus other activity and the existing review cards, without duplicating entries. Entries preserve timestamps, original import columns where known, line breaks and correction controls. Earlier activity loads another page instead of rendering every entry at once.

Tasks is recipient-private. Its status filter includes Pending, Completed and Cancelled, with All statuses as the starting view. Select a card to view, edit, complete, reschedule or delete using the existing task dialog. Refresh tasks after a change; Load more tasks retrieves another page. Administrators do not automatically gain access to another person’s private tasks.

Review shows contact review/suppression information and automatic follow-ups with Pending, Failed or NeedsReview state in the loaded activity. It is not an approval queue for every company operation. Load earlier activity to inspect older entries; an empty loaded page does not prove all historical work is reviewed. Use the existing reminder card to set a date, retry or dismiss when allowed.

The full-page identity header reads first and last names horizontally. Long names wrap naturally, with company below and the stage badge moving below the name in narrow containers.

### Questions

**Can another person open my bookmarked lead page?**

Only if their current workspace membership and scope allow reading that lead. URLs do not act as access tokens.

**Why are there fewer tasks than I expected?**

The tab shows your tasks linked to this lead, subject to current access. It does not show another recipient’s private reminders. Check the status filter and Load more tasks.

## Call logs, comments and corrections

Members with activities:write for changes

1. Open a lead and choose Log call. Select the actual outcome, add discussion notes and any supported disposition or follow-up fields, then save.

2. On the full lead page, type directly into Write a comment in All or Comments and choose Post comment. In the quick-inspection overlay, Add comment still opens the compact dialog. Each successful post creates a separate entry.

3. Check notes in Comments and logged calls in Calls; All combines both. If you made a mistake, choose Correct entry and submit a correction; the original revision remains part of the record.

4. Use Earlier activity to retrieve older pages. Imported discussions show their source column; an unknown original conversation date is explicitly described as unknown.

Call outcomes and lead sales stage are different concepts. No answer records an attempt; Qualified describes the relationship’s sales stage. Change the stage only when the underlying relationship warrants it.

Corrections preserve previous revisions and invalidate stale analysis so an old interpretation cannot silently schedule new work. Imported historical discussions do not automatically create fresh callbacks.

Notes can contain customer context; keep them out of support screenshots and public documentation. Application telemetry excludes comment content and task titles.

Inline drafts stay in memory while you switch All, Comments, Calls, Tasks and Review for the same lead. Failed posts retain text; retrying an unchanged uncertain write reuses its original identity. Blank and in-flight posts are disabled. Drafts are cleared when you leave that lead, change account or reload; customer notes are not stored in browser storage.

### Questions

**Can I delete the old wording by correcting a comment?**

Corrections keep revision history. They are not a permanent erasure mechanism.

**Does importing a discussion mean the call happened on import day?**

No. Import time is not the original discussion time. Unknown historical dates remain unknown.

## Automatic reminders from notes

Members with eligible notes and task permission

1. Check Settings > your follow-up preferences, including automatic reminders, timezone, default time and next-week interpretation.

2. Add a new call comment or note that contains a clear future action and date. Save it and look for Checking for a follow-up in the timeline.

3. After the background worker runs, inspect the outcome. A scheduled card shows the interpreted date and timezone. Confirm the intended time before relying on it.

4. Use Edit or Undo on a scheduled result, Set date manually when timing is unclear, Retry after an analysis failure, or Dismiss to stop that suggestion.

Gemini extracts a proposed follow-up in the background. A scheduled task uses the same ownership, delivery, suppression and version rules as a manual task. Ambiguous instructions can require review instead of creating a task.

The worker runs approximately once per minute; provider latency and retries add time. Imported historical notes are excluded from silently generating fresh work. Manual follow-ups specified with the originating action should not be duplicated.

Notes are untrusted content, not instructions to change application policy. Automatic reminders never override do-not-contact, inactive membership, current ownership, task completion/deletion or scope restrictions.

### Questions

**I wrote “follow up soon”; why is there no task?**

The timing may be ambiguous. Open Review and use Set date manually, or add a clear future date/time. Also check that automatic reminders are enabled.

**A reminder was scheduled at the wrong time. What now?**

Use Edit on the card or edit the task. Check your timezone and default-time preferences. Undo dismisses the automatic result when allowed.

## Tasks, reminders and completion

Task recipients

1. Open Tasks to review your work, or use Remind me on a lead to create a linked follow-up. Set the title, date/time and task kind.

2. Select a task to see its details. Edit the task to change supported fields, reschedule to another valid time, or complete work after it is actually done.

3. Delete only when the task is no longer needed. The application uses soft deletion and prevents old scheduled jobs from reviving the task.

4. Check pending, completed and cancelled work using the available filters. On the full lead page the Tasks tab narrows the same private task service to that lead.

Times are stored as instants with IANA timezone context. Invalid or ambiguous local times, including daylight-saving edge cases, may need correction. The form tells you which timezone it uses.

Each edit changes the task version and invalidates old delivery work. A due task may create an inbox notification and send to eligible registered devices. A task being due does not guarantee an operating-system banner appears immediately.

Lead-linked outreach can be cancelled or suppressed by reassignment, review, do-not-contact, archiving or lost access. A private reminder is not a shared team assignment.

### Questions

**Why did a task disappear after reassignment?**

Reassignment cancels pending lead outreach to prevent contacting the lead under an outdated owner. The new owner should set the next reminder.

**Can an administrator edit my reminders?**

Task recipient privacy remains in force. Administrator status alone does not grant editing rights to another person’s private tasks.

## Inbox and push notifications

Each signed-in member on each device

1. Click the bell to open the notification overlay without leaving your current work. Open an entry to follow its lead/task link when still accessible.

2. Use the read/unread controls to organize the inbox. An unread badge indicates unread entries; reading does not complete the linked task.

3. In Settings > Notifications choose Enable notifications and allow the browser prompt. Use Send test to check device registration.

4. Test a near-future reminder with another tab active. Repeat device setup in each browser/profile where alerts are needed.

Lead creation/assignment alerts are routed to the eligible assigned person. Reminder delivery is private to the recipient. Browser push permission, device registration, membership and current domain access all matter.

Push previews are intentionally generic and do not include lead notes or private customer details. A notification link checks current access again; a stale notification cannot grant access to a reassigned lead.

Operating-system focus modes, browser background restrictions and denied site permissions may prevent banners even when the inbox has an entry. Inbox read state and OS banner visibility are different things.

### Questions

**The app says notifications are ready but I saw no banner.**

Check browser site permissions, operating-system notification settings and focus mode. Run Send test, then inspect the inbox separately.

**Does marking unread resend push?**

No. Read/unread organizes the inbox; it does not recreate reminder delivery.

## Excel and CSV import

Administrators with import permission

1. Open Import enquiries and select the initial workbook. Use only the first worksheet; the remaining sheets are ignored.

2. Map spreadsheet columns to application fields. Check phone numbers, dates, names and enquiry/status mappings in the preview before committing.

3. Select multiple discussion/follow-up columns for comments. Each nonblank selected cell becomes a separate comment under its lead, with source-column information.

4. Review invalid rows and duplicates. Import the previewed rows, wait for chunk progress and inspect the completion summary. Recover using the existing import run rather than starting an unrelated duplicate run.

5. After initial setup, capture new enquiries through New enquiry. Import remains useful for later batches with careful preview.

A spreadsheet’s display formatting can hide phone-number or date problems. Preview the parsed values; do not assume Excel cell formatting survives as domain data. Blank comment cells are skipped, repeated nonblank discussion text is preserved as separate source entries.

Imports are bounded/chunked and use replay protection. Source discussions are historical context, not new AI reminder requests. Do not fabricate discussion dates from import time.

Keep source workbooks private. A CSV or workbook upload is business data; documentation examples and screenshots use fictional records only.

If browser storage is blocked, keep the import page open: the current preview/run remains available in memory, but automatic resume after a reload cannot be remembered. The app shows this limitation instead of failing the preview.

### Questions

**Can several follow-up columns be imported as comments?**

Yes. Select each discussion column in the comment mapping. They are stored as timeline entries, not extra enquiry columns.

**Why not import sheets two and three?**

The current workflow intentionally targets the first worksheet. Prepare that sheet as the authoritative initial lead list.

## Filtered Excel reports

Members, when exports are enabled

1. Apply the desired search and column filters on Leads. Verify the visible matches before opening Export Excel.

2. Choose the supported columns for the report, start export and wait for the paginated data retrieval and workbook generation.

3. Cancel if you selected the wrong filter or columns. Download the completed workbook and handle it as private company data.

4. Administrators can enable or disable this feature under Settings > Reports & lead access.

An export follows the active filters and current authorization; it is not an unrestricted database download. The server rechecks current access while report pages are read. Policy/account changes cancel pending work.

Workbook generation runs in a browser worker. Large result sets are bounded by the reports API; completion time depends on result size and the device. The export does not reveal private task data or another member’s inbox.

Exporting a sheet does not create a live two-way Excel connection. Later edits in the workbook do not update SalesDrone unless entered or imported through an authorized workflow.

### Questions

**Why is Export Excel unavailable?**

Exports may be disabled by the administrator, your identity may lack permission, or the workspace may still be loading.

**Will filtering by a city export every lead in that city?**

Only matching leads you are currently allowed to read, within supported report limits.

## AvinyaIntelligence and lead scoring

Members; configuration requires administrator

1. Open a lead’s Lead details & score section and read its score, evidence coverage and factor breakdown together.

2. Use refresh scoring when permitted and needed. Add factual business context through comments; do not invent evidence to raise a score.

3. Administrators configure Fit, Intent and Red-flag factors, weights and activation under Settings > AvinyaIntelligence > Lead scoring.

4. Customize insight instructions and manual/automatic mode under the Insights child section. Leave instructions blank to use the application default.

Fit factors include business/account profile, project capacity, geography, commercial credit and licensing. Intent can include bids, RFQs, samples, credit applications and inbound urgency. Red flags include uneconomic delivery distance, reported payment risk, unsuitable small volume and disputes.

Evidence extraction uses reported information, while score calculation is deterministic from configured factors. Unknown facts are not automatically negative. Scores help prioritize sales work and do not independently verify credit, licensing, distance or safety claims.

Configuration changes can cause background refresh work. A model response is not a source of truth about a prospect’s creditworthiness or commercial eligibility. Review evidence and use professional judgement.

### Questions

**Is a high score proof the lead will buy?**

No. It is a prioritization signal based on reported evidence and configured factors.

**Can we adapt factors to another business?**

Administrators can adjust the supported factors and weights. Document what each factor means so the team interprets scores consistently.

## Settings: complete control reference

Personal controls for members; workspace controls for administrators

1. Open Settings. On desktop use the left section navigation; on mobile choose a section from the dropdown.

2. Expand Manage fields to choose Lead fields or Dropdown choices. Expand AvinyaIntelligence to choose Insights or Lead scoring.

3. Change personal preferences only for your account. Review the scope of a workspace setting before saving, because it can change other members’ workflow.

4. Open the complete Settings reference from this handbook for each control’s default, scope, permission, API, effect, example and limitation.

Profile and appearance cover identity display, theme and timezone. Follow-up preferences control automatic reminder behavior, default time, next-week interpretation and weekend movement. Notifications manages browser device registration and tests.

Manage fields includes editable built-in labels and supported required/active behavior, adding custom fields with stable IDs and types, and editing/retiring existing definitions. Dropdown choices manages allowed values for supported field types. Retirement preserves stored values; incompatible type changes are constrained.

Reports & lead access controls exports and assigned-only visibility for non-admins. People & permissions manages members, invitations, role/capability and assignment scope. Developer settings manages scoped Personal Access Tokens. About describes the product and version.

The linked Settings reference is the authoritative per-control checklist. This chapter explains navigation; it does not replace that detailed reference.

The top-right theme switch uses a sunrise/sunset horizon. It remains keyboard-accessible and removes animation when your device requests reduced motion. Book mode is available from v1.6.3 in Appearance & time; save the personal preference to apply it.

### Questions

**Can I rename a built-in field?**

Use Manage fields > Lead fields. A label change does not rename its stable API key, so integrations keep using the documented schema.

**Can I remove a field without losing historical data?**

Supported retirement/active controls hide it from future capture while preserving existing records. Review the per-control limits before changing required fields or types.

## Book mode: a quieter reading workspace

Every active member; personal preference

1. Open Settings > Appearance & time. On mobile, choose that section from the section selector.

2. Enable Book mode and select Save changes. The workspace uses warm paper surfaces, ink-like text and serif reading passages.

3. Choose Light, Dark or System as usual. The top-right sunrise/sunset control changes day/night while preserving Book mode.

4. Return to Appearance & time, disable Book mode and save to restore the standard workspace.

The mode applies across dashboard, leads, tasks, forms, notifications and settings. Lead comments and narrative descriptions use a local serif font; headings, phone numbers, table controls and status distinctions remain readable. Page borders are restrained and no page-turn animation covers working data.

The saved preference belongs to your account, not the team. Existing clients that omit bookMode preserve the stored value. Demo/guest changes use a guarded local fallback; a live account uses its own server preference, default off.

This is a visual reading style. It does not add offline access, physical e-ink behaviour or a separate read-only view. You can continue editing and following up on leads. Reduced motion disables the celestial toggle animation.

### Questions

**Does switching to dark mode turn Book mode off?**

No. They are independent; dark Book mode uses charcoal paper and warm ink.

**Will this change my colleagues’ screens?**

No. Book mode is a personal preference.

**Why did the style not change after selecting it?**

Save preferences to apply it. If saving fails, the previous saved style remains in use; check the error and retry.

## People, permissions and assignment

Administrators

1. Open Settings > People & permissions. Invite or approve the intended Google account; verify its email carefully.

2. Set the role, capabilities and supported lead scope appropriate to the person’s work. Review active status and current ownership before granting access.

3. Assign a lead using the top-of-lead assignment control. The recipient receives an eligible assignment notification; pending old-owner outreach is cancelled.

4. Deactivate or adjust membership when responsibility changes. Recheck access with the affected user rather than assuming a cached page reflects current permission.

The two bootstrap administrator identities remain protected. Routine sign-in does not approve membership. Server policy is authoritative for every read, write, inference input and export; hiding a button alone is not an access boundary.

Role labels and capabilities are related but not interchangeable. A task remains private to its recipient. Assigned-only policy can further restrict non-admin lead access even when other capabilities are present.

Only grant access needed for the person’s responsibility. Do not share Google sessions or personal API tokens across employees.

### Questions

**Why can a member view but not edit a lead?**

Read access and editing capability are separate. Check both membership scope and the specific write permission.

**Does assigning a lead transfer existing private reminders?**

No. Old pending outreach is cancelled and the new owner sets the next appropriate reminder.

## Developer settings and API integration

Administrators creating scoped tokens

1. Open Settings > Developer settings > Personal Access Tokens. Choose a descriptive name, expiration and only the needed scopes.

2. Generate the token and copy the secret once into a secure server-side secret store. The application cannot show the original secret again.

3. Open the Swagger portal at the hosted /api/docs URL. Read the versioned request/response schemas and authorization requirements before sending a request.

4. Use Authorization: Bearer <token> from your integration. Follow cursor pagination, validation errors and expected-version requirements. Revoke unused or exposed tokens immediately.

The API supports documented reads and writes for leads, activities, tasks and other permitted resources. It does not offer arbitrary Firestore access. Archive and soft delete have explicit semantics; they are not equivalent to permanent erasure.

Token routes enforce supported scopes and the owner’s current active administrator membership. Expired or revoked tokens stop working. Compound operations can need more than one scope. Check the Swagger contract rather than inferring an endpoint from the UI.

Never put a token in a public repository, browser URL, client-side JavaScript, screenshot or support ticket. Browser sign-in/App Check and Personal Access Tokens are separate authentication paths.

### Questions

**Why does my token get 403?**

Check its scopes, expiration, revocation and the token owner’s current administrator membership. A valid secret does not bypass domain policy.

**Can an integration permanently delete leads?**

The documented lead removal workflow is archive. Use the published contract; do not assume a DELETE endpoint exists for every resource.

## Background services, privacy and operational limits

Administrators and integration maintainers

1. For a delayed automatic follow-up, check its timeline state first. For a missing banner, check the inbox and device test separately.

2. For an edit conflict, reload the latest record before trying again. For a forbidden operation, check current membership and scope.

3. When reporting an issue, include app version, action, approximate time/timezone and exact non-sensitive error text. Redact customer names, emails, notes and tokens.

4. Use the technical and API guides for development details. The public handbook describes product behavior; it does not expose infrastructure credentials or operational customer records.

The api Cloud Function serves versioned HTTP requests with authentication and domain policy. Browser clients do not directly read Firestore; client rules deny direct access. Firebase Hosting serves the application and Swagger assets; Google Firebase Auth verifies identity.

The reminders worker checks due versioned delivery work and sends eligible private inbox/push notifications. analyzeNotes interprets new eligible comments with Gemini. leadIntelligence refreshes lead evidence/scoring. exportTelemetry exports safe committed event outboxes. The scheduled workers normally run every minute; this is not an exact real-time delivery promise.

Dynatrace receives browser RUM with the approved member-email user tag and safe backend metrics, traces, logs and committed events. Backend actors remain pseudonymous and customer notes, task titles, tokens and replay recordings are excluded. Deployment events contain release version and commit. HTTP ingestion acceptance does not by itself prove tenant searchability.

When offline, treat data as potentially stale. This app is not an offline-first CRM or a full telephony platform. Reconnect and refresh before relying on a change. Browser/device limitations can affect notification delivery.

### Questions

**Where do I find the current app version?**

Check the sidebar attribution and About SalesDrone. The API contract has its own version shown in Swagger.

**Does a successful push test prove every reminder will arrive?**

No. It proves the current test path worked. Future delivery still checks task state, assignment, membership, suppression and device availability.

**What should I do if AI is unavailable?**

Keep using manual tasks, notes and filters. Review failed analysis cards and retry when available; do not duplicate a task blindly.
