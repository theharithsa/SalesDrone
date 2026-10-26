# v1.6.7: review across screen sizes

This release broadens the typography/layout correction to the whole application. Existing Google Sans, Manrope, Caveat branding and Book-mode serif families are preserved. [Design principles](DESIGN-SYSTEM.md) adapt [Apple typography guidance](https://developer.apple.com/design/human-interface-guidelines/typography) to CSS roles; this is not native Dynamic Type certification.

## Observed browser checks

Requested widths: **320, 375, 600, 767, 767.5, 768, 900, 1000, 1000.5, 1001, 1024, 1100, 1280, 1440, 1600, 1920 and 2560 CSS pixels**. The browser rounds innerWidth for fractional requests. Window heights of **600, 768, 900 and 1080px** were also checked at laptop width.

The sweep covered login, dashboard, lead list, desktop inspection overlay and dedicated lead page, tasks, inbox, profile/appearance, and isolated real admin Settings and Import components. Admin fixtures covered fields, people, scoring, insights, reports, developer settings and the token form. Fixtures use fictional records and stub requests; no membership, token, customer or import was created in production.

Final measured surfaces had no horizontal document overflow. Tables, journeys and tabs may scroll within their own surfaces. The initial 320px login overflow was fixed and rescanned across the width matrix. Dialogs were checked at 320/600/768/1024/1280/1440/1920px; they now select one or two columns from actual dialog width.

Standard mode, both palettes and Book mode were reviewed. A 200% default-text fixture at 375/1024/1440px retained 34px body text without document overflow. This simulates a larger root text size; it is not physical-device testing, native Dynamic Type or actual browser zoom. Those remain separate checks.

Interaction checks included chart-day selection (changing to the first day updated its summary), lead open/back and tabs, notification overlay, sidebar collapse and aligned icon positions, theme/Book-mode changes, and the synthetic workbook chooser/mapping. At a 600px window height, scrolling the sidebar exposed Sign out. Synthetic CSV mapping was reviewed without committing an import.

## Release evidence

Unit tests: 100 backend and 42 root tests passed locally. Type checking passed. Build, generated documentation, skill checks and release gates run before publication; the GitHub workflow retains separate deployment/postcheck and Dynatrace receipt artifacts. A release plan is not proof of a successful deployment. HTTP ingestion acceptance is not tenant searchability.

Reviewed captures include phone, tablet, laptop and desktop surfaces; their versions, viewport dimensions and hashes are in the [public screenshot manifest](../site/assets/screenshots/manifest.json). Only synthetic app data, isolated component fixtures and public schemas are allowed. Temporary review entrypoints are removed before production build.

## Same-version maintenance: alignment and duplicate content

User explicitly authorized keeping v1.6.7. releases/maintenance.json binds that authorization to the exact initial release commit; the original tag is preserved.

The follow-up review checks customer-name start alignment at normal app CSS scale (zoom 1, no global scaling workaround) across 320/390/768/1024/1280/1440/1920px requested widths. Synthetic long, unbroken, one-character, missing and non-Latin names share the same button left edge; wrapping keeps start alignment. Local table scrolling is intentional. These CSS-layout checks do not certify physical-device/browser-zoom combinations.

With full lead details expanded, the observed DOM contains exactly one Log call, one Remind me, one Lead information heading and one phone value in the labelled detail list. The sidebar has no reminder banner and has one Set a reminder menu button. The call/reminder actions were opened and cancelled without saving. The menu shortcut retains capability filtering and closes mobile navigation before opening its form.

API, PAT scopes, suppression rules, contact review guards and backend observability are unchanged. Only synthetic browser data is used in public captures. Deployment evidence is distinguished by commit/run rather than a new displayed version.

## Same-version maintenance: compact desktop and detail-first editing

A further explicit user request keeps v1.6.7 and binds maintenance to parent ee92a973aded44965c8089eeb12ea1f362a7ce02. Fine-pointer desktop density reduces spacing and shell width while preserving 17px reading/form text, using 14px table data and 13px headers. Row/card Edit controls and the Actions column are removed. Open a lead to edit it.

Synthetic measurements at requested 1280px: fully visible lead data columns increased from 5 to 8; at1440px from 7 to all 9. The baseline count excludes the former sticky Actions column. Typical row height fell from 60.7px to 48.7px. Configured customer data can change these counts; they are measured fictional-fixture results, not a guarantee for every custom schema. No whole-app scaling was applied.

Review covers390/768/1024/1280/1440/1920px layouts, expanded/collapsed navigation, mobile cards, full lead and overlay editing, configured-hidden-name keyboard access, both palettes and Book mode. Browser source viewports may round fractional CSS pixels. API/permission/audit contracts and the original release tag remain unchanged. Deployment checks and tenant ingestion receipts are recorded separately by commit/run.
