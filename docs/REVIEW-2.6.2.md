# Ingress health repair and completed rollout

The first v2.6.1 rollout (main d91f048, run 41251966802) passed verification and
activated all five Functions plus the ingress revision. All 100 indexes are READY.
The cutover check then received Google HTML 404 for /healthz, so Hosting remained
2.6.0 and no 2.6.1 tag/release was published. The API itself returned structured
401 denials and all five transport probes subsequently passed on the ingress URL.

Google documents reserved Cloud Run paths, including some ending in z:
https://docs.cloud.google.com/run/docs/known-issues . The container import/local
transport preflight did not cover this managed routing limitation.

Issue #106 and milestone #12 were created before advancing the forward PATCH to
2.6.2. Because Functions had already activated, index-only same-version recovery
was ineligible. The original six milestone-6 fixes from PR #104 are retained.

The shared /ingress-health constant is used by runtime, deployer and tests. Check
HTTP status/JSON content type before parsing, then exact version/SHA/no-store.
Provider HTML and stale identities remain failures. Operational health has its
own route metric label; no new domain API or business event is added.

Regression covers actual local health identity, mismatch rejection and provider
HTML rejection. All five unauthenticated parser/denial probes remain mandatory
before Hosting cutover and afterward. No customer identifiers/credentials/writes
are used. Existing CSP, five-Function checks, private Storage, public Pages and
signal receipts remain required. Prior UI captures stay honestly versioned 2.6.1.

Tenant query verification is separate. A retry after the human reported the token
present still found no named indiacs-apps-oauth credential or access/refresh token
in the installed CLI context. Do not substitute another identity or claim tenant
searchability from ingestion. No Dynatrace MCP is loaded in this session.
