---
name: salesdrone-workspace-settings
description: "Maintain SalesDrone configurable field definitions/dropdowns, field retirement, personal preferences and sectioned Settings UI. Use for settings changes; member grants, scoring factors and tokens belong to their own skills."
---

# Workspace fields and preferences

Read [the shared operating contract](../SHARED.md) before editing. Paths and commands
are relative to the repository root. Inspect current source rather than assuming
this map is an immutable schema or a standalone microservice.

## Responsibility and entry points

Admin field edit or personal preference → schema/ownership/version validation → persisted configuration → shared controls and filters → downstream data validation.

- [functions/src/ai-settings.js](../../functions/src/ai-settings.js)
- [apps/web/src/features/AIPersonalizationSettings.tsx](../../apps/web/src/features/AIPersonalizationSettings.tsx)
- [functions/src/field-options.js](../../functions/src/field-options.js)
- [functions/src/contracts.js](../../functions/src/contracts.js)
- [functions/src/app.js](../../functions/src/app.js)
- [apps/web/src/lib/field-options.ts](../../apps/web/src/lib/field-options.ts)
- [apps/web/src/lib/lead-fields.ts](../../apps/web/src/lib/lead-fields.ts)
- [apps/web/src/features/SettingsPage.tsx](../../apps/web/src/features/SettingsPage.tsx)
- [apps/web/src/features/LeadFieldManager.tsx](../../apps/web/src/features/LeadFieldManager.tsx)
- [apps/web/src/features/FieldOptionsEditor.tsx](../../apps/web/src/features/FieldOptionsEditor.tsx)
- [apps/web/src/components/CustomFieldInputs.tsx](../../apps/web/src/components/CustomFieldInputs.tsx)

## Primary API ownership

- GET /api/v1/lead-data-reset
- POST /api/v1/lead-data-reset/preview
- POST /api/v1/lead-data-reset
- POST /api/v1/lead-data-reset/{id}/resume
- GET /api/v1/workspace-settings
- PATCH /api/v1/workspace-settings
- GET /api/v1/ai-settings
- PATCH /api/v1/ai-settings
- PATCH /api/v1/me
- GET /api/v1/field-options
- PATCH /api/v1/field-options

Read the exact request/response/error schemas in [OpenAPI](../../docs/openapi.json)
and the route handler in [app.js](../../functions/src/app.js) when changing an API.

## Data and invariants

workspaces/avinyatech/settings/fields; users/{uid} preferences; persisted lead custom values remain readable after retirement.

- Admin-only workspace field writes use expectedVersion. Personal preferences remain user-owned; capabilities are not inferred from editable preference payloads.
- Preserve protected/essential fields and workflow values. Enforce custom types, required rules, stable cf_ IDs and normalized unique dropdown choices.
- Retiring fields/choices does not erase historical records or block unchanged legacy values. New use of retired options is rejected.
- Built-in display labels can change but keys, stored values, types and validation semantics stay fixed. Validate distinct built-in/custom names; preserve labels when older clients save only choices.
- AI personalization is Google/App Check Admin-only. Blank guidance restores defaults; changes invalidate summary caches and in-flight older generations cannot publish. Prompts are not telemetry.
- Apply the same configured options in forms, calls, imports, filters, journey and demo behavior. Use full “Enquiry” labels and omit serial number UI.
- Desktop settings use section navigation; mobile uses a section selector. Preserve profile photo fallback, readable fonts and accessible labels.

AvinyaIntelligence is an expandable settings group containing Dashboard insights (Admin), Automatic reminders (personal), and Lead scoring (Admin). Use matching optgroups in the mobile selector. Dashboard preferences support manual/automatic insightMode; omitted mode in older PATCH clients preserves the saved value, and missing records default to manual.

Settings → Reports & lead access owns [workspace-settings.js](../../functions/src/workspace-settings.js) and [WorkspacePolicySettings.tsx](../../apps/web/src/features/WorkspacePolicySettings.tsx). Admin Google/App Check writes require members:write and expectedVersion; active members can read the safe booleans. Defaults are exportsEnabled=true and assignedOnly=true. No-op saves retain the version. Saving must refresh /me so controls update immediately. Disabling assignedOnly restores configured member scopes, never promotes an assigned member to all. Verify reports-policy.test.js and the emulator integration.

Manage fields groups Lead fields (fields) and Dropdown choices (choices), with an accessible desktop accordion and mobile optgroup. Preserve legacy section deep links and Admin visibility. The shared settings-sections.json catalog drives navigation and documentation; every changed control needs defaults, scope, permissions and behavior in docs/settings-reference.json. Generate docs:settings and verify docs:check.

## Change and diagnosis

Test current versus retired values, duplicate choices, type changes, essential-field removal, stale versions and optional hidden fields. If a dropdown differs across screens, inspect shared adapters before hardcoding another list.

## Verification

- [functions/test/custom-fields-and-tasks.test.js](../../functions/test/custom-fields-and-tasks.test.js)
- [tests/lead-fields.test.ts](../../tests/lead-fields.test.ts)
- [functions/test/workbook-and-filters.test.js](../../functions/test/workbook-and-filters.test.js)

Apply the shared verification matrix to the changed behavior; these are the
module-specific regression entry points, not a substitute for integration checks.

## Deployment and handoff

api and Hosting. Coordinate scoring/people/PAT sections with their owner skills rather than duplicating permission logic.

Use [the release skill](../salesdrone-release/SKILL.md) for authorized publication.
Adjacent owners:

- [salesdrone-imports](../salesdrone-imports/SKILL.md)
- [salesdrone-leads](../salesdrone-leads/SKILL.md)
- [salesdrone-lead-scoring](../salesdrone-lead-scoring/SKILL.md)
- [salesdrone-people-permissions](../salesdrone-people-permissions/SKILL.md)
- [salesdrone-api-integrations](../salesdrone-api-integrations/SKILL.md)

Personal Appearance includes optional boolean bookMode (default false), independent of appearance. GET /me defaults it; PATCH merges omitted values so older clients retain the choice. Keep Google/App Check self-service boundaries and PAT denial. Settings saves include bookMode even when saving reminder preferences; apply the style only after successful save. Guest settings receive App guestPreferences so navigation does not reset the local style; live account preferences override local fallback. Verify book-mode.test.js, generated API Preferences and emulator persistence/isolation.

Every saved net configuration change now carries auditEvents.settingsChanges and atomic settings.audit.committed outbox evidence through settings-audit.js, including /me preferences. Audit keys and hashed targets only, no values; default normalization avoids false changes on first saves. No-op/replayed/denied operations emit no change event. Preserve before-write snapshots, rollback, 40-key chunks and current self/Admin authorization. [Book mode](../salesdrone-book-mode/SKILL.md) owns reading typography; this skill retains primary /me ownership. See [audit guide](../../docs/SETTINGS-AUDIT.md).

FontStyle is personal, defaults to standard and preserves older clients. Keep Book/branding exceptions and committed key-only audit behavior; see [font operations](references/operations.md).

Reviewed import field setup reuses the existing Admin-only expectedVersion boundary and retains all current definitions. It never promotes import access into schema-write access. PATCH /me now supports partial preferences and dashboardField; merge defaults/omitted keys, validate available categories and emit key-only dashboard.visualization audit evidence. Document the direct Today control in the personal settings guide.

## Conditional reference

For detailed UI, recovery and integration recipes, read [operations](references/operations.md) when the affected behavior requires it. Follow current source and the shared contract when older examples differ.

## Known gaps

These are tracked follow-ups, not implemented behavior: [#16](https://github.com/theharithsa/SalesDrone/issues/16), [#18](https://github.com/theharithsa/SalesDrone/issues/18). Check their current status before changing the contract.
