# API ingress contract — v2.6.1

Release candidate implementation for #30; new ingress was explicitly selected on
1 November 2026. Production is still 2.6.0 until the verified patch deploys.

A Cloud Run service named salesdrone-ingress in asia-south1 receives the existing
Firebase Hosting /api/** rewrite. /api/docs remains the static API portal. The
existing api Function and four scheduled Functions remain; business policy is shared
by forwarding, not copied. Public integrations continue to use Hosting /api/v1.

## Request and response behaviour

Validate JSON syntax/strict object-or-array framing before the managed Functions
parser. Use 400 BAD_JSON and 413 PAYLOAD_TOO_LARGE with fixed safe messages and
request/version headers. Preserve empty-body handling and backend structured errors.
The application JSON ceiling is 12 MiB, binary attachment transport is 8 MiB; bound
compressed and decoded representations. Platform rejections before our ingress
(including network/HTTP framing and platform hard limits) remain provider-owned.

Forward only to a configured fixed HTTPS api Function origin, preserving path/query,
Firebase/PAT Authorization, App Check, Idempotency-Key and binary bytes. Strip
hop-by-hop, Host and untrusted serverless-identity forwarding headers. Never accept
an arbitrary upstream or fabricate a member identity. Backend auth/capabilities,
lead/task scope and transactional validation remain authoritative. Malformed bodies
never reach domain handlers or create records.

Existing native Function URLs remain for compatibility; their provider-level parser
responses are outside the supported Hosting contract. Do not claim this proxy changes
the native Functions Framework or every load-balancer error on unrelated hostnames.

## Service and rollout

Use a dedicated account with no database/Auth/Gemini roles; bind only the existing
Dynatrace telemetry secret. Provision via a reviewed idempotent script and WIF, without
keys. Build a pinned Node 22 container, deploy with bounded concurrency/memory/timeout
and scale-to-zero, verify the revision, then deploy Hosting's rewrite. Preserve backend
compatibility until cutover and record safe ingress metadata with the five Functions.

Reuse the sanitized OTel foundation for service logs/metrics/traces; no business event
is invented by proxying or rejection. Exclude automatic ingress request access logs
that contain raw URLs/queries; retain sanitized application outcomes. Test-case and
release events stay in the existing lifecycle pipeline. Ingest is not tenant search.

Rollback is a reviewed forward patch restoring the prior Hosting rewrite or a prior
compatible ingress revision. Do not remove the working API or undo customer data.

References: [Functions Framework parser](https://github.com/GoogleCloudPlatform/functions-framework-nodejs/blob/main/src/server.ts),
[Hosting Cloud Run rewrites](https://firebase.google.com/docs/hosting/cloud-run).

Runtime resources: one CPU, 1 GiB, concurrency 2, min 0/max 3 instances, 75-second
platform timeout and a 65-second application deadline. CPU remains allocated while
an instance is alive to permit bounded post-response OTel flushing. This adds a
separate scale-to-zero Cloud Run workload; it is not a free-tier guarantee. The
private build-source bucket expires build archives after seven days, without
changing customer/import/chat retention. Images are immutable commit tags using a
pinned Node 22 base digest and the existing functions production dependency lock.

The SPA policy allows Firebase Auth's Google API loader, reCAPTCHA/App Check and
the configured Dynatrace CDN/beacon, with self-hosted fonts and blob workers. It
blocks inline scripts/eval and objects; existing React styles still need inline
style support. SPA header routes plus an index meta policy cover fallback paths;
reserved Firebase Auth helpers keep provider behavior. API docs retain their
stricter separate policy. A local report-only/enforced probe is separate from
Google sign-in and live RUM acceptance.
