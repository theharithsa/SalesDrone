# Settings, fields and typography — 24 October 2026

## Interface

- Login’s “Good conversations.” and the first word of expanded lead names use Caveat. The underlying full name stays unchanged; the display styling does not claim to parse surnames across cultures.
- Headings use Google Sans. Body copy remains Manrope. Phone numbers use the device monospace stack.
- Google Sans 5.3.2 and Caveat 5.3.0 font assets are self-hosted from Fontsource packages. Their SIL Open Font Licenses ship under `/licenses/`; no Google Fonts request is needed. Google’s font source: https://github.com/googlefonts/googlesans.
- Labels spell out Enquiry source/date and Phone number. Serial numbers are absent from forms, lead tables, filters and new templates. Legacy workbook headers and stored serial values remain compatible internally; original customer data is not erased.
- The main sidebar collapses to an accessible icon rail on desktop. Preference is local to the browser. Mobile keeps its existing drawer and bottom navigation.
- Settings has Profile, Appearance & time, Automatic reminders, Notifications & devices, About, plus admin-only Lead fields, Dropdown choices and People & access. Desktop uses a left section menu; widths at or below 900px use a labeled section dropdown.
- Google profile photos come from the verified Firebase Google identity’s picture claim, restricted to HTTPS Googleusercontent URLs. Failed/missing photos fall back to initials. No additional OAuth scope is requested.

## Field management

`GET /api/v1/field-options` returns shared choices, custom definitions, hidden standard fields and the configuration version. `PATCH` requires an active Admin with members:write and the expected version. Existing audit and no-store policies apply. Contract version is 1.4.0 (36 operations).

Admins can add and edit custom short-text, long-text, number, date, dropdown and checkbox fields; set required flags; and edit dropdown choices. There are at most 30 active definitions and 100 including retired ones. Stable field IDs and types cannot be changed or reused. Duplicate active labels/choices are rejected. Custom values are type-checked on lead creation and on custom-value updates, including required values. Removed dropdown choices remain readable, and an unchanged previous selection can be preserved.

Values live in each lead’s `customFields` map. Updates merge with existing values so omitted or retired history is preserved. Unknown/retired keys cannot be newly populated. Required fields apply to manual lead capture or explicit custom-value edits; adding a required field does not retroactively block unrelated stage/call updates or legacy imports. The current workbook importer remains for the standard first-sheet fields, not arbitrary custom-field columns.

Optional standard fields can be removed from forms/tables and restored. Customer name, phone/email, enquiry date, country code and stage remain available because validation and workflow use them. Removing a custom field retires its definition, hides it from future entry/table/filter choices, and preserves its existing values in the lead’s Additional information section. This is not permanent erasure.

Custom fields appear in lead forms, detail views and desktop tables, and can be combined with ordinary column filters. Date comparisons require date-type custom definitions. Server filters apply only to authorized lead pages, retain bounded scanning/pagination, and bind cursors to the membership/filter state.

No Firestore migration, additional collection, or new index is required. No existing production setting or customer record was rewritten by this release.

## Verification

- TypeScript, production build and generated API contract checked.
- 50 tests pass: 45 API/domain tests and five TypeScript date/header/filter tests. New cases cover custom types, required values, dropdown validation, stable IDs, retirement, essential-field protection, permission/scope enforcement, partial saves, custom filters and profile URL fallback.
- Real Auth/Firestore emulator integration passes, including field definitions, custom-value capture/edit, filtering and retained values after retirement.
- Browser checks used a synthetic local Admin: created a required Product interest dropdown, captured an enquiry with Drone, changed dropdown choices, retired the field and verified the saved lead retained its value; removed a standard follow-up field; collapsed/expanded the sidebar.
- All eight Settings sections were checked at 360px without document overflow. At 390px the Settings menu is hidden and the section dropdown is visible. Desktop was checked at the default 1280px viewport. Physical mobile devices were not tested.

Screenshots: `screenshots/settings-redesign/` (synthetic local data only).

## Production release check

The API and Hosting release completed successfully. Live Hosting serves the latest main asset, both new font files and licenses with HTTP 200; the public API contract reports 1.4.0. The authenticated production Settings page displays the new navigation and Google Sans headings. All three visible account-photo images loaded successfully from Googleusercontent. Production checks were read-only.
