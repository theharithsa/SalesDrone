# v1.9.0 UI and integration review

Reviewed the actual guest application with fictional leads and a generated text
file, plus the real DeveloperSettings component in a clearly labelled stub fixture.
No production lead, attachment, reminder or token was created for this review.

## Observed interactions

- Selected two loaded leads, previewed changes and applied a shared stage change.
  Selection cleared after refresh. Editing a previewed value disabled Apply until
  preview ran again. The mobile dialog scrolled without document overflow.
- Files opened from the inspection shortcut and full-page tab. Uploaded a fictional
  text file, observed its row and download initiation, tested Keep file and confirmed
  removal in the memory-only demo. Leaving Files clears guest attachments by design.
- Files layout measured zero document overflow at 390, 768, 1024, 1280 and 1920 CSS
  pixels. Standard display scale was 100%. Reviewed dark contrast and Book mode serif
  typography. Six tabs remain accessible on narrow screens.
- Inspected explicit attachment read/write and bulk-edit PAT choices without
  creating a credential. Public Swagger reported contract 1.16.0 without authorization.

## Evidence boundaries

Screenshots in the reviewed manifest contain synthetic data only. Browser download
initiation was observed; a native saved-file receipt was unavailable. Actual byte
round-trip, anonymous direct-Storage denial and physical cleanup were verified in
Auth/Firestore/Storage emulators. This is browser layout evidence, not physical-device
certification or proof of an authenticated production upload.
