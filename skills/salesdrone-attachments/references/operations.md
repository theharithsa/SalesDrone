# Operational reference

Use the current source and [shared contract](../../SHARED.md) when applying these module-specific recipes. Release dates, prior approvals and screenshot versions are historical evidence in [CHANGELOG](../../../CHANGELOG.md) and [release plans](../../../releases/); they never authorize a new deployment.

The desktop inspector has a visible Files shortcut that opens the full lead Files tab. On narrow layouts the six workspace tabs fit using compact inline padding while retaining 44px minimum targets and optional local scrolling. Do not hide Files behind an unlabeled expand icon.

When expanding the inspector into the full lead route, preserve the requested Files
tab through asynchronous lead loading. New/different leads start at All. Verify the
shortcut after the data request finishes, not just immediately after navigation.

## Material 3 v2  guidance

Material v2 keeps the private Files API/limits intact while adopting shared file-row, progress and confirmation surfaces. Its inspector shortcut must preserve Files after asynchronous loading. Validate layout and keyboard flow separately from Storage byte/authorization tests.

## Lead-data reset

The global lead reset waits five minutes past current function request deadlines, deletes metadata-associated objects then sweeps the fixed workspaces/avinyatech/lead-files/ prefix via bounded firebaseFiles.list. No caller-controlled prefix, filenames or network calls in transactions. Listing/deletion failure blocks completion and retains the data-write pause; storage operations are idempotent. Provider soft-delete/backups are outside the application's undo/erasure promise.

## API and deployment hardening

The binary PUT pre-middleware must initialize the exact attachments:write PAT requirement before requireMember and before parsing bytes. The generic route wrapper sets it again; neither check expands scopes. Test the token reserve→PUT→GET→DELETE flow, read-only denial and post-upload revocation with bulk-and-files.test.js and the real Storage emulator.

