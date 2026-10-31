# SalesDrone module skills

Start with [skill-tree.json](../skill-tree.json) or [skill-tree.md](../skill-tree.md) for prompt routing. Every feature/setting release uses [release readiness](salesdrone-release-readiness/SKILL.md) with its domain owner.

These are logical service playbooks for the existing modular application, not
independently deployed microservices. The backend is one Firebase Functions codebase
with an HTTP API and four scheduled exports. A future agent should load the relevant
skill and the shared contract before changing its module.

Canonical skills live here. `.agents/skills` points to this directory for project
skill discovery; a new session may be needed to refresh a tool's skill catalog.
Without catalog discovery, explicitly ask the agent to read the linked SKILL.md.
Nothing is installed into a user's global skill directory.

## Module catalog

<!-- module-catalog:start -->
| Skill | Responsibility |
| --- | --- |
| [salesdrone-api-integrations](salesdrone-api-integrations/SKILL.md) | Maintain SalesDrone scoped Personal Access Tokens, versioned OpenAPI/Swagger portal and HTTP integration policy. Use for external API contracts and token lifecycle; domain behavior stays with its module skill. |
| [salesdrone-attachments](salesdrone-attachments/SKILL.md) | Maintain SalesDrone private lead files in Firebase Storage, authenticated upload/download APIs, quotas, expiry and cleanup. Use for lead attachments and Files tab issues; batch lead edits belong to leads. |
| [salesdrone-authentication](salesdrone-authentication/SKILL.md) | Maintain SalesDrone Google sign-in, App Check, session bootstrap and demo isolation. Use for login failures or identity verification; membership administration belongs to people-permissions. |
| [salesdrone-automatic-reminders](salesdrone-automatic-reminders/SKILL.md) | Maintain SalesDrone Gemini extraction of dated follow-ups from new lead notes/call comments, review states and Edit/Undo. Use for notes not becoming tasks; manual reminders belong to tasks-reminders. |
| [salesdrone-book-mode](salesdrone-book-mode/SKILL.md) | Maintain SalesDrone Book mode typography, paper palettes, personal preference and responsive reading UI. Use for Book mode or Kindle-style requests; general shell work belongs to interface. |
| [salesdrone-conversations](salesdrone-conversations/SKILL.md) | Maintain SalesDrone lead notes, call outcomes, discussion imports and revision-preserving corrections. Use for timeline/call changes; reminder extraction is owned by automatic-reminders. |
| [salesdrone-dashboard](salesdrone-dashboard/SKILL.md) | Maintain SalesDrone dashboard aggregates, charts, current-stage funnel and grounded Gemini outreach briefs. Use for analytics/visualization and insight issues; per-lead scoring belongs to lead-scoring. |
| [salesdrone-data-platform](salesdrone-data-platform/SKILL.md) | Maintain SalesDrone store adapters, transaction behavior, cursor/query infrastructure, indexes and deny-all client rules. Use for data-layer changes; domain schema and records remain owned by feature skills. |
| [salesdrone-documentation](salesdrone-documentation/SKILL.md) | Maintain SalesDrone README, public guide, technical docs, demo screenshots and illustration provenance. Use for documentation changes; API schema and release machinery have their own skills. |
| [salesdrone-imports](salesdrone-imports/SKILL.md) | Maintain SalesDrone first-sheet XLSX/CSV mapping, multiple comment columns, preview, bounded chunk commit and recovery. Use for ingestion issues; ordinary enquiry forms belong to leads. |
| [salesdrone-interface](salesdrone-interface/SKILL.md) | Maintain SalesDrone Material 3 responsive shell, typography, themes, accessible overlays and synthetic demo adapters. Use for cross-module UI and design work; business logic stays with its owning module. |
| [salesdrone-lead-journey](salesdrone-lead-journey/SKILL.md) | Maintain SalesDrone recorded stage transitions and current-stage journey UI. Use for flow/history changes; aggregate funnel and lead mutations belong to dashboard and leads. |
| [salesdrone-lead-scoring](salesdrone-lead-scoring/SKILL.md) | Maintain SalesDrone configurable Fit, Intent and Red-flag factors, grounded evidence extraction, deterministic scores and refresh workers. Use for scoring changes; dashboard brief prose belongs to dashboard. |
| [salesdrone-leads](salesdrone-leads/SKILL.md) | Maintain SalesDrone enquiry capture, editing, filtering, deduplication, assignment, suppression and archive behavior. Use for lead data changes; conversations, imports and journey history have separate skills. |
| [salesdrone-notifications](salesdrone-notifications/SKILL.md) | Maintain SalesDrone owner-only inbox, read/unread state, lead-assignment alerts, FCM registration and notification overlay. Use for push/inbox/overlay bugs; task scheduling belongs to tasks-reminders. |
| [salesdrone-observability](salesdrone-observability/SKILL.md) | Maintain SalesDrone Dynatrace RUM, OpenTelemetry signals, committed business-event outbox and release reporting. Use for instrumentation changes; tenant investigations may use specialist Dynatrace tooling. |
| [salesdrone-people-permissions](salesdrone-people-permissions/SKILL.md) | Maintain SalesDrone invitations, member roles, capabilities, assigned scope and protected admin rules. Use for granting/revoking workspace access; Google login mechanics belong to authentication. |
| [salesdrone-product-guide](salesdrone-product-guide/SKILL.md) | Write SalesDrone module workflows, feature options, troubleshooting and FAQs; refresh reviewed synthetic screenshots after UI changes. Use for the user handbook and visual documentation, not API contract ownership or release authorization. |
| [salesdrone-release](salesdrone-release/SKILL.md) | Release SalesDrone modules through SemVer, GitHub Actions, Firebase and GitHub Pages with deployment evidence. Use for publishing or rollback; a module skill alone does not authorize production actions. |
| [salesdrone-release-readiness](salesdrone-release-readiness/SKILL.md) | Review SalesDrone feature and setting changes for complete docs, skills, API permissions, Dynatrace signals, tests and pre/post-deployment evidence. Use alongside the owning module for every release; publication still requires user authorization. |
| [salesdrone-tasks-reminders](salesdrone-tasks-reminders/SKILL.md) | Maintain SalesDrone manual tasks, edits, snooze/completion, soft deletion and scheduled reminder dispatch. Use for due-task and delivery eligibility issues; note interpretation belongs to automatic-reminders. |
| [salesdrone-testing](salesdrone-testing/SKILL.md) | Test SalesDrone features and regressions using module cases, unit/API checks, Auth/Firestore emulators and approved-browser UI checks. Use for test execution and evidence; release authorization remains separate. |
| [salesdrone-workspace-settings](salesdrone-workspace-settings/SKILL.md) | Maintain SalesDrone configurable field definitions/dropdowns, field retirement, personal preferences and sectioned Settings UI. Use for settings changes; member grants, scoring factors and tokens belong to their own skills. |
<!-- module-catalog:end -->

## Working with one module

Example: “Use $salesdrone-notifications to diagnose background push failures.
Keep inbox privacy, read state and failed-device retry behavior; verify with synthetic
data, then report which exports and tests are affected.”

For shared changes, read adjacent owners only as needed. Use the API ownership
sections to route endpoint work; the validator checks that every current operation
has exactly one primary owner. Domain skills link the shared contract rather than
copying an entire security/release manual into every context.

## Coordinating several agents later

Assign each agent a module, concrete acceptance criteria and an allowed file set.
The requesting user must authorize delegation; this catalog does not authorize
spawning agents, messaging other chats, deploying, issuing tokens or changing access.
Use one integrator for shared app.js/contracts.js/policy.js/index.js, App.tsx,
types, indexes, OpenAPI generation, version files and CI. Agree ownership before
concurrent edits to these files. Agents return patches/evidence and compatibility
notes; the integrator resolves overlaps, validates once and publishes one release.

Do not turn modules into separate databases/functions/services without an explicit
architecture task: transaction boundaries, scopes and outboxes cross these domains.

## Validation

Run `npm run skills:check`. It validates entry points, metadata, relative links,
project discovery and full OpenAPI ownership coverage. When the skill-creator skill
is installed, also run its `scripts/quick_validate.py` against each module folder.
Neither structural check proves behavioral quality: verify playbooks against current
source/tests when using or changing them.

- [salesdrone-release-readiness](salesdrone-release-readiness/SKILL.md): cross-module feature completion and honest pre/post-deployment checks.

- [Product handbook and screenshot maintenance](salesdrone-product-guide/SKILL.md): current workflows, FAQs and reviewed captures after UI changes.

[Book mode](salesdrone-book-mode/SKILL.md) owns the complete serif reading style and paper palettes; workspace settings retains primary ownership of /me preferences.

Design references shared with other agents: [Wondel Design & UX installation and licence](WONDEL-SOURCE.md). SalesDrone-specific principles remain in [interface](salesdrone-interface/SKILL.md) and [DESIGN-SYSTEM.md](../docs/DESIGN-SYSTEM.md).

[Testing and regression handoff](salesdrone-testing/SKILL.md) routes testers to module cases, the CLI suites and separate browser evidence.

- [Lead attachments](salesdrone-attachments/SKILL.md): private Firebase Storage files, binary APIs and cleanup.

On Windows, enable Developer Mode and repository-local `core.symlinks=true` before checkout. `skills:check` detects a text-file checkout and prints repair commands; it never overwrites files or changes Git settings.

Entrypoints have a 110-line / 8500-byte budget and no release-labelled headings. Put conditional recipes in `references/` and release history in CHANGELOG. `skills:tree` generates the complete catalog above.
