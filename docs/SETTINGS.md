# Customize SalesDrone

Settings guide for **v2.1.1**. Desktop groups expand to reveal their sections; mobile uses a grouped Settings section selector. Admin-only sections are hidden for other members. Changes to workspace data are authorized by the API, not by navigation.

## Personal → Profile

**Who/where:** Personal account; read only.

**API:** GET /api/v1/me.

**Permissions:** Verified Google sign-in.

### Name, email and profile photo

**Default:** From Google.

Displays the verified Google identity and its profile photo, with initials as a fallback. These details are not edited in SalesDrone.

Change the source profile in Google, then sign in again.

### Workspace role and access

**Default:** Granted by an administrator.

Shows whether this identity has live membership. Signing in alone does not grant lead access; unapproved identities see synthetic demo data.

Permissions are enforced server-side, including direct links and API requests.

## Personal → Appearance & time

**Who/where:** Personal preference.

**API:** GET /api/v1/me; PATCH /api/v1/me.

**Permissions:** Active member; own preferences.

### Theme

**Default:** System.

Choose System, Light or Dark. System follows the device preference. The top-right theme control offers a quick switch. The quick switch shows sun and moon icons in a compact pill; a solid indicator marks the active mode. Tap or use Enter/Space to switch. Reduced motion removes the indicator transition.

Saved appearance applies to your account; the browser also remembers a local fallback. Demo appearance is local. On desktop, lead blade width is adjusted directly in Leads using its left edge (double-click resets it); expand opens a dedicated lead page. That width is remembered only in the current browser, separately from account preferences; double-click the edge to reset it.

### Interface font

**Default:** Standard (Google Sans headings and Manrope text).

Choose Standard, Inter, Source Sans 3 or Lora for your own interface. A sample previews the draft selection; the workspace changes after a successful Save changes. Font files are self-hosted, with no runtime Google Fonts request.

Saved on your own account through PATCH /me and returned by GET /me. Older clients that omit fontStyle preserve it. Book mode uses its own serif stack and restores your selected font when disabled. Branding, phone numbers and technical code retain their established fonts. Other users are unaffected. Demo choices are a guarded browser-local fallback.

**Example:** Choose Inter for a compact interface or Lora for an editorial serif style, inspect the sample, then save. Standard restores the original pairing.

### Display zoom

**Default:** 100% (Standard).

Choose 85%, 90%, 100%, 110% or 125% for your own workspace on phones, tablets and desktops. Save changes applies the preference on the current device and future signed-in sessions. Default is 100%. Smaller zoom preserves usable touch targets; it does not disable browser or pinch zoom.

Stored on your account through GET/PATCH /me; other members are unaffected. Choose 100% to reset. Browser zoom and pinch zoom remain available. Older clients preserve an omitted displayScale; missing or unsupported values fall back to 100%. Demo choices stay browser-local and cannot override an authenticated member preference.

**Example:** On a phone choose 90% to fit more content, or 110% for larger text, then save. Return to 100% to reset. Additional desktop columns still scroll within the table.

### Book mode

**Default:** Off.

A personal reading style with warm paper surfaces and serif fonts throughout headings, navigation, tables, forms, buttons and chart labels. Dark mode uses charcoal paper. Phone numbers remain monospace. This is a visual style, not physical e-ink or an offline reader.

Select Book mode and save preferences. Your account stores bookMode; other members are unaffected. Light/Dark/System and the quick light/dark toggle remain independent. Omitted bookMode in older API clients preserves the saved value; missing preferences default off. Demo/guest preference is a guarded local fallback. Responsive type-size roles match the standard UI while keeping the Book serif family; this is a web adaptation, not native Dynamic Type. Shared typography roles and responsive layouts apply across phones, tablets, laptops and desktops; font families remain serif in Book mode.

**Example:** Enable Book mode with Light for ivory paper, then use the top-right toggle for warm night reading. Turn Book mode off and save to restore the standard workspace.

### Display timezone

**Default:** Asia/Kolkata for live accounts.

Use an IANA timezone, such as Asia/Kolkata or Europe/London. It controls displayed dates, dashboard calendar boundaries and automatic reminder interpretation.

Save preferences. Manual reminder forms label the device timezone they use; already scheduled instants do not move.

**Example:** Set Europe/London before adding a note saying “tomorrow morning”.

## Personal → Notifications & devices

**Who/where:** Personal browser/device.

**API:** GET/POST /api/v1/devices; POST /api/v1/devices/{id}/test; DELETE /api/v1/devices/{id}.

**Permissions:** Active member; own devices; Google/App Check.

### Enable notifications

**Default:** Not registered until enabled.

Requests browser notification permission and registers this device for Firebase Cloud Messaging. In-app notifications remain available even when push is blocked.

Allow the browser prompt. On supported iPhone/iPad versions, install the web app on the Home Screen and enable it there. Delivery can be delayed by the OS.

### Send test

**Default:** On demand.

Sends a synthetic readiness notification to the selected registered device.

FCM acceptance does not prove the device displayed it. Check the browser permission and OS settings if it is absent.

### Revoke a device

**Default:** Enabled registrations remain until revoked or invalidated.

Stops future push delivery to that registration. Revoking this browser also deletes its local messaging registration.

In-app reminders and notifications are retained. The notification bell lets you mark inbox items read or unread.

## Personal → Archives

**Who/where:** Workspace records within your current lead scope; read only.

**API:** GET /api/v1/archived-leads; POST /api/v1/leads/{id}/archive.

**Permissions:** Active member with leads:read; archiving additionally requires leads:edit and current record version. PAT archive reads use leads:read..

### Archived leads

**Default:** No archived leads until records are archived.

Lists archived leads in Settings in 30-record pages with contact details and stage. Only permitted leads are returned, including when opening direct links. Archived leads stay outside the active pipeline and cancelled reminders remain cancelled.

Refresh reloads the first page. Load more follows a signed, access-bound cursor. View lead record opens the retained record; viewing does not restore it. This page has no permanent deletion or restore action.

**Example:** Archive a lead from its record, then open Settings > Archives. Older archives display Date not recorded instead of inventing an archive date.

## Workspace · Admin → Reports & lead access

**Who/where:** Workspace-wide; Admin only.

**API:** GET/PATCH /api/v1/workspace-settings.

**Permissions:** Read: leads:read (PAT configuration:read). Write: Admin + members:write + Google/App Check; expectedVersion.

### Allow Excel reports

**Default:** On.

Lets members with lead access export matching lead fields and selected columns from Leads → Export Excel. Admins are also subject to this switch.

Turning it off blocks the report API as well as hiding the action. It does not prevent copying data a person is already authorized to read. PAT reports require leads:export.

**Example:** Filter Sector equals MEP, choose phone and company, then export all matching pages.

### Non-admins see assigned leads only

**Default:** On.

Caps every non-admin at assigned scope, including members whose configured scope is All leads. Admins retain their existing scope.

Applies to lists, direct links, reports, dashboards and reminder/notification eligibility on the next API request. Existing UI sessions recheck on focus/every minute. Off restores configured member scope; it does not broaden an assigned member.

**Example:** Keep on for SDRs working separate portfolios.

## Manage fields → Lead fields

**Who/where:** Workspace-wide; Admin only.

**API:** GET/PATCH /api/v1/field-options.

**Permissions:** Read: leads:read (PAT configuration:read). Write: members:write via Google/App Check; expectedVersion.

### Built-in field names

**Default:** Standard enquiry labels.

Rename display names for existing lead fields. The internal API keys, stored values, field types and validation semantics stay fixed. Names must be nonempty, distinct and no more than 80 characters.

Shared forms, table/filter labels and report headers use the configured names after refresh.

**Example:** Rename Sector to Business segment without changing the zone API key.

### Optional field visibility

**Default:** Visible.

Hide supported optional fields from the enquiry UI. Essential identity/workflow requirements remain protected.

Hiding is not deletion or a substitute for authorization. Historical records remain; hidden fields cannot be selected in a new Excel report.

### Custom field name, type and required flag

**Default:** No custom fields.

Add up to 30 custom fields: text, long text, number, date, dropdown or checkbox fields with stable cf_ identifiers. Choose a unique label and optionally make the value required. Existing IDs/types cannot be changed or reused after retirement.

Required rules apply to new manual entries or explicit custom-value edits, not unrelated edits to legacy records. The first-sheet importer currently maps standard enquiry fields, not arbitrary custom-field columns.

**Example:** Add a dropdown named Material category with Cement, Aggregates and Blocks.

### Custom dropdown choices

**Default:** Provided when creating the dropdown.

A custom dropdown needs at least one distinct nonempty choice. Choice labels are bounded and case-normalized duplicates are rejected.

Removing a choice preserves unchanged historical values but prevents new use of that retired value.

### Retire/remove a custom field

**Default:** Active.

Remove an unused custom field from new-entry controls without erasing historical lead values.

Retired IDs cannot be reused. Create a new field for a different data type instead of rewriting existing values.

## Manage fields → Dropdown choices

**Who/where:** Workspace-wide; Admin only.

**API:** GET/PATCH /api/v1/field-options.

**Permissions:** Read: leads:read (PAT configuration:read). Write: members:write via Google/App Check; expectedVersion.

### Enquiry sources

**Default:** Direct enquiry, Website, Referral, Exhibition, Social media, Other.

Maintain where enquiries originate.

Used in lead capture, filters and imports. Existing historical values remain readable.

### Cities / locations

**Default:** No preset list.

Add city/location suggestions appropriate to the business.

The same configured options are reused by shared controls; old records are preserved.

### Sectors

**Default:** No preset list.

Add industry, territory or sector choices matching your sales process.

The underlying key remains zone even if you rename its label in Lead fields.

### Enquiry statuses

**Default:** Call/WA done, Samples sent, Won/Order placed, Quoted.

Maintain spreadsheet enquiry status choices separately from sales stages and call outcomes.

Historical enquiry status is not automatically treated as a stage transition.

### Sales stages

**Default:** New, Working, Qualified, Meeting booked, Nurture, Disqualified, Won.

Add sales stages and arrange the sequence used by forms, journeys and dashboard funnel.

Protected baseline workflow values are retained. A current-stage funnel is not a historic conversion rate.

### Call outcomes

**Default:** Standard connected / unanswered call outcomes.

Customize the available results of a phone call while retaining protected workflow outcomes.

Changing choices does not rewrite old call records.

### Call dispositions

**Default:** None, Interested, Not interested, Callback requested, Do not contact.

Describe the contact’s response separately from the technical call outcome.

Do not contact is protected and suppresses outreach; renaming a field does not remove suppression rules.

### Phone country codes

**Default:** +91, +1, +44, +971, +65, +61.

Maintain country dialing prefixes used in contact entry.

Preserves original phone input and normalized duplicate checks. Each choice list supports up to 100 distinct values of up to 100 characters.

## AvinyaIntelligence → Dashboard insights

**Who/where:** Workspace-wide; Admin only.

**API:** GET/PATCH /api/v1/ai-settings.

**Permissions:** Admin + members:write + Google/App Check; PAT access denied; expectedVersion.

### When to get insights

**Default:** When I ask (manual).

Manual shows a compact Get insights / Refresh insights action. When the dashboard opens requests insights once per visit and hides the button.

Recent matching cached briefs are reused. Chart refreshes do not regenerate. Automatic mode can use more model requests; failures do not loop.

### Instructions for insights

**Default:** Default grounded sales briefing.

Customize focus, tone and language, up to 4,000 characters. Blank text uses the displayed default; Use default clears custom guidance, and Save preferences applies it.

Applies to dashboard prose, not scoring factors or automatic reminder interpretation. Guidance cannot expand access, invent evidence or contact leads. Changes invalidate cached/stale in-flight briefs.

**Example:** Use concise Tamil bullets, focusing first on overdue callbacks and missing qualification context.

## AvinyaIntelligence → Automatic reminders

**Who/where:** Personal preference.

**API:** GET /api/v1/me; PATCH /api/v1/me.

**Permissions:** Active member; own preferences; scheduling also requires activities:write and tasks:write.

### Automatically schedule follow-ups from notes

**Default:** On.

New lead notes and call comments are analyzed by Gemini for a clear dated next step. Conditional, conflicting or vague instructions need review.

Disabling stops pending analysis and new automatic extraction; it does not delete existing tasks. Manual tasks/edits take priority. Imported historical comments do not schedule new reminders.

### Default time

**Default:** 10:00.

Time of day used when an inferred dated follow-up has no explicit time.

Uses your display timezone; exact written times take precedence.

**Example:** “Call tomorrow” uses 10:00 unless you choose another default.

### “Next week” means

**Default:** Seven days after the note.

Choose seven days after the note or next Monday for ambiguous next-week wording.

Only ambiguous relative wording uses this preference; named dates/weekdays remain explicit.

### Move relative dates to a working day

**Default:** Off.

Moves qualifying relative dates without an explicit time from a weekend to the next working day.

Exact dates and named weekdays are kept as written; this is not a configurable holiday calendar.

## AvinyaIntelligence → Lead scoring

**Who/where:** Workspace-wide; Admin only.

**API:** GET/PATCH /api/v1/scoring-settings.

**Permissions:** Read: leads:read (PAT configuration:read). Write: members:write + Google/App Check; expectedVersion.

### Enable lead scoring

**Default:** On.

Controls background evidence-based qualification under the workspace model.

Off disables scoring; it does not fabricate zero scores or delete historical lead data.

### Factor label, group and evidence condition

**Default:** Commercial construction / wholesale defaults.

Define what counts as Fit, Intent or a Red flag. Gemini must cite recorded evidence rather than guess. Conditions are 10–600 characters; labels up to 80; up to 30 factors.

Condition/factor changes require fresh evidence analysis. Missing evidence remains unknown. This is sales prioritization, not a credit, licensing or safety verification.

**Example:** Add an Intent factor for a documented active RFQ.

### Factor weight and enabled flag

**Default:** Default positive weights and red-flag penalties.

Give enabled factors integer weights from 1 to 100, or disable an irrelevant factor. Keep at least one enabled Fit or Intent factor when scoring is on.

Positive matches are normalized against enabled positive weights; red flags subtract points; the result is clamped to 0–100. Weight-only edits can recalculate without new extraction.

### Add/remove factors

**Default:** Default factor set.

Add business-specific signals or remove irrelevant ones. Stable factor identity ties evidence to the model.

Background scans are bounded; bulk changes are not guaranteed to finish immediately. Inspect evidence coverage, not just the score.

## Workspace · Admin → Developer settings

**Who/where:** Personal credentials; Admin only.

**API:** GET/POST /api/v1/personal-access-tokens; DELETE /api/v1/personal-access-tokens/{id}.

**Permissions:** Admin + members:write + Google/App Check; tokens cannot manage tokens.

### Personal Access Token name

**Default:** Provided on creation.

A descriptive name of 1–80 characters helps identify an integration.

Names are metadata, not secrets or unique identifiers.

### Permission scopes

**Default:** Explicit selection required.

Select only needed data operations. Scopes intersect the current owner’s capabilities and effective lead scope. Read leads and Export leads are separate. Batch editing has its own leads:bulk-edit scope. Lead files use attachments:read and attachments:write; old tokens do not gain these scopes automatically. Reassignment in a batch also requires assignments:write.

Tokens cannot manage people, workspace settings, devices, other tokens or AI generation. The live Swagger portal lists each route’s scope. See the generated scope catalog below.

### Expiry

**Default:** 30 days.

Choose 7, 30 or 90 days. Up to 20 active tokens are allowed per owner.

Expiry and scopes are immutable; issue a replacement to change them.

### Copy a newly generated token

**Default:** Shown once.

Save the secret directly in your integration’s secret manager. SalesDrone stores a hash and cannot recover the full token later.

Never put it in URLs, screenshots, code or documentation. A lost creation response requires revoking its metadata and generating a replacement.

### Revoke a token

**Default:** Active until expiry/revocation.

Stops subsequent authorization using that credential.

Already completed operations are not undone. Demoting/suspending the owner also blocks access.

### Swagger API portal

**Default:** Same-origin /api/docs.

Inspect request schemas, permissions and examples. Trying a write request changes real records.

Authorization stays in tab memory. Clear it when finished, especially on shared devices.

### API token scope catalog

- **attachments:read** — List and download permitted lead files.
- **attachments:write** — Upload and remove permitted lead files.
- **leads:bulk-edit** — Preview and apply atomic batch lead edits.
- **leads:export** — Export filtered lead report pages when enabled.
- **leads:read** — Read leads and stage history.
- **leads:create** — Create enquiries.
- **leads:edit** — Update lead details.
- **leads:archive** — Archive leads (no permanent deletion).
- **assignments:write** — Assign leads to permitted members.
- **activities:read** — Read comments and calls.
- **activities:write** — Add/correct comments and calls; notes may schedule reminders.
- **tasks:read** — Read your accessible reminders.
- **tasks:write** — Create, edit and delete reminders.
- **imports:read** — Read your import jobs and errors.
- **imports:write** — Preview and commit enquiry imports.
- **scores:read** — Read reported lead scores.
- **dashboard:read** — Read dashboard and summary data.
- **configuration:read** — Read lead fields, choices and scoring configuration.
- **notifications:read** — Read your notification inbox.
- **notifications:write** — Mark your notifications read or unread.

## Workspace · Admin → People & access

**Who/where:** Workspace access; Admin only.

**API:** GET /api/v1/members; GET/POST /api/v1/invitations; DELETE /api/v1/invitations/{id}; PATCH /api/v1/members/{uid}.

**Permissions:** members:write + Google/App Check; PAT access denied.

### Invite by verified Google email

**Default:** No access until granted and accepted.

Invite the intended Google account. Invitations expire after seven days and can be revoked.

The invitation binds to the verified identity that accepts it. Merely signing in does not grant live data.

### Role

**Default:** Viewer or SDR chosen for each grant.

Viewer can read leads. SDR can also create/edit leads, record activity and manage tasks. Administrative capabilities are reserved for protected administrators. Lead editors may batch edit permitted records and upload/remove their lead files; readers may list/download permitted Ready files. Effective assigned-only policy applies to files as well.

This screen does not promote other users to Admin or edit protected bootstrap admins.

### Configured lead scope

**Default:** Assigned.

Choose Assigned or All leads for a member. The workspace assigned-only cap still limits non-admins when enabled.

Changing scope applies server-side; old cursors/cached context cannot grant broader access.

### Detailed permissions

**Default:** Role preset unless customized.

Fine-tune allowed non-administrative actions while retaining lead-read permission for workspace access.

Removing a capability blocks subsequent relevant operations. UI visibility alone is not authorization.

### Suspend/restore membership

**Default:** Active after valid acceptance.

Disable a member’s live workspace access without deleting their historical work.

Current API requests, token checks and worker delivery eligibility use active membership. Re-enabling restores only the configured role/scope/capabilities.

## Workspace · Admin → Lead data management

**Who/where:** All active and archived lead data across the workspace.

**API:** GET /api/v1/lead-data-reset; POST /api/v1/lead-data-reset/preview; POST /api/v1/lead-data-reset; POST /api/v1/lead-data-reset/{id}/resume.

**Permissions:** Active Admin with members:write and leads:read, verified Google sign-in and App Check. All PAT access denied..

### Permanently clear lead data

**Default:** No deletion; requires an explicit new preview and confirmation.

Review current approximate total/archived lead counts, type DELETE ALL LEADS exactly and acknowledge permanent workspace-wide deletion. The preview is owner-bound and expires after ten minutes. Leads added before confirmation are included too.

After acceptance the operation cannot be cancelled. Lead changes and background processing pause for a five-minute in-flight grace period, then the existing scheduled worker removes records/files in resumable batches. Users, roles, permissions, configuration, personal preferences, standalone personal reminders, security audit and telemetry delivery evidence are retained. All old API idempotency receipts are redacted and expire, including standalone-operation retries. Removed imports must be uploaded anew. No in-app undo; provider backup/soft-delete retention is outside this control.

**Example:** Use this only to start a fresh pipeline. Export first if needed; a report is not a full file/history backup.

### Cleanup status and retry

**Default:** Idle.

Status refreshes while this section is open. Waiting, Running, Blocked and Completed are persisted. You may leave and return; cleanup continues independently of the browser.

Refresh status checks progress immediately. A failure retains the pause and cursor. After fixing service/storage access, an Admin can Retry cleanup with its current version. There is no automatic rollback or cancellation after partial deletion. Counts reflect acknowledged batch work; provider deletes retried after a crash may be undercounted.

**Example:** A network error does not mean cleanup was rejected. Refresh status or retry the same confirmation request; stable operation IDs prevent another reset.

## Product → About SalesDrone

**Who/where:** Read only.

**API:** No dedicated settings mutation.

**Permissions:** Available in demo and live app.

### Story, mission and version

**Default:** Current installed release.

Explains why SalesDrone exists and shows the application version.

Refresh after a release to load current assets. This page does not change business data.

## Settings audit trail

Saved live changes are recorded with actor, timestamp, action and changed control keys, and queued atomically for Dynatrace. Exported identities are hashed and values, prompts, labels and credentials are excluded. Unchanged saves, failed/denied writes, read-only controls, OS-resolved changes and local demo preferences are not reported as setting changes. Send test retains action telemetry. No audit viewer or audit API scope is added; authorized operators inspect the server-side records. See the settings audit guide for coverage, retries and limits.

See [settings audit coverage and delivery](SETTINGS-AUDIT.md).

## Operator environment configuration

### Firebase project and identity

Operators configure Firebase Auth Google provider, authorized domains, App Check, Hosting, Firestore rules/indexes and the deployed Functions project. These are not editable through business Settings. See SETUP.md and RELEASE.md. Never weaken deny-all client Firestore rules to customize the app.

### AI and notification services

GEMINI_API_KEY stays in Secret Manager; GEMINI_MODEL is server configuration. VITE_FIREBASE_VAPID_KEY and VITE_FIREBASE_APPCHECK_KEY are public browser identifiers configured by deployment. The browser must be rebuilt for VITE changes; never put Gemini or ingestion secrets in VITE variables.

### Dynatrace and releases

DYNATRACE_API_TOKEN is a protected server/workflow secret; DYNATRACE_TENANT_URL selects the approved ingestion tenant. VITE_ENABLE_RUM controls loading the approved browser tag. Approved live members use verified-email RUM tags; backend actors remain hashed and Replay stays disabled. Retention/consent and tenant query permissions are managed in Dynatrace separately.

### Safe customization procedure

Use synthetic data to test changed fields, options, scopes and reminder rules. Save with the current version; if another admin changed the record, reload before retrying. Do not rewrite historical data or rotate project secrets through the UI. Export/report files are private local files, not public documentation assets.

See [setup](SETUP.md), [API contracts](API.md), [reports](REPORTS.md), [intelligence](INTELLIGENCE.md), [security](../SECURITY.md) and [release checks](RELEASE.md) for detailed procedures. This file is generated from settings-reference.json and the shared UI section catalog; run npm run docs:settings after changes.
