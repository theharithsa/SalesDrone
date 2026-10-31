# Collaborative imports (2.3 / API 1.19)

Imports parse the first CSV/XLSX sheet in the browser. No original workbook is uploaded or retained. Mapped source values, comparisons, row decisions and outcomes are private application data retained until an Admin deletes details. Workspace lead-data reset also removes import baselines.

## Workflow

Choose Skip existing contacts (default), Review updates, or explicitly Keep separate enquiries. Select a previous import with Update this workbook to reuse its dataset baseline. A different filename alone does not establish lineage. Upload, compare bounded chunks, inspect row matches/differences, approve clear proposals, resolve remaining decisions, then apply. Nothing changes in leads during comparison/review. History is paginated and shows uploader, status and created/updated/unchanged/skipped counts. Details show the actual duplicate candidates rather than only a total.

Review updates requires normalized name plus phone/email contact match. Name alone, reused phone with a different name, multiple candidates, overlapping source rows or missing source baselines need explicit review. A mapped SalesDrone lead ID or a manually chosen accessible candidate can establish identity; choosing a candidate compares it without approving changes. Contact normalization reuses lead validation. Inaccessible candidates are redacted and cannot be used to bypass assigned scope. Archived leads cannot be updated. Missing rows never delete leads.

For each mapped nonblank value compare previous imported value, current database value and incoming workbook value. An unchanged source cell preserves team edits. A changed source cell updates automatically only when the database still equals the baseline; otherwise the reviewer chooses which value wins. Blank/unmapped cells preserve existing values. Optional mapped fields can be deliberately cleared, subject to minimum-save/custom-required validation. Assignment, suppression and archive flags are never inferred from spreadsheets. New enquiries in a non-admin uploader's job remain assigned to that uploader even when another member executes the commit.

Imported comment provenance uses normalized column label and ordinal. Unchanged comments are not appended again. Reviewed corrections retain prior revisions and do not enqueue automatic reminder extraction. Renamed/reordered columns or edited discussions require review; reminder-linked discussion corrections must use the lead timeline to preserve reminder semantics.

## Permissions and retention

Admin members with existing import write permission inherit import read/share. Non-admin grants default off: `imports:read` reads own jobs; `imports:write` uploads/reviews/resumes; `imports:share` reads other members' jobs and, with write, resumes them. Write/share require read. These grants never expand underlying lead scope or grant `leads:create`/`leads:edit`. Every read/commit checks current membership and lead access. New reviewed/history APIs require Google sign-in and App Check; existing PAT import endpoints remain owner-only legacy behavior and gain no collaboration routes.

Only a Google-authenticated Admin with `members:write` can delete details. Confirmation is `DELETE IMPORT DETAILS`. Deletion is resumable, removes this job's chunks and the associated dataset's baselines, and stops an unfinished job. Other jobs' details remain, but future comparisons in that dataset may require manual review. Leads, discussions, revisions, summary and audit remain. Filename/sheet are redacted in the retained summary. There is no timed detail purge.

## API and limits

The authoritative schemas are in [OpenAPI](openapi.json). `POST /imports/preview` with `reviewed:true` starts formatVersion 3. `sourceImportId` links lineage; `duplicateMode` is skip/update/keep. All subsequent mutations require `expectedVersion`; stale collaborators must reload. `POST /:id/plan`, `/review`, `/refresh`, `/commit`, `PATCH /:id/rows/:index` and `DELETE /:id` operate bounded transactions. Row actions are accept/skip/create/match with selected `incomingFields` and explicit `clearFields`. Idempotency replay still checks current authorization.

`GET /imports` supports status, uploader, from/to and cursor filters. `GET /:id/rows` and `/report` return current authorized details; report also requires workspace exports enabled. Their limit counts stored chunks, each at most 11 rows (1–100 chunks), with a filter-bound cursor. History returns 1–100 jobs. The UI loads 20 jobs and one row chunk; report download walks ten chunks per request.

Maximum 5,000 rows and 6 MiB parsed payload, with 200 KiB source chunks and 850 KiB comparison chunks to preserve Firestore document limits; split larger workbooks. Commits process at most 11 rows and reduce that for comment/write budgets. Each lead version, baseline and field configuration is rechecked atomically; stale work pauses without partially applying that chunk. Refresh replans remaining rows and requires renewed approval. Preview expires after one day before first commit; refresh renews it. Partial jobs retain progress. Import mutation routes have independent 180/minute buckets; a 429/network interruption preserves the job and requires resume after waiting. No background browser loop survives closing the page.

Legacy jobs retain their stored chunk sizes and owner replay. Non-admin writers must use reviewed mode. New indexes must be READY before publishing the dependent frontend. Rollback must preserve formatVersion 3 records/baselines and cannot safely resume them with an older client.

## Verification boundaries

`functions/test/import-review.test.js` covers matching, three-way decisions, permissions, stale work, revisions, retention, deliberate clears and a 1,000-row re-import. Real Auth/Firestore integration checks stored baselines, restricted rows, concurrent executors and deletion. Synthetic component captures demonstrate presentation only; they do not prove a production import. Telemetry contains safe lifecycle counts/outcomes, never names, contact values, filenames, cells or comments.

## Temporary cleanup lock

If validation or resume returns HTTP 503 with `LEAD_DATA_RESET`, lead-data cleanup is still active. Wait for Settings → Lead data management to show Completed, then retry. `Retry-After: 60` advises a delay; it does not mean cleanup is guaranteed to finish within a minute. A blocked preview does not create an import job. Keep the workbook/mapping or resume the existing job; do not create parallel imports to work around the lock. The lock protects against records being deleted during cleanup. Other server errors remain redacted.
