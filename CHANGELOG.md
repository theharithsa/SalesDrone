# Changelog

Application versions follow [Semantic Versioning](https://semver.org/).
API contract versions are independent from application versions.


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
