# Reviewed dependency maintenance

4 November 2026 · issue #136 · candidate v2.9.2 · API 1.29.0 unchanged.

## Six Dependabot PRs

| PR | Requested update | Disposition and compatibility evidence |
| --- | --- | --- |
| #75 | Eight pinned Actions releases | Integrate in one governed patch. Every SHA matches its official actions/* release tag. Node 24 action runtimes run on ubuntu-latest; application setup-node remains 22. Keep OIDC permissions, nonpersistent checkout credentials, artifact names/paths, retention and independent Pages/monitoring gates. |
| #79 | Vitest 4.1.12 → 5.0.5 | Integrate after real runner checks. Node >=22.12 and Vite >=6.4 requirements fit Node >=22.18 / Vite 7.3.7. Existing reporter uses supported onTestCaseResult/onTestRunEnd hooks; reconcile leaf receipts rather than only process exit. Ignore the new default .vitest artifact directory. No browser-mode/benchmark/removed entrypoint APIs are used. |
| #105 | Firebase JS 12.19.0 resolved → 13.1.0; CLI 15.34.1 → 15.34.2 | Integrate with real client Auth emulator and build/CSP checks. App imports app/auth/app-check/messaging; SDK 13 breaking AI Logic APIs are unused. Gemini is server-side. Do not upgrade Admin SDK, Functions SDK, Firestore rules or IAM as part of this PR. |
| #77 | React plugin 5 → 6.1.2 | Hold: plugin 6 explicitly peers on Vite ^8.0.0; current app is Vite 7.3.7. Schedule the Vite 8/Oxc build and HMR migration together; do not force peer installation. |
| #78 | ESLint 9 → 10.14.0 | Hold: installed eslint-plugin-jsx-a11y 6.10.2 peers only through ESLint 9. Review compatible plugin/config packages and lint behavior together; do not remove accessibility linting or rewrite the warning baseline to make this pass. |
| #80 | TypeScript 5.9.3 → 7.0.2 | Hold: installed typescript-eslint 8.72.1 requires TypeScript >=4.8.4 <6.1.0. Coordinate the native compiler/tooling migration; do not suppress unsupported compiler or peer checks. |

Original bot checks were red. Actions/Vitest/Firebase reached the required module/release
guard rather than a behavioral pass; ESLint and TypeScript also have installation
peer failures. A checked integration PR carries the reviewed dependency deltas plus
one version, milestone, changelog and module guidance. Originals are superseded only
after that replacement passes and merges; they are not described as individually
passing or merged. The three migration PRs stay open with concrete blockers.

## Verification gates

- Clean dependency installation without --force or --legacy-peer-deps; review lockfile deltas and exact resolved versions.
- Real component tests plus their independent emitted/expected leaf receipts.
- Actual Firebase client Google sign-in/forced ID-token refresh, server verification,
  unapproved /me demo isolation and client sign-out against demo-salesdrone Auth emulator.
- Existing CSP test discovers the installed App Check SDK token-exchange origin;
  retain that origin in all SPA policies. Backend emulator/policy/deny-all rules remain.
- Types, lint without baseline inflation, API generation, unit/API/emulator suites,
  production/curated docs builds, skills/readiness/version/secret checks.
- Read-only startup of the built app; no customer writes, notification prompt, token
  issuance or provider-console changes for verification. No intended design change;
  prior screenshot versions remain honest.
- PR CI checks the untrusted verify path without deploy secrets. After authorized
  merge, main separately validates Functions, ingress, Hosting, Pages and every
  monitoring transport. Reconcile actual case events/metrics after eventual indexing.

Do not claim browser popup/redirect, managed attestation, native Safari/physical-device
behavior or native RUM linkage from the emulator/client test. Post-deploy artifacts
are distinct from this implementation plan. Revert dependency/code changes only through
a forward PATCH PR if needed; do not recycle a version/tag or bypass gates.

## Primary references

- [Vitest 5 migration](https://vitest.dev/guide/migration/)
- [Firebase JS SDK releases](https://firebase.google.com/support/release-notes/js)
- [React plugin 6.1.2 registry peers](https://registry.npmjs.org/@vitejs%2fplugin-react/6.1.2)
- [Accessibility plugin peers](https://registry.npmjs.org/eslint-plugin-jsx-a11y/6.10.2)
- [TypeScript ESLint peers](https://registry.npmjs.org/typescript-eslint/8.72.1)
- [ESLint 10 migration](https://eslint.org/docs/latest/use/migrate-to-10.0.0)

Eight reviewed official pins: checkout v7.0.1, setup-node v7.1.0, setup-java v6.1.0,
upload-artifact v7.0.2, configure-pages v6.0.0, upload-pages-artifact v5.0.0,
deploy-pages v5.0.1 and download-artifact v8.0.2. Keep exact immutable SHAs in the workflow.

Local review receipts: 34 component cases with 34 emitted/expected receipts, 15 focused
security/reporting tests and 14 real emulator cases passed. Type checking, production
build, lint (zero errors; existing 46 warnings), docs, skills, release readiness and
secret scan passed. The Vite demo dashboard and Leads page started without console
errors. Full PR/main CI and production acceptance remain separate gates.
