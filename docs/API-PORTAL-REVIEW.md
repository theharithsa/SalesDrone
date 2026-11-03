# API portal readability review

Issue #130 · candidate 2.8.2 · 3 November 2026.

## Cause and correction

The contract and scripts loaded successfully. Swagger's nested vendor selectors
outranked the portal's class-only overrides. Paths/descriptions, server labels,
tabs, response headers and OpenAPI 3.1 schema names retained vendor colors. The
filter input combined the portal foreground with the vendor's white background.

The portal now always uses the project's light Material 3 surface/outline/text
pairs, independently of OS and workspace appearance, as requested. ID-scoped
rules cover legacy and OpenAPI 3.1 schema renderers, controls and SVG paths. Code
uses a light tonal surface with readable monochrome text; vendor inline syntax
colors cannot reintroduce low contrast. Narrow method rows wrap path/description
without pushing authorization/expand controls outside the card. Auth dialogs
retain viewport-bounded internal scrolling. The app's theme settings are unchanged.

No API/schema, permission, token retention, request policy, stored setting or domain
write changed. Portal RUM/analytics remain absent. No new business event, API trace,
metric or log is appropriate for static styling; release lifecycle signals remain.

## Local evidence

- Public OpenAPI schemas only. No token entered and no API operation executed.
- Actual in-app Chromium layout widths: 360, 650, 651, 768, 1280 and 1920 CSS px,
  heights 700–900. No positive document horizontal overflow.
- Expanded GET /me response/schema DOM: 426–438 rendered text elements checked
  against the nearest opaque surface, with no calculated ratio below 4.5:1.
  This focused audit does not certify every schema, compositing effect or WCAG compliance.
- Entered filter text, endpoint paths, response/code, schema tabs and blank auth
  inputs checked. At 390×500 the dialog bounds were x9.2–359.4/y24–476, with 452px
  client height and 613px scroll height. These are measured DOM geometry checks.
- The browser screenshot backend returned blank images under some temporary viewport
  overrides. Narrow geometry was therefore not labelled screenshot acceptance.
  The default 1828×1028 desktop capture was visually inspected and shows the light
  task methods, filter value and readable labels. Public output is 1807×1016 pixels.
- The final desktop capture replaces api-portal-demo.jpg, with reviewed hash and
  current version in its manifest. Prior dark-palette investigation is not final acceptance.
- Focused contract/portal security tests passed (5 cases); types and production build
  passed. Full required PR/main checks provide separate execution artifacts.

Browser checks do not certify physical devices, Safari or native accessibility text
scaling. Post-deployment identity, live portal rendering and lifecycle reporting
must be verified separately from this local review.

## Regression recipe

Follow API-INTEGRATIONS-03 in qa/test-cases.json. Load the pinned vendor stylesheet
before portal CSS. Open a group and operation, enter a path filter, switch Example
Value/Schema, expand a nested property and inspect blank Authorize fields. Check
computed foreground/background pairs, SVG paths, short-dialog bounds and local
schema scrolling. Reload after editing static public CSS. Never use live credentials
or issue a write merely to verify documentation styling.
