# Import enquiries and update leads in Excel

Imports parse the first CSV/XLSX sheet in the browser. No original workbook is uploaded or retained. Mapped source values, comparisons, row decisions and outcomes are private application data retained until an Admin deletes details. Workspace lead-data reset also removes import baselines.

## Update leads from an Excel export

1. Open **Leads**, set your filters and choose **Export Excel**. Include **Sales stage** and the fields you want to edit. Use a fresh export before each editing session.
2. Edit the first sheet, **Leads**. For example, replace **New** with **Supplied** if Supplied is an active stage in your workspace. Sort whole rows so **SalesDrone lead ID** and **SalesDrone version** stay with their lead. Keep both columns in the file.
3. Open **Import enquiries**, choose the saved XLSX and check the preview. SalesDrone recognizes its export and selects **Review updates**. It accepts current stage names with differences in capitalization or spacing. If a value was renamed or retired, choose its current equivalent under **Match sales stages**. A blank cell keeps the saved value. To leave one lead untouched, omit its row.
4. Choose **Validate records**, then **Approve clear proposals**. If someone edited the lead since export, compare the saved and workbook values and select the changes you still want. Use **Apply reviewed changes**. Import history shows updated, unchanged and skipped rows. Uploading the same unchanged values again leaves each lead and its recorded notes in place.

**Conditions.** You need workspace export access to download a file and import write plus lead edit access to update its leads. Use literal values and dates in YYYY-MM-DD form. A fresh SalesDrone export can contain just the fields you need. Saved comments and assignment, audit and workflow flags are reference columns. Use the lead timeline to correct a saved comment. For a new lead, leave both identity cells empty and include customer name and a contact column. Manual clear is available for optional mapped fields during review.

Each upload accepts the first worksheet, up to 5,000 populated lead rows, a 10 MB file and a 6 MiB parsed request. Export in smaller filtered batches when necessary. Original third-party workbooks accept up to 40 columns. An exported report can also carry reference columns. For older workbooks without identity columns, choose an earlier completed import's **Update this workbook**, or manually choose **Review updates** and confirm matches.

For a multi-select column, keep the bracketed list of quoted choices from the export, such as `["Panel","Trim, exterior"]`. A plain choice works for single-value input. Keep commas inside quotes when they are part of the label. Use `[]` to clear an optional multi-select or leave the cell blank to keep the saved selection. A retired choice can be retained on the same lead.

## Workflow

External files default to Skip existing contacts. SalesDrone exports default to Review updates. Keep separate enquiries is available for new enquiries without SalesDrone IDs. Select a previous import with Update this workbook to reuse its dataset baseline. A different filename alone does not establish lineage. Upload, compare bounded chunks, inspect row matches/differences, approve clear proposals, resolve remaining decisions, then apply. Nothing changes in leads during comparison/review. History is paginated and shows uploader, status and created/updated/unchanged/skipped counts. Details show the actual duplicate candidates rather than only a total.

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
