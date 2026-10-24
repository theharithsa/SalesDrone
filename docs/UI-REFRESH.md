# UI refresh — 24 October 2026

The application now uses self-hosted Manrope Variable (SIL Open Font License, served at `/licenses/Manrope-OFL.txt`), a 16px body baseline, larger controls and improved contrast in both themes. Narrow-screen lead details use a full-width flow; task actions remain visible, forms use 16px inputs, and navigation/sheets respect safe areas. The lead detail entrance animation was removed after it caused a transient horizontal overflow in 360px tests. Hover effects apply only to fine-pointer devices with hover support.

The top-right appearance button switches light/dark immediately and saves authenticated preferences. Settings offers the same preference, including System.

## Configurable fields

Admins can edit sources, cities, sectors, original statuses, workflow stages, call outcomes, contact dispositions and country codes in Settings. Sources/cities/sectors/original statuses are suggestions; individual enquiries can still contain other values. Stages/outcomes/dispositions are enforced by the API. New, Connected, No answer, None and Do not contact retain their system meanings and cannot be removed. Retired existing values remain readable and unchanged edits remain possible. Concurrent settings saves use expectedVersion; duplicate choices are rejected. Existing records are not rewritten by a configuration edit. Import preview fingerprints include the field configuration version.

## Tasks

Task owners can edit title, date/time, kind and status directly from Tasks or task details. Delete requires an in-app confirmation, cancels the current pending delivery, removes the task from active lists and updates its automatic-reminder timeline entry. The server retains a deleted task record and audit history; this is not permanent erasure. Other admins cannot edit/delete another user's personal task solely because they are admins.

## Evidence and limits

- 45 automated tests pass (41 API/domain + four TypeScript date/header/filter tests).
- Real Auth/Firestore emulator integration passes, including custom stages/outcomes, task edits, deletion and cancelled pending delivery.
- TypeScript and production build pass.
- 32 isolated browser scenes passed at widths 360, 390, 768 and 1440, including both themes, lead details/forms and task edits. No document overflow or runtime page errors were observed. These are emulated viewport checks, not physical-phone keyboard certification.
- Interactive in-app-browser checks saved admin choices, created a synthetic enquiry, logged a call, edited/deleted a task, combined city/sector filters and switched themes.
- The actual Gemini worker generated a dated reminder from the synthetic initial note against the local Firestore emulator. The worker was invoked manually because the emulator does not run Cloud Scheduler. This does not certify production scheduler/push delivery.
- API contract: version 1.3.0, 36 operations, including GET/PATCH field-options and DELETE tasks.

## Demo

[SalesDrone walkthrough](demo/SalesDrone-walkthrough.mp4) is a 70-second silent guided walkthrough using actual UI captures held for readability. It uses synthetic records and Firebase Auth/Firestore emulators. It shows enquiry entry, a Gemini-derived reminder, call history, manual follow-up, task editing/deletion, filters and themes. It is not a continuous real-time screen recording, a production Google login recording, or a physical-device push test.
