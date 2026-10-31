# Field-aware dashboard and import destinations: local v2.5.2 review

The v2.5.1 dashboard reused pipeline-flow descriptions for Source, Zone and custom fields. Its import destination picker hid targets already mapped to workbook columns, leaving only two choices in some files. This patch uses the effective configured label across chart headings/descriptions/notes and lists every compatible active category or custom text/dropdown destination. It does not add contact/date/number/checkbox destinations.

Mapped destinations remain selectable, with a conflict message and a focus link to the existing column mapping. Validation stays blocked until that column is remapped, retained under a distinct reviewed field name, or explicitly excluded. Additional-field resolution cannot reuse the status target ID before a schema write. The server's target/overwrite checks, roles, retained workbook status, API 1.21.0 and actual import transformations are unchanged.

Local evidence:

- All 16 component workflow cases passed, including Source/renamed-Zone/custom selection and drill-through without AI requests; non-admin explicit exclusion; and Admin preservation of a custom source column under a new name, and a fresh-configuration destination collision rejected before schema/preview writes. The four targeted import-status/field-resolution helper cases passed. Broad local domain suites were not repeated for this UI-only patch; required PR CI retains its full gates.
- Synthetic Chromium checked 54 selected-field combinations: Source/Zone/custom across 390/599/600/767/768/1024/1280/1440/1920 CSS pixels in both palettes. Headings and notes followed the selected label without conversion/movement wording or root overflow.
- An 80-character configured label was checked at 390/1440 and 100/125% interface scale in short 700px windows, for dashboard and import text. Import conflict layouts passed eight width/theme combinations; focus links, all six compatible fixture targets (including already-mapped fields), an open picker and explicit source-column review were checked. Counts and minimum save-details policy were unchanged.
- Types, lint (47 existing warnings; no errors/increase), production build and preview-fixture exclusion passed. Documentation/settings/skills/release checks and credential/export scanning are recorded separately before the draft PR. Curated captures were visually/privacy reviewed before their hashes/version were updated.

Fixtures are fictional guest data or the isolated Admin preview with in-memory/stubbed transport. No customer records, private screenshots or production imports were used. The installed Chromium ran with an isolated profile, with local RUM disabled. These are browser viewport checks, not physical-device/Safari certification or tenant telemetry acceptance. Intermediate logs/captures remain ignored under test-results/field-labels-2.5.2.

The original workspace was initially clean at c3ce0b9; network-share read failures required an isolated local checkout. The original files were preserved. This review and release impact plan are pre-deployment evidence only; publication requires approval and a verified PR merge.
