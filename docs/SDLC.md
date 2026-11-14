# SalesDrone delivery workflow

The [illustrated SDLC guide](https://theharithsa.github.io/SalesDrone/sdlc.html) opens with one connected flow from issue intake to production verification. Follow its branches for roadmap publication, failed checks, release recovery and runtime telemetry. The sections below it explain GitHub Actions, Firebase and Dynatrace in detail. Preview locally with `npm run docs:build` and serve `site/.build`.

| Stage | What happens | Tools and guidance |
| --- | --- | --- |
| Intake | Create or reuse an issue with user outcomes, acceptance checks and an assignee. Group related issues under an epic. Track outcomes in milestones and timing in GitHub Project sprints. | GitHub Issues and Projects, App Launchpad |
| Plan | Review the applicable module skill, permissions, privacy, cost and rollout. Agree any material product decisions. Assign the scoped issues to a version milestone before advancing the candidate once. | AGENTS.md, skill tree, module skills, FinOps, release readiness, `release:plan` |
| Build | Work on a branch. Use synthetic data, keep API contracts and docs current, record meaningful events, and update the changelog and impact plan. | React, Vite and TypeScript; Express/Firebase Functions, Firestore, Auth and App Check; OpenAPI and MCP; Git |
| Verify | Run targeted regressions, then CI checks including unit/API and component tests, real Auth/Firestore emulators, types, lint, builds, generated docs, secrets, and release scope. Inspect visible changes in isolated Chromium at measured widths and text sizes. | Node test runner, Vitest, Testing Library, Firebase emulators, Java 21, Chromium CDP, GitHub Actions, CodeQL and GitGuardian |
| Review and rehearse | Open an issue-linked PR to `pre-prod`. Review the exact head, merge after checks and verify the resulting deployment with synthetic data. | GitHub PRs, Actions, release skill |
| Promote | During the weekly window, promote the verified pre-production source through a PR to `main`. Confirm the promotion checks and authorization before merging. | GitHub PRs, pre-production deployment evidence |
| Release | Main verification reruns. Actions stage and verify Hosting, deploy rules and wait for indexes, deploy Functions and verify ingress, then promote Hosting. Publish the versioned GitHub release and build the curated Pages site. | GitHub Actions, OIDC/WIF, Firebase CLI, Cloud Run ingress, GitHub Releases and Pages |
| Observe and verify | Check exact version/SHA, API behavior and access denial, app UI where applicable, and Pages identity separately. Send safe CI/test/deployment events and application telemetry to Dynatrace. Record ingest acceptance separately from tenant queries. | OpenTelemetry, Dynatrace, dt-obs and the SalesDrone observability skill |
| Recover | Identify the failed phase and the live revision before retrying. When a published release needs a rollback, ship the revert through a new checked forward release. | Release readiness, release runbook, GitHub Actions artifacts |

## Roadmap and release notes

Create the feature issue first. Add a customer-facing title and a one-line paragraph under `## Public summary`. Apply `roadmap-public` after reviewing both for publication. Open labeled issues appear under Upcoming. A matching roadmap milestone adds its sprint window on the Roadmap. Issue changes can refresh Pages independently of the app release, with a daily refresh as a backstop. Removing the label or closing the issue removes it from Upcoming. Add shipped behavior to the versioned changelog in the implementation PR, and link it to the verified GitHub release. Issue closure alone does not establish shipment.

The static docs build uses Astryx and local assets for the Roadmap, Release notes, Product handbook and SDLC guide. It queries GitHub at build time and does not add application traffic or Firestore reads. The other site pages and the app follow their existing design systems while the Astryx workspace epic is in planning.

See [delivery policy](RELEASE-GOVERNANCE.md), [release runbook](RELEASE.md), [testing](TESTING.md), [observability](observability.md), and the [module skill tree](../skill-tree.md).

## Weekly releases and pre-production builds

Keep one versioned milestone for the weekly release. Pre-production can deploy
the candidate throughout the week. For example, `2.14.0 · build 3` identifies
an iteration of `2.14.0`; the Git commit and Actions run/attempt locate the
actual deployment. At the weekly window, promote the tested source to
production as `2.14.0` and publish one versioned changelog entry. The next
regular release with ready changes is `2.15.0`. Skip empty or unready windows.

Urgent incidents can take a reviewed out-of-cycle patch such as `2.14.1`.
Validate only the fix against production-compatible scope in pre-production
and carry the fix into the next weekly candidate. Public API versioning is
independent. The weekly window is an operating policy. See
[release governance](RELEASE-GOVERNANCE.md#weekly-production-cadence) for
automation still to be defined.

## Artwork

The two 1200 × 800 WebP illustrations in `site/assets/sdlc` were generated with ImageGen and visually reviewed. The delivery hero prompt used a cobalt survey drone over three folded paper tracks with illuminated waypoints. The verification illustration used overlapping sheets, a checkmark and a cobalt magnifying glass over a waveform. Both used warm ivory paper, an editorial paper-cut treatment, and no text or branding. The diagrams are HTML so their labels remain readable and selectable.

## Reading and maintaining the illustrated guide

The HTML guide uses a two-column editorial layout: a scrollable chapter directory
on wide screens and an in-flow directory on narrow screens. Numbered section
headings, a continuous release path, amber failure branches and the separate
GitHub Actions dependency diagram distinguish sequence from reference material.
Detailed service and tooling references use labeled rows instead of repeated cards.
Open Sans and Astryx remain the shared documentation foundation; SDLC styles are
scoped so the handbook, roadmap and release archive retain their own layouts.

The guide requires no client-side JavaScript, application requests or Firestore
reads/writes. Reuse the two existing local illustrations. Keep the main delivery
flow as selectable HTML with real section links, and preserve the ordered mobile
reading path and the named recovery branches when updating it.

## Beginner explanations and pre-production

The HTML guide now explains each handoff with its input, actions, output and exit
condition. It distinguishes local changes, pushed code, a merged PR, a deployment
and a published release. A daily-reminder example follows a proposed feature
through the flow; a glossary explains the services and vocabulary. Runtime task
completion is a separate walkthrough from the delivery pipeline.

The [pre-production workspace](https://sales-drone-avinya-preprod.web.app/) is
live for approved test users. It uses a named Firestore database for synthetic
data. Promotion moves tested code from `pre-prod` to `main`; data stays in each
environment. See the [resource and acceptance plan](PRE-PRODUCTION-PLAN.md) and
[#226](https://github.com/theharithsa/SalesDrone/issues/226) for remaining
verification.

Teaching references are linked in the HTML guide: Atlassian's SDLC overview,
Diátaxis explanation/tutorial guidance, and primary Firebase/GitHub environment
documentation. The actual SalesDrone sequence is checked against source rather
than copied from a generic SDLC diagram. Explanations live in
`scripts/sdlc-learning.mjs`; composition stays in `scripts/sdlc-guide.mjs`.
