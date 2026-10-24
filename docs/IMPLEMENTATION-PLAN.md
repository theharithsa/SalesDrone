# SalesDrone by AvinyaTech (Part of Avinya Enterprises)

Application structure and implementation plan.

Planning date: 24 October 2026. Status: implemented locally following user authorization. See VERIFICATION.md for test evidence and SETUP.md for remaining production configuration; production resources were not changed.

## 1. Confirmed scope

- A shared SDR workspace using Google sign-in, with admin-managed membership and permissions.
- Initial bootstrap administrators: `spraghav@gmail.com` and `theharithsa@gmail.com`, with equal admin permissions. Other users receive live access only when either administrator grants it.
- Signed-in users without live permissions see an isolated demo with synthetic data.
- Initial leads enter through an Excel workbook import of approximately 1,000 records; subsequent leads are saved automatically from the application's lead-entry form when submitted.
- Track lead details, sales stages, individual call outcomes, notes, and next actions.
- User-created reminders with an in-app inbox and optional push notifications.
- Firebase Authentication, Cloud Firestore, Firebase Hosting, Cloud Functions, and Firebase Cloud Messaging.
- Responsive, Apple-inspired interface for Mac, other laptops, tablets, and phones.
- Implementation was explicitly authorized after planning; deployment remains a separate release step.

Not in the first release: CRM integrations, external/public form integrations, automatic lead sourcing, an in-app dialer, call recording/transcription, email sequences, SMS, native App Store applications, or AI scoring. Future integrations should enter through the same API and business rules as the UI. Lead assignment and scoped user permissions are in scope.

Branding: display `SalesDrone by AvinyaTech` on sign-in, onboarding, and Settings, with `Part of Avinya Enterprises` beneath it. Compact navigation may use `SalesDrone`; page titles, install metadata, and suitable notification branding retain AvinyaTech attribution. No logo has been supplied; do not invent an official corporate logo.

## 2. Core workflow

Admin signs in → imports and reviews the initial Excel workbook → assigns leads and grants user permissions → approved users submit the lead-entry form for new enquiries → open lead → initiate a call with a phone link or call externally → manually log outcome and notes → optionally change sales stage → set next action and reminder → return to Today.

Automatic entry means a successful form submission immediately creates a validated lead in Firestore and updates the list/Today view, without editing or reimporting a spreadsheet. Do not create incomplete leads on every keystroke. Show a saved confirmation with a link to the new lead; retries use the same submission identity. The planned form is internal to this application. A public website form or Google Forms connection requires a separately defined ingestion integration.

Launching a phone link does not establish that a call happened, and cannot report connection status or duration. Those fields remain manual until a telephony integration exists.

Keep three independent concepts:

| Concept | Initial values | Meaning |
| --- | --- | --- |
| Lead stage | New, Working, Qualified, Meeting booked, Nurture, Disqualified | Current sales progress |
| Call outcome | Connected, No answer, Busy, Voicemail, Wrong number, Failed | Result of one call attempt |
| Task state | Pending, Completed, Cancelled | State of a follow-up; overdue is derived from due time |

Interest, callback request, and do-not-contact are explicit dispositions/flags alongside call outcome. For example, a connected call may have the disposition Not interested. A no-answer attempt should never erase an earlier qualification.

Do-not-contact is a lead-level suppression flag with a reason and timestamp. It blocks call actions and new outreach tasks, and cancels pending outreach reminders. General administrative tasks remain possible. Wrong number flags the phone for correction without automatically disqualifying the person.

## 3. Screens and navigation

| Screen | Main purpose | Primary actions |
| --- | --- | --- |
| Sign in | Google authentication and server-resolved live/demo mode | Continue with Google |
| Initial setup | Admin imports the existing workbook | Select sheet, map columns, review, import |
| Today | Overdue tasks, today's follow-ups, new leads, recent activity | Complete task, open lead, add reminder |
| Leads | Paginated lead list with stage/source/assignee/tag filters and sorting | New enquiry form, import Excel, search, open lead |
| Lead detail | Contact information, stage, timeline, upcoming tasks | Call, log call, add note, set follow-up |
| Tasks | Today, Upcoming, Overdue, Completed, plus standalone reminders | Complete, reschedule, cancel |
| Notifications | Persistent reminder inbox with read state | Open task/lead, mark read |
| Settings | Profile, timezone, appearance, notification devices | Enable push, test notification, revoke device |
| Users and permissions | Admin manages live access and assignments | Grant/edit/revoke permissions, assign leads |
| Demo workspace | Synthetic examples using the regular responsive layouts | Explore, locally simulate edits, reset demo |

Today is the launch screen. Avoid a dashboard dominated by charts; the product's first job is showing whom to contact next.

Lead fields include all columns in the supplied image (mapping below), plus job title, optional email, phone country code, assignedToUid, tags, optional website, contact timezone, suppression flag, creation/update timestamps, and last contact time. Next follow-up and last call outcome are server-maintained summaries backed by task/activity records.

Activity timeline: call attempts, notes, stage changes, task events, and import provenance. Corrections to calls retain revision history rather than silently rewriting the past.

Initial reporting stays small: call attempts and connected calls by date, leads by stage, and tasks completed/overdue. A connected-call rate is connected attempts divided by call attempts in the selected period; no invented revenue or conversion metrics.

## 4. Apple-inspired responsive interface

Design source: `/Users/theharithsa/.agents/skills/apple-design/SKILL.md`.

- Desktop: restrained sidebar, compact toolbar, useful table density, and a lead inspector beside the list when space permits.
- Tablet: collapsible sidebar and list/detail split where both panes remain usable.
- Mobile: bottom navigation for Today, Leads, and Tasks; Notifications/Settings through clearly labelled secondary navigation. Full-screen lead details and sheets for short forms. Tables become readable contact rows.
- Breakpoints follow content fit, approximately under 768px, 768–1199px, and 1200px upward; test narrow devices and large text rather than trusting breakpoints alone.
- System fonts, near-neutral surfaces, one accent color, light/dark/system themes, subtle separators, and readable status labels. Color never carries state alone.
- Use translucency selectively for navigation and overlays; keep dense content surfaces solid enough for clear reading.
- Minimum 44×44 CSS-pixel primary touch targets, visible focus, semantic controls, keyboard navigation, safe-area padding, and forms that tolerate text enlargement and the mobile keyboard.
- Immediate press feedback. Restrained interruptible springs for panels (roughly 0.3–0.4-second response), with bounce reserved for momentum gestures. No decorative looping motion.
- Honor reduced motion, reduced transparency, and increased contrast. Every swipe action also has a visible button/menu alternative.
- Support Cmd/Ctrl+K quick navigation and an accessible keyboard shortcut reference; do not override typing or browser shortcuts.
- Forms show saving/saved/error states; preserve unsaved notes through transient errors. A failed save must never look successful.

Visual acceptance comes from a local interactive prototype during implementation: Today, Leads, Lead detail, and Log call at desktop and phone sizes before expanding the rest of the UI.

## 5. Technical architecture

Proposed stack: React + TypeScript + Vite, React Router, accessible UI primitives with custom styling, and a small motion library where interaction needs it. A client-rendered app suits this private workspace; server rendering is unnecessary for the initial scope.

```text
Responsive web app / installable PWA
  ├─ Firebase Authentication → Google identity
  └─ /api/v1/* → Firebase Hosting rewrite → HTTPS Cloud Function
                       ├─ shared authorization / validation / services
                       ├─ Cloud Firestore
                       └─ reminder dispatch records

Cloud Scheduler → reminder worker → Firestore inbox + FCM → device service worker
```

Use Firebase Hosting for the frontend, not Firebase App Hosting. A root service worker handles push and the application shell. API responses and private lead data are excluded from service-worker caching. No persistent offline CRM database in version one; show a clear offline state and retain only short-lived in-memory unsaved form state.

All business reads/writes go through a versioned HTTP API. The browser uses Firebase SDKs for authentication and messaging. Deny direct client access to Firestore; server services enforce authorization because Admin SDK access bypasses Firestore rules.

This follows the user's previously stated API-first preference. No MCP adapter or integration is in the first release.

## 6. Authentication and authorization

- Enable Google as the only login provider and configure the deployed app's authorized domains.
- Initial admins are exactly `spraghav@gmail.com` and `theharithsa@gmail.com`, with equal admin permissions. Trusted bootstrap independently verifies each Google-provider identity with a verified matching email and binds each Firebase UID as an administrator. Never trust a typed email, an arbitrary first login, or a client-provided role. Promotion of additional admins is outside the initial scope.
- Every live API request verifies the Firebase ID token and checks active server-side workspace membership, capabilities, and record scope. Unapproved users are authenticated demo users; they do not get a live workspace membership by signing in.
- The admin may grant access to another verified Google account via an email-bound invitation; acceptance requires the matching verified identity and then binds the UID. Revocation/suspension takes effect on subsequent server requests and reminder dispatches without relying solely on cached token claims.
- Invitations are records shown in the app; sending invitation emails is not part of this plan. No user should receive live access by matching an unverified email.
- Permissions are explicit capabilities with presets: Viewer (read permitted leads/activity), SDR (read, create, edit and log calls/tasks within scope), and Admin (all live records, imports, assignments and user management). Admin may customize capabilities. Non-admins cannot change roles, grants, or assignment scope.
- Default non-admin scope is assigned leads; admin can explicitly grant all-lead scope. New leads created by an SDR are assigned to that SDR. Initial imports are unassigned/admin-visible until assigned. Personal standalone tasks are private to their creator; lead-linked tasks follow lead access and recipient permissions.
- Store company data under a workspace ID, not an employee UID. Check membership and assignment for lists, counts, search, detail, exports, imports and notifications; filtering hidden records in the browser is insufficient.
- Demo mode uses a bundled synthetic dataset and local/session simulation. It cannot query live collections, commit imports, send real notifications, or invoke real calls/emails. Label it persistently `Demo — sample data`; synthetic contacts use safe example values.
- Resolve live/demo mode server-side. A client toggle cannot grant live access. Demo-to-live transitions clear demo state; logout, user switch and access revocation clear live queries and drafts. Never copy demo edits into the live workspace automatically.
- Use App Check as an additional abuse control, with explicit verification on custom HTTP endpoints; it does not replace identity or permissions.
- Device registration and reminder deep links require active live authorization. Devices/inbox entries are user-scoped. Dispatch rechecks membership, task recipient, and lead access; revocation/reassignment prevents subsequent delivery to an ineligible user. Sign-out removes that device's notification association before ending the session where possible.
- Rate-limit mutations/imports, validate all fields server-side, restrict CORS, and avoid contact information in application logs.

## 7. Firestore model

Company root: `workspaces/{workspaceId}` with scoped collections. Personal root: `users/{uid}` for profile/preferences, devices, and inbox. Workspace data persists when an employee's access is revoked.

| Collection | Important fields |
| --- | --- |
| `members` | uid, verified email, active state, capabilities, lead scope, grant audit metadata |
| `invitations` | verified-email target, intended permissions/scope, expiry, accepted UID, revocation |
| `leads` | contact fields, serial reference, location, zone/sector, enquiry date, original status/comments, assignedToUid, normalized phone/email, stage, tags, suppression, summary fields, version |
| `activities` | leadId, type, call outcome/disposition, notes, occurredAt, createdAt, actorUid, revision |
| `tasks` | optional leadId, creatorUid, recipientUid, title, kind, dueAt, timezone, state, completedAt, reminder revision |
| `reminderDeliveries` | taskId, revision, scheduledAt, state, leaseUntil, attemptCount, nextAttemptAt |
| user `notifications` | workspaceId, taskId, deliveryId, createdAt, readAt, safe deep-link target |
| user `devices` | installation identifier/registration, platform label, enabled, lastSeenAt |
| `imports` | mapping, row counts, validation results, import status and idempotency identity |
| `dedupeKeys` | normalized contact hashes mapped to lead IDs for transactional duplicate checks |
| `auditEvents` | actor, action, target ID, timestamp, safe change metadata and request ID |

User document stores timezone, appearance, notification preferences, and schema version. Workspace config stores branding and the bootstrap admin UIDs. Do not store authoritative permissions in client-editable profile fields. Use server timestamps for writes and UTC instants for scheduling; retain the selected IANA timezone for display and unambiguous edits. Default to the device timezone, initially expected to be Asia/Kolkata, but allow changes. Explicitly handle nonexistent/ambiguous times at daylight-saving transitions. Store an imported date-only enquiry date as a date, without inventing a time.

Lists use bounded pages and stable cursors. Index known queries such as stage/update time and pending task/due time; reminder scans use bounded indexed collection-group queries. Do not load an entire lead collection into the browser to filter it.

Initial search is deliberately bounded: exact normalized email/phone and prefix search on one selected field (name or company). Do not promise arbitrary fuzzy/full-text search in this scope. Revisit search technology only when requirements demand it.

## 8. API contract boundaries

| Routes | Purpose |
| --- | --- |
| `GET /api/v1/me` | Profile, live/demo mode, and effective permissions; no live business data for demo users |
| `PATCH /api/v1/me` | Update approved preference fields |
| `GET, POST /api/v1/leads` | Scope-filtered list and automatic creation from submitted enquiry form |
| `GET, PATCH /api/v1/leads/:id` | Lead detail and allowed edits |
| `POST /api/v1/leads/:id/archive` | Archive lead and cancel pending outreach |
| `GET, POST /api/v1/leads/:id/activities` | Timeline, call logging, and notes |
| `POST /api/v1/activities/:id/corrections` | Audited correction |
| `GET, POST /api/v1/tasks` | List and create lead-linked or standalone tasks |
| `PATCH /api/v1/tasks/:id` | Complete, reschedule, or cancel |
| `POST /api/v1/imports/preview`, `POST /api/v1/imports/:id/commit` | Admin-only Excel/CSV validation and reviewed import |
| `GET /api/v1/members`, `POST /api/v1/invitations` | Admin-only user access listing and email-bound grants |
| `PATCH /api/v1/members/:uid`, `DELETE /api/v1/invitations/:id` | Admin-only permission/scope changes, suspensions, invitation revocation |
| `POST /api/v1/invitations/:id/accept` | Matching verified identity accepts its invitation |
| `PATCH /api/v1/leads/:id/assignment` | Admin-only assignment with access/reminder updates |
| `GET /api/v1/notifications`, `PATCH /api/v1/notifications/:id` | Inbox and read state |
| `POST /api/v1/devices`, `DELETE /api/v1/devices/:id` | Register/revoke push device |
| `POST /api/v1/devices/:id/test` | Rate-limited test push to an owned device |
| `GET /api/v1/summary` | Bounded period activity summary |

Define OpenAPI schemas before implementation: required fields, enums, size limits, allowed filters/sorts, cursor rules, and structured errors. Use 400 for invalid requests, 401 for missing/invalid identity, 403 for denied access, 404 for unavailable resources, 409 for duplicates/stale versions, and 429 for throttling. Set no-store on private responses.

Mutations use request IDs and idempotency keys for retryable creates/imports. Updates require an expected version to avoid overwriting newer changes. Logging a call with a stage change and next task is one atomic operation, including summaries, reminder records, and audit events. Retry must not create a second call or task.

## 9. Excel onboarding and ongoing form entry

The attachment is a blank table/header reference, not the actual workbook or 1,000 records. Use these exact observed headers as the default mapping; validate real data formats against the workbook during implementation/onboarding.

| Supplied header | App field | Import/form treatment |
| --- | --- | --- |
| Sl No | Legacy serial reference | Preserve for traceability; generate an independent lead ID |
| Enq Source | Enquiry source | Controlled options with admin-managed additions |
| Customer Name | Customer name | Required for new form submissions |
| Contact No. | Phone | Preserve as text, including leading zeros and country code |
| Company Name | Company | Optional when not known |
| Location, City | Location/city | Preserve original; do not guess a split |
| Zone / Sector | Zone/sector | Preserve combined field pending real-data review |
| Enq Date | Enquiry date | Date-only field; distinguish from import/creation time |
| Status | Legacy status plus mapped lead stage | Preview distinct values and approve mapping; preserve original |
| Comments | Legacy comments / initial note | Preserve verbatim with import provenance |

Initial setup workflow: admin uploads `.xlsx` → select worksheet/header row → auto-suggest this column mapping → preview rows and distinct statuses → resolve validation/duplicate/date issues → confirm → import in chunks → reconcile totals. Support CSV as an alternative. Legacy `.xls` should be converted to `.xlsx` for the first release. Offer a downloadable template and a Skip for now option.

Plan for approximately 1,000 existing records with headroom: proposed maximum 5,000 rows and 10 MB per workbook, enforced before expensive parsing; both are product limits. Bound worksheets, cell lengths, decompressed content and worker time. Ignore blank/template rows; never evaluate macros, formulas, links or embedded workbook objects. Flag formulas in mapped business fields for conversion to literal values rather than guessing results.

Phone cells are read as text where possible. If the workbook already lost leading zeros or phone precision, flag for review rather than reconstructing digits. Require explicit date interpretation for ambiguous strings (for example 03/04/2026), and honor the workbook's date system for numeric Excel dates. Unmapped statuses are reviewed or defaulted explicitly; do not infer historical calls, completion dates, or sales transitions from status/comments.

Ongoing New enquiry form: source, customer name, contact number, company, location/city, zone/sector, enquiry date, stage and comments, with optional email and assignment where authorized. Default date to today in the selected timezone and stage to New; default new SDR-created leads to that SDR. Name plus one valid contact method is required. Admin can approve incomplete legacy rows as Needs review with outreach disabled until corrected; no silent drops.

Submit validates and normalizes through the same API/service as imports, checks duplicates, saves the lead and initial comment atomically, and refreshes the scoped lead list. The form works on mobile with appropriate phone/date inputs. Provide Save and add another; preserve values on failure, and do not report success before the server confirms persistence.

MVP duplicate policy: skip duplicates and show the reason; no automatic merging or overwriting. Conflicting phone/email matches are flagged for review. Treat duplicate detection as a warning rather than assuming shared numbers always identify the same person. An explicit override creates a distinct record with an audit entry.

Commit references the server-validated preview; expired previews require revalidation. Workbook fingerprint, worksheet and row-level idempotency prevent accidental repeated onboarding imports; admin may explicitly start a new reviewed import. Transactional dedupe checks handle concurrent commits. Partial results remain visible and resumable, with reconciled imported/duplicate/invalid/blank/needs-review counts and a downloadable error report. Import access is admin-only initially; granting lead creation does not grant bulk import rights.

## 10. Reminders and push

Confirmed infrastructure decision: the user will enable Cloud Functions for reminders. Use a scheduled Cloud Function invoked by Cloud Scheduler to process due reminders and dispatch through Firebase Cloud Messaging. Enablement, billing, required APIs, and deployment access remain unverified until implementation; this confirmation does not request deployment.

- One-time reminders in the first release, attached to a follow-up task or a standalone task. Support custom date/time, complete, cancel, and snooze presets.
- Persist the task/reminder immediately. A scheduled server worker checks due records approximately once per minute; frontend timers are not the scheduler.
- Atomically claim work with an expiring lease and stable delivery ID; write one inbox item and record dispatch attempts. Retry transient failures with limits/backoff, recover expired leases, and prune invalid registrations.
- Recheck task state, lead suppression/access, and reminder revision immediately before dispatch. Rescheduling/cancelling invalidates older revisions. A push already handed to the delivery service cannot be recalled.
- Persist device-level dispatch results separately so one failed device does not force resending to every successful device. FCM acceptance is recorded as accepted, not proof that the person saw the notification.
- Assume at-least-once processing. Use stable inbox IDs and notification tags to reduce duplicates; do not promise exactly-once external push delivery.
- Notifications use generic lock-screen content by default, avoiding phone numbers, notes, and contact names. Clicking opens the authorized task or lead. Read and completed are separate states.
- In the foreground show one in-app notification; in the background use the service worker. Coordinate display paths to avoid showing the same message twice.
- Ask permission only after the user selects Enable notifications. Explain unsupported, denied, and revoked states and offer a test notification.
- Desktop/Android delivery depends on browser support, permissions, network, and OS policies. iPhone/iPad web push requires a supported OS (16.4+) and Home Screen installation. Feature-detect capabilities and verify on actual target devices.
- The in-app overdue list/inbox remains available without push. Reminders are best effort; the one-minute worker cadence is not an exact delivery deadline. Do not expire pending work silently during outages; resume due work and surface dispatch failures.
- Use current supported Firebase messaging registration APIs for the pinned SDK version. Keep the app's device model independent of a particular token/installation API.

Production requirements: HTTPS, messaging service-worker setup, Firebase web-push credentials/public VAPID key, relevant APIs enabled, and a billing-enabled Blaze project for Cloud Functions deployment. The supplied configuration does not establish these settings.

## 11. Proposed repository structure

```text
apps/web/src/
  app/                  # routing, layouts, auth guard, providers
  features/             # today, leads, enquiry-form, activities, tasks, imports, members, demo, notifications, settings
  components/           # accessible shared controls
  design/               # tokens, themes, responsive layout, motion
  lib/                  # Firebase auth/messaging, API client, dates
apps/web/public/        # manifest, icons, service-worker entry
functions/src/
  api/v1/               # route handlers
  auth/                 # token, admin bootstrap, membership/scope, and App Check verification
  domain/               # shared lead, activity, task, import, and permission policies
  repositories/         # Firestore access
  jobs/                 # reminder scan/claim/dispatch/recovery
  observability/        # audit, structured logs, metrics
packages/contracts/     # schemas and shared TypeScript types
tests/                  # API/emulator, authorization, reminder, browser flows
docs/                   # implementation plan, API contract, setup/runbook
firebase.json
firestore.rules
firestore.indexes.json
```

## 12. Implementation order and acceptance

1. Foundation: begin only on implementation request; pin dependencies; define contracts; scaffold local UI and Firebase emulators. Verify the named admin bootstrap, membership permissions, revocation and isolated demo mode. Build the branded responsive screen prototype.
2. Core workflow: submitted enquiry form, lead list/detail, assignment, activities, stage changes, and tasks. Verify submit once → one persistent lead → log call → schedule follow-up → complete task, including retries and stale edits.
3. Excel onboarding: sheet selection, header mapping, date/phone preservation, status mapping, duplicate review, commit, and summary. Verify a representative ~1,000-row fixture, invalid rows, conflicting matches, repeat upload, and partial import recovery. Validate the actual workbook separately when available.
4. Notifications: inbox, server worker, messaging service worker, device settings, and install guidance. Verify scheduling while the app is closed, reschedule/cancel, worker retries, foreground/background display, and sign-out on shared devices.
5. Release preparation: meaningful API/emulator tests, accessibility and responsive checks, production configuration review, and Firebase Hosting preview. Production deployment is a separate requested step.

Acceptance devices: Mac Safari and Chrome, a Windows Chromium browser, iPhone Safari/Home Screen app, iPad layout, and Android Chrome. Use emulators/automated browsers for coverage and actual hardware for push behavior; report any unavailable device verification explicitly.

Security checks: an unapproved Google account gets synthetic demo data only; it cannot fetch real records, counts, search results, imports or notifications through guessed URLs/direct API calls. Verify invitation identity binding, admin-only grants, assigned-lead scope, reassignment, immediate request-level revocation, and recipient checks at push dispatch. Direct Firestore access is denied; server-side Admin SDK paths all enforce policy; private API responses are not cached; logs and push previews omit lead PII. User switching clears private UI state.

Operational checks: bounded queries and imports, budget alerts, worker failure/lag monitoring, delivery outcome counts, service-worker update behavior, and basic recovery/export procedures. Analytics is optional and excludes lead PII; the supplied measurement ID is not a requirement to enable tracking.

## 13. Firebase project and remaining setup inputs

Target project from the supplied configuration: `sales-drone-avinya`; Google auth domain: `sales-drone-avinya.firebaseapp.com`. Keep the supplied web config intact when wiring the app; do not create a substitute project. No private admin credential was supplied or is needed in frontend code.

The public Firebase web configuration identifies the project, but does not prove that Google sign-in, Firestore, Hosting, messaging credentials, billing, API restrictions, or deployment permissions are configured. Verify those during implementation. Region selection should align Functions with the existing Firestore location; inspect before choosing because database location is a consequential setup decision.

The approved bootstrap emails are `spraghav@gmail.com` and `theharithsa@gmail.com`; their verified Firebase UIDs are resolved securely during setup. Remaining inputs are the actual Excel workbook for real-data validation, current Firestore region/existence, billing availability, web-push credentials, and deployment access. These do not block planning and should be resolved during implementation, without treating this plan as authorization to change production.

## 14. Official references checked

- Firebase web messaging requirements and setup: https://firebase.google.com/docs/cloud-messaging/web/get-started
- Apple Home Screen web push requirements: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- Scheduled Firebase functions: https://firebase.google.com/docs/functions/schedule-functions
- Functions setup and deployment requirements: https://firebase.google.com/docs/functions/get-started
- Firebase public API keys and authorization boundaries: https://firebase.google.com/docs/projects/api-keys
