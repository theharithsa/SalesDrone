# SalesDrone skill tree

Machine-readable source: [skill-tree.json](skill-tree.json). Generated from module skills and skills/intent-map.json. Load the shared contract and relevant module; load release readiness for every feature or version release. Routing is advisory, not permission to spawn agents or deploy.

- [salesdrone-api-integrations](skills/salesdrone-api-integrations/SKILL.md) — swagger, openapi, personal access token, api key, api scopes.
  Related: salesdrone-release, salesdrone-authentication, salesdrone-people-permissions, salesdrone-data-platform.
- [salesdrone-authentication](skills/salesdrone-authentication/SKILL.md) — google login, sign in, authentication, app check.
  Related: salesdrone-release, salesdrone-people-permissions, salesdrone-api-integrations, salesdrone-interface.
- [salesdrone-automatic-reminders](skills/salesdrone-automatic-reminders/SKILL.md) — automatic reminder, note to task, gemini follow-up.
  Related: salesdrone-release, salesdrone-conversations, salesdrone-tasks-reminders, salesdrone-notifications, salesdrone-workspace-settings.
- [salesdrone-book-mode](skills/salesdrone-book-mode/SKILL.md) — book mode, kindle mode, serif workspace, reading mode, paper palette.
  Related: salesdrone-workspace-settings, salesdrone-observability, salesdrone-product-guide, salesdrone-release-readiness, salesdrone-release.
- [salesdrone-conversations](skills/salesdrone-conversations/SKILL.md) — call comment, lead note, timeline comment, call outcome.
  Related: salesdrone-release, salesdrone-leads, salesdrone-imports, salesdrone-automatic-reminders, salesdrone-tasks-reminders, salesdrone-lead-journey.
- [salesdrone-dashboard](skills/salesdrone-dashboard/SKILL.md) — dashboard, insights, funnel graph.
  Related: salesdrone-release, salesdrone-lead-scoring, salesdrone-leads, salesdrone-lead-journey, salesdrone-interface.
- [salesdrone-data-platform](skills/salesdrone-data-platform/SKILL.md) — firestore, index, transaction, cursor.
  Related: salesdrone-release, salesdrone-leads, salesdrone-imports, salesdrone-tasks-reminders, salesdrone-observability.
- [salesdrone-documentation](skills/salesdrone-documentation/SKILL.md) — readme, documentation, settings guide, screenshots.
  Related: salesdrone-release, salesdrone-interface, salesdrone-api-integrations, salesdrone-product-guide.
- [salesdrone-imports](skills/salesdrone-imports/SKILL.md) — excel import, csv import, xlsx import, spreadsheet mapping.
  Related: salesdrone-release, salesdrone-leads, salesdrone-conversations, salesdrone-workspace-settings, salesdrone-notifications.
- [salesdrone-interface](skills/salesdrone-interface/SKILL.md) — sidebar, mobile ui, typography, theme, responsive, navigation, sunrise sunset, mobile typography, type scale, design system, apple typography, wondel design, all screen sizes, desktop typography, laptop layout, tablet layout, wide screen, responsive audit.
  Related: salesdrone-release, salesdrone-authentication, salesdrone-workspace-settings, salesdrone-notifications, salesdrone-dashboard, salesdrone-book-mode.
- [salesdrone-lead-journey](skills/salesdrone-lead-journey/SKILL.md) — lead journey, stage flow, transition history.
  Related: salesdrone-release, salesdrone-leads, salesdrone-workspace-settings, salesdrone-dashboard.
- [salesdrone-lead-scoring](skills/salesdrone-lead-scoring/SKILL.md) — lead score, scoring factor, qualification.
  Related: salesdrone-release, salesdrone-dashboard, salesdrone-workspace-settings, salesdrone-conversations, salesdrone-people-permissions.
- [salesdrone-leads](skills/salesdrone-leads/SKILL.md) — lead filter, edit lead, create lead, excel export, filtered report.
  Related: salesdrone-release, salesdrone-workspace-settings, salesdrone-conversations, salesdrone-lead-journey, salesdrone-imports, salesdrone-notifications.
- [salesdrone-notifications](skills/salesdrone-notifications/SKILL.md) — push notification, notification bell, read unread, fcm.
  Related: salesdrone-release, salesdrone-tasks-reminders, salesdrone-leads, salesdrone-authentication, salesdrone-interface.
- [salesdrone-observability](skills/salesdrone-observability/SKILL.md) — dynatrace, rum, telemetry, trace, metric, logs, bizevent, settings audit, audit logs, audit delivery.
  Related: salesdrone-release, salesdrone-data-platform, salesdrone-api-integrations.
- [salesdrone-people-permissions](skills/salesdrone-people-permissions/SKILL.md) — people access, permissions, assign lead, member role, assigned only.
  Related: salesdrone-release, salesdrone-authentication, salesdrone-leads, salesdrone-notifications, salesdrone-api-integrations.
- [salesdrone-product-guide](skills/salesdrone-product-guide/SKILL.md) — product handbook, user manual, feature walkthrough, faq, refresh screenshots.
  Related: salesdrone-documentation, salesdrone-interface, salesdrone-release-readiness.
- [salesdrone-release](skills/salesdrone-release/SKILL.md) — deploy, release, version, changelog, rollback.
  Related: salesdrone-data-platform, salesdrone-observability, salesdrone-documentation, salesdrone-api-integrations.
- [salesdrone-release-readiness](skills/salesdrone-release-readiness/SKILL.md) — pre-deployment, post-deployment, release checklist, feature completeness, release readiness.
  Related: salesdrone-release.
- [salesdrone-tasks-reminders](skills/salesdrone-tasks-reminders/SKILL.md) — edit task, delete task, manual reminder, snooze.
  Related: salesdrone-release, salesdrone-automatic-reminders, salesdrone-notifications, salesdrone-people-permissions.
- [salesdrone-workspace-settings](skills/salesdrone-workspace-settings/SKILL.md) — manage fields, lead fields, dropdown choices, settings, custom fields, book mode preference.
  Related: salesdrone-release, salesdrone-imports, salesdrone-leads, salesdrone-lead-scoring, salesdrone-people-permissions, salesdrone-api-integrations, salesdrone-book-mode.
