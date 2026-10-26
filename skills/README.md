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

| Skill                                                                     | Responsibility                          |
| ------------------------------------------------------------------------- | --------------------------------------- |
| [salesdrone-authentication](salesdrone-authentication/SKILL.md)           | Authentication                          |
| [salesdrone-people-permissions](salesdrone-people-permissions/SKILL.md)   | People and permissions                  |
| [salesdrone-leads](salesdrone-leads/SKILL.md)                             | Lead service                            |
| [salesdrone-conversations](salesdrone-conversations/SKILL.md)             | Conversations and call timeline         |
| [salesdrone-lead-journey](salesdrone-lead-journey/SKILL.md)               | Lead journey                            |
| [salesdrone-imports](salesdrone-imports/SKILL.md)                         | Workbook and CSV imports                |
| [salesdrone-tasks-reminders](salesdrone-tasks-reminders/SKILL.md)         | Tasks and reminder delivery             |
| [salesdrone-notifications](salesdrone-notifications/SKILL.md)             | Notification service                    |
| [salesdrone-automatic-reminders](salesdrone-automatic-reminders/SKILL.md) | AI automatic reminders                  |
| [salesdrone-lead-scoring](salesdrone-lead-scoring/SKILL.md)               | Lead scoring and qualification          |
| [salesdrone-dashboard](salesdrone-dashboard/SKILL.md)                     | Dashboard and AI insights               |
| [salesdrone-workspace-settings](salesdrone-workspace-settings/SKILL.md)   | Workspace fields and preferences        |
| [salesdrone-api-integrations](salesdrone-api-integrations/SKILL.md)       | API platform and personal access tokens |
| [salesdrone-data-platform](salesdrone-data-platform/SKILL.md)             | Firestore data platform                 |
| [salesdrone-observability](salesdrone-observability/SKILL.md)             | Application observability               |
| [salesdrone-interface](salesdrone-interface/SKILL.md)                     | Interface and demo shell                |
| [salesdrone-documentation](salesdrone-documentation/SKILL.md)             | Public documentation and illustrations  |
| [salesdrone-release](salesdrone-release/SKILL.md)                         | Release and deployment                  |

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
