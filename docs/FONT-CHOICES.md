# Personal font choices and activity typography

Settings > Appearance & time includes an Interface font selector and an immediate draft sample. Save changes applies the selection after the account update succeeds. Standard is the default and keeps the existing Google Sans headings and Manrope body. Alternatives are [Inter](https://fonts.google.com/specimen/Inter), [Source Sans 3](https://fonts.google.com/specimen/Source+Sans+3), and [Lora](https://fonts.google.com/specimen/Lora). These are curated interface choices, not arbitrary uploaded fonts or external stylesheet URLs.

## Scope and precedence

The preference belongs to the signed-in member, not the whole workspace. Google sign-in/App Check and active membership are required for GET/PATCH /me; PATs cannot change this preference. Missing values default to Standard; older clients preserve saved values when omitting the field. Demo settings use a separate browser-local fallback and never become a live member’s default. Failed saves do not apply the draft globally.

Book mode keeps its own serif family. Turning it off restores the saved interface font. The preview uses the selected family in standard mode; in Book mode its sample remains in the reading font, as the help text explains. SalesDrone branding retains its established standard-mode font, while phone numbers remain monospace and technical code keeps its standard-mode monospace styling. Unsupported scripts use system font fallback. Different font metrics can change wrapping and the number of visible columns; local table scrolling remains available. Font selection does not change lead data, access, notifications or scheduling.

## Files, loading and licensing

Variable font files come from pinned Fontsource packages and are emitted as hashed same-origin assets by Vite. Declaring a font face does not fetch every family: the browser requests a font when it is used. No runtime Google Fonts CDN call is added. Each bundled font has an SIL Open Font License copy under `apps/web/public/fonts/interface/`; package licenses remain with the dependency. Browser font caching and fallback keep content available during loading.

## Activity reading hierarchy

All, Comments and Calls share 15px entry titles, 15px desktop comment text with 1.5 line spacing, 16px comment text on narrow/coarse-pointer layouts, and 13px timestamps. Card padding is 12px vertically and 12–16px horizontally, with 12px between entries. Notes keep line breaks, full text and a bounded measure; long words wrap. Edit/correct actions keep 44px touch targets and compact fine-pointer targets. Book mode follows the same semantic sizes. The composer retains normal editable-text sizing.

## Verification and observability

Tests cover allowed values, default/persistence, old-client merging, account isolation, invalid URLs/values, App Check, unapproved/PAT denial and no-op audits. Real Auth/Firestore emulator checks verify persistence and committed appearance audit/outbox keys. Canonical `settings.audit.committed` events carry `fontStyle` as a key, not its value, and reuse the existing exporter/log/trace/metric pipeline. Deployment signals include the version and exact commit. HTTP acceptance is separate from tenant searchability.
