# First-worksheet enquiry format and filters

The source workbook was inspected read-only. Only Sheet1 was used; sheets 2 and 3 were excluded. The detected header is row 3. Its 14 columns are preserved in order: Sl No, Enq Source, Name, Contact No., Company Name, Location, City (one column), Sector, Enq Date, Status, Initial discussion, 1st follow up, 2nd follow up, 3rd follow up, 4th follow up.

## Capture and discussion history

The new/edit lead form, worksheet table and import template use these labels. Sector is the existing API field `zone`, city/location is `location`, and the original worksheet Status is `legacyStatus`; the application's sales stage is separate. Won is an available sales stage. The original status remains available even when mapped to a sales stage.

Initial discussion and each follow-up are separate note activities linked to the lead, with source-column labels and preserved text. Imported history has `imported=true` and `occurredAt=null`: the import timestamp is not represented as the original discussion date. New comments/calls have server timestamps. Updates to discussion fields append a new entry instead of replacing earlier activity; corrected entries retain their revisions.

New manual initial discussions and legacy Comments fields now use the same Gemini enqueue path as later notes/call comments. This fixes the missing reminder job when creating a lead with a dated initial comment. Importing historical text never queues AI analysis. Earlier follow-up columns entered manually are treated as historical context as well. Manual reminders retain precedence within their call/activity.

## Import and source quality

The first worksheet is selected and its header row is detected automatically. Known legacy header aliases remain supported. Excel's unformatted 1900-system serial dates are accepted, alongside ISO dates and explicit day/month/year ordering. Original invalid date/contact text is retained in separate fields for correction, not replaced with guessed values.

Blank names/dates and unusable contacts are preserved for administrative review; such records cannot be used for outreach until confirmed. Manual new enquiries still require a name, enquiry date and valid contact. A wrong mapping that omits Name and Contact No./Email is rejected rather than importing empty leads. No original workbook was changed.

The inspected first sheet reconciled locally to 484 rows and 775 discussion entries. 152 rows need review; seven rows repeat a contact. An offline API import with “Keep separate enquiry rows” imported all 484 rows with 775 activities and zero AI jobs. With the default skip-duplicates setting, repeated contacts are skipped and reported; select Keep separate enquiry rows to retain every source row. Both modes preserve idempotency, and keep mode retains all contact-to-lead lookup identities. The customer workbook has not been imported into production by this change.

## Column filters

The lead screen exposes “Filter any column.” Up to 16 AND-combined conditions support every source column, plus email, sales stage, latest saved comment, assignment ID, last call outcome, last contact date and review/contact restrictions. Text matching is case-insensitive: contains, equals and starts with; empty/not-empty are available. Enquiry/last-contact dates also support before/after and can be combined into a range. Search now includes city and sector.

`GET /api/v1/leads?filters=<JSON array>` is documented in OpenAPI 1.2.0. Each item has `field`, `op` and `value`; unknown fields/operators, malformed JSON and invalid date comparisons are rejected. The example array `[{"field":"zone","op":"equals","value":"Education"},{"field":"location","op":"contains","value":"Bengaluru"}]` combines sector and city. Existing stage/source/search parameters can be combined with column conditions.

The backend scans only indexed authorized lead pages, then matches arbitrary combinations server-side, avoiding a combinatorial collection of indexes. Each request scans at most 1,000 records and returns a signed continuation cursor. Empty result pages can still have nextCursor; Load more continues the scan. Clients must continue until nextCursor is null. Cursors are bound to the complete filters, identity and membership version. No total-match count is claimed before the scan is complete. At larger volumes, a dedicated search index may be appropriate; this implementation is intended for the current hundreds-to-thousands of enquiries.

## Verification

39 automated tests pass (35 API/domain tests and 4 TypeScript date/header/filter tests). Regression coverage includes source-column preservation, blank values, serial dates, five historical discussions per lead, duplicate-contact keep mode, initial-comment scheduling, append-only detail comments, combined filters, sparse pages after the 1,000-row scan boundary, cursor tampering and assigned-scope isolation.

Real Auth/Firestore emulator integration passes for source-compatible lead creation, combined city/sector filters, note analysis/task creation, Undo and the initial-discussion reminder regression. TypeScript and the production build pass. Browser-control tools were unavailable for an interactive layout pass; desktop horizontal worksheet scrolling and compact mobile cards were implemented but are not claimed as visually certified on physical devices.

A single earlier live test comment, created before initial-comment analysis was wired, was given revision metadata and NeedsReview date controls with an audit record. Its original requested time had passed; no retroactive task or push was fabricated.
