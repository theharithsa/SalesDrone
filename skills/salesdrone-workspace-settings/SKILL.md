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
- Apply the same configured options in forms, calls, imports, filters, journey and demo behavior. Use full “Enquiry” labels and omit serial number UI.
- Desktop settings use section navigation; mobile uses a section selector. Preserve profile photo fallback, readable fonts and accessible labels.

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
