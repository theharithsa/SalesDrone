# Vite, TypeScript and ESLint migration

v2.9.3 · issue #138 · follows the v2.9.2 [dependency review](DEPENDENCY-REVIEW.md).
The earlier holds on #77, #78 and #80 are resolved by a coordinated build/tooling
migration, rather than installing unsupported peer combinations.

## Supported boundaries

- Root-owned Vite 8.3.5 and React plugin 6.2.1 serve both the app and component
  runner. Rolldown/Oxc replace Rollup/esbuild/Babel for the normal React path.
  No custom Babel transforms or Rollup plugins need porting. Keep the API portal
  development middleware and conditional production RUM injection unchanged.
- Explicit build targets preserve Vite 7 support: Chrome/Edge 107, Firefox 104,
  Safari 16. Vite 8's newer default must not silently narrow browser support.
- `typescript-7` aliases stable TypeScript 7.0.2. `scripts/typecheck.mjs` selects
  that compiler explicitly for web check/build. Never trust bare `tsc`: the
  compatibility package's transitive dependency can claim the same npm bin link.
- `typescript` aliases Microsoft's `@typescript/typescript6` 6.0.2, providing the
  JavaScript compiler API required by typescript-eslint 8.72.1. This is lint API
  compatibility, not the application's compiler. No nightly or unsupported
  TypeScript 7 programmatic API is used.
- Main lint uses ESLint 10.14.0 / @eslint/js 10.0.1 with existing TypeScript and
  React hooks checks. Config selection is explicit, avoiding v10 lookup changes.
- Private workspace `tools/accessibility` owns ESLint 9.39.5 and jsx-a11y 6.10.2
  inside their supported peer range. Its accessibility-only pass covers the same
  web source and recommended rules at the same severities. Main lint aggregates
  both passes before error and warning-baseline checks. Neither pass can fail
  silently. The existing baseline is unchanged; no accessibility rule is removed.
  Narrow comments retain the two intentional post-use credential reference releases
  flagged by ESLint 10's new no-useless-assignment rule; this is not string zeroization.

This temporary supported split can collapse when jsx-a11y supports ESLint 10 and
when typescript-eslint supports the native compiler API. Do not widen peers, fork
plugin metadata, use force/legacy-peer-deps, disable checks or inflate the baseline.
All compatibility dependencies are development tooling, never browser bundle APIs.
The private workspace is not an independently released service or application.

## Required evidence

`tests/toolchain.test.ts` exercises real tools: native compiler identity plus valid
and invalid assignments, main lint unused bindings/conditional hooks, and actual
accessibility failures/valid labelled controls. `npm run check`, production build,
component tests and form SSR checks must use the upgraded pipeline. A clean npm ci
must resolve both supported lint boundaries without overrides or ignored peers.

Use the approved browser with synthetic demo data for development startup, React
Fast Refresh with preserved state after a temporary source edit, restoration of
that edit, and built preview navigation/lazy chunks on desktop and phone. Record
viewport/theme/console evidence separately; emulator and jsdom are not native
Safari or physical-device certification. No intended screen/style change means
existing public captures retain their original versions.

Full PR/main CI, real emulators, release/version/milestone, security, docs and
per-case receipt checks remain required. Post-deploy acceptance checks exact live
SHA/version, protected APIs, ingress, Functions and public guides. Confirm separate
Dynatrace transport and tenant queries; native RUM linkage is not implied.

API 1.29.0, permissions, data, settings, credentials and business events are unchanged.
Reuse existing release/CI observability; tooling adds no customer operation.
Rollback is a forward PATCH PR, not a recycled release tag.

## Primary references

- [Vite 8 migration](https://vite.dev/guide/migration.html)
- [TypeScript's supported side-by-side compiler/API setup](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-rc/#running-side-by-side-with-typescript-6-0)
- [ESLint 10 migration](https://eslint.org/docs/latest/use/migrate-to-10.0.0)
- [typescript-eslint supported dependencies](https://typescript-eslint.io/users/dependency-versions/)
- [jsx-a11y peer metadata](https://registry.npmjs.org/eslint-plugin-jsx-a11y/6.10.2)

Local browser evidence: development Fast Refresh changed and restored the Overview
heading while retaining the selected Leads added trend. Built preview reviewed at
measured 2057×1286 CSS pixels (Assistant lazy route, light mode) and 390×843
(lead cards/light and Tasks/dark), without horizontal document overflow or console
errors. Temporary source edits were removed. Clean npm ci, native check/build,
34 component cases, three toolchain regressions and five real form SSR checks passed.
The native compiler lock retains every published optional platform package, including
the NetBSD ARM64 entry omitted by npm's initial platform-specific lock update; its
version, tarball and integrity were verified against the official npm registry before
clean-install validation. PR/main CI and production acceptance are separate gates.
