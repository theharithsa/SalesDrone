# v1.8.0 lead overview and display scale review

Synthetic browser review on 26 October 2026. No production lead data was opened or exported. Captures in the screenshot manifest describe their actual source viewport and pixel sizes. Source: v1.8.0 working tree before the release commit; exact deployed SHA is supplied by the workflow artifacts.

## Observed checks

- Five saved scales (85/90/100/110/125) across requested390/768/1024/1280/1920px widths: 25 layout combinations; document overflow was zero. Narrow widths390/768 retained computed zoom1; desktop widths applied the selected scale.
- Scale draft did not change global layout until Save. Restoring100 and disabling Book mode returned the standard appearance. Real per-member persistence and authorization are covered by API tests; guest browser checks exercise local demo preferences only.
- Actual full lead and overlay show one identity, aligned label/value roles and score near stage/assignment. The header stacks at smaller content widths; mobile workflow controls stack. The journey scrolls locally with separate explanation/history disclosures.
- Native pointer drag at85% moved 100 screen pixels and changed blade width 360→478 layout pixels; at125% the same drag changed 360→440. Keyboard Home/End reached bounded widths. This caught and fixed an overlay max-height issue; final lower bounds stayed inside the 900px viewport at both extremes.
- All/Calls/Tasks switched to the correct content; Edit opened the actual enquiry dialog and Cancel/Close returned to the lead. Light/Dark and Book-mode lead layouts were visually inspected. Known-score visual fixture uses the real badge/header with explicit fictional reports: unknown,0,25 with reported risk,74 and100. Unknown stays dashed and zero stays empty solid; accessible labels retain the score and risk.
- Public captures refreshed for lead table, overlay, full workspace/journey, phone/tablet/laptop, Book mobile/settings and personal appearance controls. Score fixture is labelled separately and makes no server calls. Temporary entrypoints are removed before build.

## Automated and delivery checks

The [testing guide](TESTING.md), [module cases](../qa/test-cases.json) and [testing skill](../skills/salesdrone-testing/SKILL.md) define repeatable suites. Backend/API and root tests currently total 152. QA quick checks also validate types, generated API consistency, docs, skill routing and release readiness. Results belong to the runner/workflow output, not this plan. The first readiness attempt correctly failed while current screenshots were missing; it was rerun after the manifest update.

Java is unavailable locally, so real Auth/Firestore emulator integration is required in CI before deployment. Browser layout checks do not certify physical touch devices, every browser implementation, native accessibility zoom or Dynatrace tenant searchability. The case catalog includes additional regression scenarios for future testing; its existence does not mean every scenario has been executed in this review.
