# v2.6.1 pre-publication review

Local evidence, 1 November 2026. This is not a production success certificate.

- Six scoped milestone-6 fixes remain on one patch candidate. No extra version bumps.
- Correct-entry author/Admin checks remain below current capability/lead access.
  Real Auth/Firestore tests cover denied peer, allowed author/Admin and revisions.
- Archive/assignment/batch cancellation queries match Pending outreach only and the
  new leadId/state/kind/id composite index. Private administrative tasks keep state;
  ordinary current delivery eligibility is unchanged. Missing historic kinds are
  not guessed. Restore never reschedules cancelled tasks or fabricates stage history.
- Restore is optimistic/scoped and preserves suppression, shared contact ownership,
  current workflow and histories. Newly acquired index conflicts roll back; accessible
  archived-only duplicates receive a recovery hint without disclosing hidden IDs.
- Ingress has a fixed HTTPS target, bounded raw/inflated body limits, safe parser and
  upstream failure envelopes, auth/App Check/PAT/header and binary preservation,
  backpressured response streaming and request deadlines. Business policy stays in API.
  Native Function URLs still have provider-owned transport behavior.
- Dedicated runtime/build identities, scoped private build storage/repository grants,
  no keys, bounded Cloud Run resources and automatic request-log privacy exclusion
  are provisioned. Traffic has not been cut over by this review.
- A pinned Node container reuses the existing production lock. CI runs real transport
  cases and keeps individual receipts; deployment requires ingress identity/parser
  verification before Hosting. Retries reuse immutable commit images.
- CSP was rehearsed on a local production build, first Report-Only then enforced.
  A synthetic inline script executed in Report-Only and was blocked when enforced.
  The app booted into the demo under enforcement. Installed Firebase Auth source
  identified the required apis.google.com loader; App Check/reCAPTCHA and configured
  Dynatrace CDN/beacon sources are explicit. API docs retain a stricter policy.
  Actual Google sign-in/FCM and live RUM remain separate post-publication boundaries.
- Isolated in-app Chromium used only fictional archives and a stubbed request adapter.
  Cancel made no restore; Confirm removed only the selected card. Measured layouts:
  343x568, 390x844, 768x720, 1024x600, 1828x1028 and 2560x900 CSS pixels. No horizontal
  document overflow; restore dialogs stayed within the viewport. Browser minimum
  width prevented an actual 320 CSS-pixel measurement. No physical-device/Safari
  certification. Current desktop/phone captures preserve these fixture limitations.
- Types, domain/unit, ingress, component, emulator, generated docs/contracts/skills,
  lint ratchet, release impact and secret scanning are local gates. Required exact-head
  PR CI and main deployment/live checks must still pass. Ingest receipts do not prove
  tenant searchability or native RUM-to-trace links; no Dynatrace query MCP is available.

Follow-up review before merge: CSP checks parse directive token sets and HTML rather
than substring/regex filtering. The meta policy precedes all scripts. Oversized
requests drain within the bounded transport ceiling before 413, avoiding an early
connection reset while the client uploads; stalled bodies receive a safe deadline.
The shared pre-cutover/live probe checks all five parser/denial cases without any
customer credential or write. The app deadline is 55 seconds, before Hosting’s 60.
Private Cloud Build df998655-995c-468e-87e9-070b94a7d8ae built the pinned container
and loaded locked production telemetry/gateway modules successfully. That preflight
certifies packaging, not production traffic or the later merge SHA.
