# Operational reference

Use the current source and [shared contract](../../SHARED.md) when applying these module-specific recipes. Release dates, prior approvals and screenshot versions are historical evidence in [CHANGELOG](../../../CHANGELOG.md) and [release plans](../../../releases/); they never authorize a new deployment.

## Collaborative imports

Non-admin import grants default off: imports:read (own history), imports:write (reviewed upload/decide/resume) and imports:share (other uploaders). Write/share require read; none grants lead create/edit or expands assigned scope. Admins with existing imports:write inherit only the new read/share flags. Preserve current PAT owner capability checks; collaboration remains Google-only. See docs/IMPORTS.md and import-review.test.js.

