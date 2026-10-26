# Private lead attachments

SalesDrone v1.9.0 stores bytes in Firebase Storage bucket sales-drone-avinya.firebasestorage.app (asia-south2), with metadata under workspaces/avinyatech/leadAttachments. Generated object identifiers keep filenames out of paths. Object creation uses an immutable precondition and checksum; names and checksums remain protected metadata, never telemetry.

The Firebase Admin Storage API uses the Google Cloud Storage client. [Firebase’s Admin documentation](https://firebase.google.com/docs/storage/admin/start) describes this relationship and notes that durable download URLs grant access to anyone holding the URL. SalesDrone instead proxies authenticated binary requests through its API. Client Storage rules deny every request; the bucket has public-access prevention enforced. The existing runtime service account has object access through its project role; no new service-account keys are created. No public CORS upload endpoint or permanent share URL is needed.

## Protocol and failure recovery

1. POST metadata with a UUID key. A transaction checks current membership/lead scope and quota, increments the lead’s internal attachmentCount and reserves a Pending record. It does not alter the lead’s business version or trigger fresh AI scoring.
2. PUT raw bytes to the reservation content endpoint. Check reserver, expiry, current lead/assignment and byte signature/size, then store private immutable bytes outside the transaction. Reauthorize in a new transaction before publishing Ready. An uncertain success can retry identical bytes; different bytes cannot replace that reservation.
3. GET the paged Ready metadata list or GET binary content. Reauthorize after Storage reads before responding. Downloads force attachment/octet-stream/no-store/nosniff. No object paths/checksums are returned.
4. DELETE with the metadata expectedVersion hides access immediately, decrements quota once and records Deleting work. There is no in-app restore action. Cleanup retries physical deletion after an hour; Cloud Storage’s own soft-delete policy is independent from app authorization.
5. Pending expires after an hour and moves to Deleting with another hour of grace. This prevents an in-flight upload from completing after an eager delete and leaving an orphan. The existing reminders worker performs bounded cleanup after normal dispatch; failures retain retryable metadata and do not stop reminders.

Concurrent lead edits preserve internal file counts through existing transaction reads. Attachment changes intentionally retain the lead’s business version: files have their own versions and are not AI evidence. Bulk edits and ordinary lead updates must preserve these internal fields.

## Limits and permissions

8 MiB per file; 50 active/pending per lead. Photos (JPEG/PNG/GIF/WebP), PDF, Office documents, UTF-8 text and CSV are allowed. Extension/type, signature and byte size are validated; HTML/SVG/executables are excluded. Files are stored, not rendered, malware-scanned or sent to Gemini. Archived leads reject new reservations.

Readers can list/download currently accessible completed files. Editors can reserve/upload/remove; only the reserver may finish a Pending upload. PATs require explicit attachments:read or attachments:write and current owner eligibility. Existing files follow the lead after reassignment; old assigned-only members lose access. Assignment changes invalidate pending uploads. No UI-only restriction substitutes for backend policy.

The Files tab uses a separate binary transport with Auth/App Check, progress, abort, retry and removal confirmation. Demo files stay in component memory and disappear when leaving Files; they never reach Firebase. Backend request traces and storage dependency spans use safe templates/names; committed events contain only counts and pseudonymous context. Filenames, content, paths and checksums are excluded.

## Verification and operations

Use the attachment skill and testing catalog. Unit tests cover validation, scope, version/replay, revoke-during-upload, cleanup grace and privacy. The actual Auth/Firestore/Storage emulator exercises upload/download bytes and denies anonymous direct Storage access. CI deploys private Storage rules and ready indexes before Functions/Hosting. Production release checks must distinguish these tested boundaries from an authenticated customer upload; use no customer data as a deployment probe.
