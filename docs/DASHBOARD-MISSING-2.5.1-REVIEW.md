# Missing-category labels: v2.5.1

The v2.5.0 production guest review exposed concatenated Not recorded / Missing value text in the pipeline cards and composition legend. The forward patch separates primary labels and helpers, clamps primary text independently and reserves a consistent card label area so counts align. Grouping data, saved settings, permissions, APIs and telemetry remain unchanged.

Focused local Chromium review passed ten viewport/theme combinations: 390, 768, 1024, 1440 and 1920 CSS pixels in light/dark. Both helpers sit at least 3px below the primary label; card counts align within 1px and the page does not overflow. Desktop/phone missing-state and populated-category captures were visually/privacy reviewed before curation. Fixtures are the isolated fictional guest app and Admin dashboard preview; no customer data or writes.

Local validation uses the focused browser check, types/production build and fixture-exclusion check, docs/settings/skills/release gates and credential/export scan. Broad local domain suites are not repeated for this markup/CSS-only change; normal PR and main CI still provide required regression checks. The versioned release plan records expected gates, not deployment success.

Physical devices, Safari and Dynatrace tenant queries are not certified. Post-deploy verification must separately confirm exact version/SHA, API 1.21.0, active functions, public guides, guest missing-label geometry and monitoring receipts. Earlier 2.5.0 screenshots remain historical unless their visible affected state was recaptured; no old image is restamped.
