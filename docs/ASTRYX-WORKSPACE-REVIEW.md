# Astryx workspace redesign

The workspace uses one neutral theme, surface hierarchy and control scale. The app keeps existing form order and saved field types. The stage picker, native form inputs and portal-based dialogs keep their existing keyboard and validation behavior.

| Surface | Design treatment |
| --- | --- |
| Sign-in and navigation | Public product homepage with an immediate sign-in panel, synthetic desktop and phone screenshots, feature walkthroughs and a direct demo action. The workspace uses a compact sidebar and a visible selected state. |
| Dashboard and Team | Shared bordered surfaces, consistent metric spacing and date controls aligned on the same baseline. |
| Leads and Companies | Consistent collection headings, search and action heights. Leads groups advanced filters in one panel and aligns the stage selector with worksheet cells. |
| Lead details, tasks and notifications | Shared record header, table, action, modal and status styles. Keep the full record and locally scrollable tables on small screens. |
| Settings and imports | Maintain separate Field definitions, Field order and Lead page header. Standard and custom fields share label placement and native controls. |
| Lead Hygiene and Assistant | Shared page margins, panels and composer styling. Existing scope and loading behavior apply. |
| Email Beta | Folder list, conversation preview and reading pane on wide layouts. Narrow layouts open the conversation separately. The composer keeps recipient and subject visible, with labelled icon buttons and keyboard send. |

## Interaction references

- [Gmail formatting and keyboard actions](https://support.google.com/mail/answer/6594/keyboard-shortcuts-for-gmail-computer) informed the compose toolbar and keyboard send.
- [Outlook reading pane and list density](https://support.microsoft.com/en-us/outlook/change-the-look-of-your-mailbox-in-outlook-com-and-outlook-on-the-web) informed the separation of folders, previews and reading.
- [Apple Mail conversation reading](https://support.apple.com/guide/mail/read-and-respond-to-emails-mlhlp1010/mac) informed moving between messages and keeping earlier context collapsed.
- [Astryx Neutral foundations](https://astryx.atmeta.com/blog/how-astryx-works) supply the spacing, shape and semantic roles.

## Impact and verification

Existing access checks, writes and endpoints still apply. Previous and next use the current list page and the existing single-thread request. There are no additional idle reads, polling, background writes or telemetry fields. HTML isolation, scoped lead access and plain-text fallback carry through. The shared entry loads the neutral theme, while the larger component CSS and editor stay tied to their routes.

Run `npm run design:dev` and open `/design-review.html`. The canvas uses the app's demo and isolated admin, enquiry and Email fixtures. The synthetic transport cannot send real email. The production build excludes the fixtures.

Browser review covered sidebar navigation at desktop width, the lead stage menu and full record, a narrow new-enquiry dialog, alignment of all four desktop filters, custom multi-select editing at phone and tablet widths, and synthetic email reading and composing at phone, tablet and desktop widths. Also checked the workbook review and a task dialog in dark Book mode at 125% interface scale. Physical-device and Safari review, refreshed public captures and production promotion belong to release acceptance.

### Homepage and installation

The WebP screenshots under `apps/web/public/product-home/` use demo records or isolated Admin fixtures for Email, Import, Lead Assistant, Lead Hygiene, and lead scoring. The browser captures include a 1360 × 850 desktop and a 390 × 810 phone. The assistant and import use narrower crops for legibility. Crops focus on the featured controls and hide scrollbars during capture. The live workspace keeps its scrolling behavior. The hero loads the dashboard first and defers the remaining images. There are 15 screenshot subjects with light and dark captures at standard and high density. Each theme has about 0.5 MiB of standard WebP images or 1.1 MiB of high-density images across the whole page. The browser loads active variants only, with lower images requested near the viewport. The primary dashboard is about 51 KiB at standard density and 129 KiB at high density. Screenshots open in a keyboard-accessible viewer whose Actual size option preserves readable type on a phone. The lead worksheet and record use full-width frames, and Lead Intelligence uses wide rows. The homepage adds no API calls or Firestore reads. The startup mark and homepage motion add no domain actions or telemetry events. Chromium tested the homepage at eight widths from 320 to 1920 CSS pixels, including short windows and both sides of the 680 CSS pixel breakpoint. Images, feature links, dark mode, both demo actions, and the collapsed sidebar mark were verified. The theme and motion follow-up exercises explicit day/night overrides and changes to the device theme, asset dimensions, native anchor links, the one-time media entrance, and reduced-motion preferences. Chromium checked all 30 high-density files, density selection, and opening, scrolling, closing and restoring focus in the screenshot viewer at phone width. The launch test blocks the main module in Chromium to inspect the HTML loader, then allows startup and verifies its handoff to sign-in.

The homepage covers leads and companies, tasks and reminders, reporting, Email Beta and digests, Lead Assistant, lead scoring, Lead Hygiene, import and export, appearance, and installation. Sign-in and the in-memory demo remain available at the top.

The existing app identity and standalone launch route are preserved. Favicons, app and Apple touch icons, notification artwork, and the collapsed sidebar use the drone mark. Android has separate regular and maskable icons. Local Chromium reported zero installability errors and loaded all manifest icons. Installed behavior on device and Safari remains part of pre-production acceptance.
