# App Check login CSP repair

Production 2.6.2 reproduced appCheck/fetch-network-error. Its live connect-src allowed firebaseappcheck.googleapis.com while the deployed and installed JavaScript SDK exchanges at content-firebaseappcheck.googleapis.com. Both the response header and HTML meta policy blocked that origin. The earlier network warning was incorrectly treated as browser-specific; it was not certification of sign-in.

Allow the exact SDK origin in every SPA policy and meta fallback. Keep App Check, membership checks, deny-all database rules and strict API documentation CSP. No layout, setting, domain API, data migration, IAM or business event changes are needed. Existing synthetic screenshots keep their historical versions.

The new regression discovers the origin from the installed SDK and checks every SPA policy and meta fallback. It failed on the original policy before the allowlist repair. Required PR/main checks and post-deployment artifacts are separate from managed-browser token-exchange verification. Never log attestation tokens, reCAPTCHA responses, user identities or customer data during verification.

Post-deploy header checks now also reject a live SPA policy missing the SDK exchange origin. This is policy verification, not proof of a completed token exchange or Google sign-in.

The first PR CI found a pre-existing clock mismatch in personalization.test.js: a fixed October token was verified by a second app using wall time after its seven-day expiry. Both fixture apps now share the injected clock; production code is unchanged.
