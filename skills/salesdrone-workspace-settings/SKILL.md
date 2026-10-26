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

FontStyle is an optional allowlisted personal preference (standard/inter/source-sans/lora), default standard. GET /me defaults it and PATCH merges omissions, preserving old clients. Settings drafts preview locally and apply only after a successful save. Keep Google/App Check self scope and PAT denial. Include fontStyle when saving other settings so a mounted form cannot reset it. Track its key in appearance settings-audit defaults/definitions; export no values. Test font-style.test.js and real emulator persistence/audit isolation.

## v1.8 operating notes

Appearance & time includes Display zoom numeric85/90/100/110/125. Draft changes apply after Save; default 100, omitted PATCH preserves. Persist per member through /me and isolate guest fallback. From app 2.0.1, apply it on phones/tablets as well, compensate touch sizes and document reset100. Test functions/test/display-scale.test.js and tests/appearance.test.ts.

## v1.9 operating notes

Explain the new PAT scopes in Developer settings and leads:edit file/batch capabilities in People & permissions. No attachment toggle or global setting is introduced; limits are a documented versioned contract. Existing tokens require explicit new scopes; current owner capabilities and assigned-only policy still apply.

## Material 3 v2 local-review guidance

Material v2 uses shared section cards and a settings dropdown below 900px. The local AdminReview entry renders real components with fictional state, never live API access. SettingsPage previewOnly blocks push registration; the ordinary app does not pass it. Existing field IDs, stored preferences and API policy are unchanged.

### Mobile display scale (local 2.0.1)

Display zoom now applies after Save on phones, tablets and desktops; it is no longer
clamped to 100% on touch/narrow layouts. Retain the same allowlisted numeric values
and personal GET/PATCH /me policy. Smaller zoom compensates tap targets; fixed
viewport dimensions also account for scale. Update UI help, settings reference,
API description and product guide together. Test all five through real Save rather
than CSS injection. Existing committed key-only preference audits remain unchanged.

### Local 2.0.1 theme control

ThemeToggle uses one native button with sun/moon icons and a solid indicator for
the resolved current mode. The named action switches to the opposite explicit
mode, preserving System following in Settings and Book mode. Keep the existing
changeTheme persistence/error/busy path, keyboard focus and compensated touch
target. The indicator moves 28px in 160ms, disabled under reduced motion. Use
semantic Material colour pairs rather than gradient day/night palettes. Refresh
affected login/workspace public captures after approval; local captures do not
replace or relabel published v2.0 images. No API or new audit/event is introduced.
