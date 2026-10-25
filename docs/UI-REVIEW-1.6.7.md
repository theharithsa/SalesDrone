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
