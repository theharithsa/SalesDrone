# Changelog

Application versions follow [Semantic Versioning](https://semver.org/).
API contract versions are independent from application versions.










## [1.6.1] - 2026-10-25

### Lead activity tabs (same-version maintenance)

- Default All view includes loaded activity, review information and your private lead tasks. Comments shows notes/imported discussions; new Calls tab shows logged calls only. Five-tab keyboard navigation, empty-state pagination and inline drafts remain available.
- Refresh the product guide, demo captures and module skills. Preserve the original release tag; bind this explicitly requested maintenance to its immediate base commit.

### Maintenance update — same version at the user’s request
- Left-align lead conversation cards and add an inline comment composer with tab-persistent drafts, blank/duplicate submission guards and safe idempotent retries.
- Guard stale activity pagination, route transitions, refresh failures, notification reloads and dismissed form completions.
- Improve long labels, Unicode avatar initials and blocked-storage fallbacks; verify desktop, phone and tablet browser layouts.
- Refresh documentation and screenshots; preserve the original v1.6.1 tag and identify this maintenance deployment by commit/run.

### Changed
- Keep first and last names horizontal on full lead pages; long names wrap without displacing company or stage.
- Adapt the identity header to narrow containers and refresh the handbook/README demo captures.

## [1.6.0] - 2026-10-25

### Changed
- Replace desktop inline lead details with a resizable overlay that leaves table geometry and columns unchanged.
- Add linkable full lead pages with readable comment cards, recipient-private paginated Tasks and actionable loaded-activity Review tabs.
- Add smooth desktop menu collapse, consistent icon cells and Documentation above Settings.
- Publish a searchable module-by-module product handbook with workflows, feature options, permissions, FAQs, service behavior and settings/API links.
- Add a product-guide skill and current-release screenshot verification; refresh affected public demo captures.
- Preserve existing API contract, task privacy, revision/history policy and safe observability.

## [1.5.1] - 2026-10-25

### Changed
- Make the desktop lead blade draggable from its left edge, with keyboard resizing, expand/restore and locally remembered width.
- Show the configured lead journey horizontally in wider blades while preserving actual stage-history semantics.
- Move stage and assignment above lead details/score into a header that remains visible while the blade body scrolls.
- Add a contained 180 ms desktop entrance and a mobile fade, respecting reduced motion and keeping pointer resizing immediate.
- Update feature/settings documentation, permission notes, module skills and release verification coverage.

## [1.5.0] - 2026-10-25

### Changed
- Group Lead fields and Dropdown choices under Manage fields, preserving deep links and Admin-only visibility.
- Publish a complete generated settings/environment reference linked from Settings and the public guide.
- Add a release-readiness skill, JSON/Markdown skill tree, versioned impact plans and stale-documentation gates.
- Verify live version, contract, protected API denial, function revisions and published documentation after deployment.
- Probe real Dynatrace OTLP metrics/traces/logs and validate deployment BizEvent/marker acceptance with sanitized CI evidence and negative tests.

## [1.4.0] - 2026-10-25

### Changed
- Add filtered, selected-column Excel reports from Leads, including all matching pages and custom field labels.
- Add admin Reports & lead access controls for export availability and workspace-wide assigned-only access for non-admins (default on).
- Apply current policy to APIs, report cursors, dashboard inference and reminder/notification workers; invalidate stale client data.
- Use explicitly approved live-member emails as Dynatrace RUM user tags, retain anonymous demo users and hashed backend actors, and handle late RUM script readiness.
- Publish versioned report/settings APIs, scoped token access, documentation and updated module skills.

## [1.3.0] - 2026-10-25

### Changed
- Add workspace-selectable manual or automatic dashboard insights. Automatic mode hides the button, reuses caches and requests once per dashboard visit.
- Group Dashboard insights, Automatic reminders and Lead scoring under expandable AvinyaIntelligence settings, with a grouped mobile selector.
- Preserve existing AI guidance and older clients; expose only the safe mode to dashboard readers.
- Require meaningful affected-module skill updates on every published change through CI.

## [1.2.0] - 2026-10-25

### Changed
- Replace the large dashboard action with a compact Get insights control in the card header, with a mobile touch target and on-demand generation.
- Add Admin-only AI personalization with default fallback, versioned API, cache invalidation, stale-generation protection and privacy-safe audit metadata.
- Allow Admins to rename built-in lead field labels across entry, tables, details, filters and import mapping without changing stored keys or validation.
- Publish OpenAPI 1.10.0 with 49 operations and extend domain/emulator coverage and module guidance.

## [1.1.5] - 2026-10-25

### Changed
- Use the supplied Avinya artwork and its original lettering/colours in light mode, with a white ink rendering in dark mode. Preserve the SalesDrone logo and responsive header.
- Generate dashboard AI summaries only when requested; prevent duplicate clicks, preserve existing summaries on chart refresh, and show the summary snapshot time.
- Use Google Sans for lead first names in expanded details and update the module guidance.

## [1.1.4] - 2026-10-25

### Changed
- Add 18 repository-local module skills with source, API ownership, invariants, diagnosis, tests and deployment guidance for future agents.
- Share policy and release boundaries, expose project skill discovery, and validate metadata, links and ownership of all 47 API operations in CI.

## [1.1.3] - 2026-10-25

### Changed
- Illustrate the About story and README with an original sketch connecting each enquiry, conversation and next step. Keep the image responsive and readable in both themes.
- Add linked Firebase, React, TypeScript, Node.js and Gemini badges; review README setup, import wording, release instructions and the actual SVG chart stack.

## [1.1.2] - 2026-10-25

### Changed
- Tell the SalesDrone story in Settings → About: the familiarity of Excel, the challenge of keeping lead conversations and follow-ups together, the small teams it serves, AI as a starting point, and our mission and internal-use beginnings.
- Present the story with readable typography, a mission callout and responsive spacing.

## [1.1.1] - 2026-10-25

### Changed
- Align all ten guide navigation entries and section headings, including Overview and API integrations. Generate matching numbers from document order and reject mismatched anchors during the documentation build.
- Add linked README badges for the deployment workflow, latest release, MIT licence, public documentation and OpenAPI portal.

## [1.1.0] - 2026-10-24

### Changed
- Add admin-only Personal Access Tokens under Settings → Developer settings, with explicit data scopes, one-time display, hashed credentials, 7/30/90-day expiry, revocation, owner-policy checks and request limits.
- Publish a self-hosted Swagger API portal at /api/docs with all 47 supported operations, per-operation authentication/scopes and complete request/response schemas.
- Document API integration, scoped CRUD examples, concurrency, idempotency, security and token lifecycle. Add independent contract and emulator coverage for integration credentials.
- Keep token management, identity, device administration, workspace security and AI generation Google/App Check-only. Preserve manual reminders and existing browser authentication.
- Include the Firebase CLI App Engine service-account preflight permission in repeatable deployment provisioning.

## [1.0.0] - 2026-10-25

First versioned SalesDrone release by AvinyaTech, part of Avinya Enterprises.

### Added
- Google sign-in, protected admins, permission-managed live access and isolated demo.
- Excel/CSV import with multiple comment columns and resumable chunk commits.
- Enquiry fields, filters, call history, note revisions, assignments and custom fields.
- Manual reminders, Gemini note-driven scheduling, push notifications and read/unread inbox.
- Responsive charts, a stage-count funnel, recorded lead journeys and a notification overlay.
- Gemini dashboard briefs and evidence-linked, admin-configurable lead scores.
- OpenTelemetry traces/logs/metrics, committed business-event outbox and Dynatrace RUM.
- GitHub CI/CD with keyless Firebase deployment and Dynatrace release reporting.
- Illustrated product guide, technical/security/release documentation and demo screenshots.
