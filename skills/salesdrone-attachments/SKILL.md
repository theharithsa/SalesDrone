---
name: salesdrone-attachments
description: "Maintain SalesDrone private lead files in Firebase Storage, authenticated upload/download APIs, quotas, expiry and cleanup. Use for lead attachments and Files tab issues; batch lead edits belong to leads."
---

# Lead attachment service

Read [SHARED.md](../SHARED.md), [the API guide](../../docs/API.md) and [file architecture](../../docs/ATTACHMENTS.md). This is a logical module within the shared API, not an independent deployment or permission to change unrelated buckets.

## Primary API ownership

- POST /api/v1/leads/{id}/attachments
- PUT /api/v1/leads/{id}/attachments/{attachmentId}/content
- GET /api/v1/leads/{id}/attachments
- GET /api/v1/leads/{id}/attachments/{attachmentId}/content
- DELETE /api/v1/leads/{id}/attachments/{attachmentId}

## Entry points

- [attachments.js](../../functions/src/attachments.js): metadata schemas, reservations, byte signatures, access and cleanup.
- [file-storage.js](../../functions/src/file-storage.js): Firebase Admin Storage adapter with immutable object creation, CRC and bounded downloads.
- [app.js](../../functions/src/app.js): route admission, transaction audits and authenticated forced downloads.
- [LeadFiles.tsx](../../apps/web/src/features/LeadFiles.tsx), [api.ts](../../apps/web/src/lib/api.ts): Files tab, progress, cancellation, retries, confirmations and private binary transport.
- [storage.rules](../../storage.rules): deny all client requests. Never create permanent Firebase download URLs or public object ACLs.

## Invariants

Current active membership and effective lead scope apply to every operation. Read needs leads:read; reservation, upload and removal need leads:edit. PATs require explicit attachments:read or attachments:write. The reserver alone may PUT bytes. Recheck membership/token/lead assignment after network upload and before Ready commit, and after reading bytes before sending a download. A revoked or transferred upload never becomes visible. Files stay with the lead after assignment; new authorized owners may read existing Ready files.

Maximum 8 MiB, 50 Pending/Ready reservations per lead. Reject paths/control characters, unsupported types, size mismatches and incorrect file signatures. Never parse Office archives, render SVG/HTML, execute uploads or feed files to AI. No claim of malware scanning. Object names use generated identifiers, not filenames. Store names only in protected metadata; events/logs/traces contain no names, paths, content or checksums.

Reservation is idempotent and expires after one hour. PUT uses an immutable create precondition and checksum so identical retries succeed without replacing content. Metadata becomes Ready only after private bytes are stored. Removal hides API access immediately using an expected metadata version, frees quota once and creates Deleting work. The existing reminders worker runs bounded cleanup after its normal dispatch; failures must not break reminders. Expired Pending moves to Deleting with another hour of grace so in-flight uploads cannot escape cleanup. Deleting retries until physical removal succeeds, then becomes Deleted. Do not put network operations in database transactions.

List only Ready files with signed, scope-bound pagination. Never expose objectPath/checksum or issue a durable share URL. Force application/octet-stream download, Content-Disposition attachment, no-store and nosniff. Guest files are memory-only and disappear when the Files component is left; no demo bytes reach Firebase.

## Tests and release

[bulk-and-files.test.js](../../functions/test/bulk-and-files.test.js) covers authorization, byte validation, immutable retries, revocation, quota and safe events. [emulator.integration.js](../../functions/test/emulator.integration.js) exercises real Auth/Firestore/Storage and direct-client denial. Use [testing](../salesdrone-testing/SKILL.md), [observability](../salesdrone-observability/SKILL.md), [release readiness](../salesdrone-release-readiness/SKILL.md) and [release](../salesdrone-release/SKILL.md). Deploy Storage rules and ready indexes before Functions/Hosting. Runtime SA needs object access to this bucket; never create service-account keys. Verify bucket public-access prevention and retain source for forward-version rollback.

The desktop inspector has a visible Files shortcut that opens the full lead Files tab. On narrow layouts the six workspace tabs fit using compact inline padding while retaining 44px minimum targets and optional local scrolling. Do not hide Files behind an unlabeled expand icon.
