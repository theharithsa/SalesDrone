# Comment-column import and lead editing — 24 October 2026

The import review screen separates lead-field mapping from **Import columns as comments**. Any of the first sheet’s columns can be selected as comments. Discussion, note, comment and follow-up headers are selected by default; admins can change the selection. Each nonempty selected cell becomes its own historical note on that row’s lead. Column labels and positions are retained, repeated text in different columns remains separate, and blank cells are skipped. Source order follows the sheet from left to right; the activity timeline shows the later columns first, without inventing original occurrence dates. Imported notes do not schedule Gemini reminders.

Selected values are stored as activities rather than copied into numbered lead fields. The lead table and form no longer show numbered follow-up fields. Existing stored fields are retained for compatibility and existing timeline history is not rewritten. No production workbook is reimported by this release.

API 1.6.0 (36 operations) documents `rows[].importComments` for POST `/api/v1/imports/preview`: an array of `{sourceColumn, sourceIndex, notes}`. Each source index must be unique and within 0–39; labels are limited to 100 characters and cells to 4,000 characters. There are at most 40 comments and 24 KB of normalized details/comment content per row. Invalid rows are reported through the existing preview/error workflow. New preview batches contain 11 rows, keeping a commit with 40 comments per row within transaction write limits. Older saved previews continue using their original 25-row chunks and discussion fields. Existing fingerprints, ownership permissions, audit and replay controls are preserved; commit retries do not duplicate comments.

Lead names stay in the normal font in tables, cards, tasks and ordinary fields. Only the expanded lead heading uses a Google Sans first word above Google Sans lettering for the remaining name, visually uppercased. The underlying full name is unchanged; this is display styling, not surname parsing or a contact-schema change.

Authorized users have explicit Edit actions in desktop lead rows, mobile lead cards and the expanded detail header. Row editing loads the current record before opening the form; existing permission and optimistic-version checks still apply. Numbered history inputs have been removed; adding comments uses the timeline comment flow.

## Verification

- 60 tests pass: 54 API/domain and six TypeScript date/header/filter/mapping tests.
- Cases cover arbitrary/multiple comment columns, blank/repeated cells, source ordering, malformed and oversized cells, atomic import, replay, 40-column batches, legacy 25-row preview recovery, and the existing 1,000-row resume workflow.
- Real Auth/Firestore emulator integration imported 480 comments across 12 leads and multiple commits, then replayed the completed import without duplicates.
- Browser verification used a synthetic CSV: selected an additional Customer response column, imported three comments (including repeated text), and inspected each labeled timeline entry. Edited the imported lead’s city through the row action and confirmed persistence.
- Historical checks before v1.1.5 confirmed Caveat on the expanded first name, Google Sans on the remaining name, no script spans in table names and no follow-up table headers. The mobile card Edit action opened the editor at a measured 390px width with no document overflow. These are browser checks, not physical-device testing.
- TypeScript and production build pass. No new Firebase indexes or worker deployment is required; deploy the API before Hosting.

Screenshots under `screenshots/comment-import/` use synthetic local data only.

Production release verified: the API update and Hosting deployment completed successfully. Hosting serves the latest main asset and comment-selection import module. The public contract is 1.6.0. The authenticated live Leads page has explicit row Edit actions, ordinary name text and no discussion/follow-up headers. These checks were read-only; production lead values and comment history were not rewritten.

Typography update (v1.1.5, 25 October 2026): browser computed styles now confirm Google Sans on the expanded first name. Caveat remains on the login slogan; saved names and import behavior are unchanged.
