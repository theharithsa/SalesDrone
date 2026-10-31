# Release governance and carryover audit

Pre-release production baseline verified on 31 October 2026: **2.5.3**, commit `3ebd2f104a1939dcbcef9b4a41338f926713dde3`. The local **2.6.0** value is a candidate, not a published upgrade. Publication is authorized and proceeds only through the implementing PR and required checks.

## Required release sequence

1. Create the versioned GitHub milestone and assign its concrete issues. Use `release:plan`; a version bump without that scope fails.
2. Keep one candidate version throughout implementation, local refinements and PR review. Group compatible fixes into a PATCH release; use MINOR for a substantive compatible capability.
3. Complete and review the scoped work. Mark the plan ready only after its acceptance criteria and required checks have evidence.
4. A PR must cover every open issue in that milestone using explicit closing references, or link already completed work. CI checks current GitHub assignments.
5. Publication requires the milestone issues to be closed after merge. Required CI, production version/SHA, documentation and monitoring evidence remain separate gates.
6. Close the release milestone only after its release acceptance is complete. Preserve incomplete issues, decisions and historical scope; no paper closures or silent mass rescheduling.

## Current candidate

[v2.6.0 milestone](https://github.com/theharithsa/SalesDrone/milestone/5) contains #95 Lead Hygiene, #96 the dedicated Assistant and #98 release governance. Publication is gated by completed feature checks, PR scope and live milestone state. The 2.6.0 scope is Hygiene, Assistant and this release-governance repair; older issues remain separately open. #71 and #97 remain separate open observability work and must be explicitly triaged, not described as completed by research instrumentation.

## Historical milestone audit

The audit found 35 open issues in four old release-named milestones, plus four unassigned issues before #98 was created. All 35 remain open. These are real outstanding implementation/decision/epic items; old version names are not proof of completion. No original milestone assignment has been silently changed.

| Issue | Historical milestone | Audit disposition |
| --- | --- | --- |
| [#4](https://github.com/theharithsa/SalesDrone/issues/4) Bug: archived leads cannot be restored and still block their contact details (DUPLICATE) | v2.0.2 — Correctness fixes | Implementation/operational acceptance remains open |
| [#7](https://github.com/theharithsa/SalesDrone/issues/7) Epic: Hot-path performance & cost | v2.2.0 — Performance & maintainability | Cross-release epic; child completion still outstanding |
| [#8](https://github.com/theharithsa/SalesDrone/issues/8) Epic: Security hardening | v2.1.0 — Security, data retention & CI/CD | Cross-release epic; child completion still outstanding |
| [#9](https://github.com/theharithsa/SalesDrone/issues/9) Epic: Codebase modularisation & tooling | v2.2.0 — Performance & maintainability | Cross-release epic; child completion still outstanding |
| [#11](https://github.com/theharithsa/SalesDrone/issues/11) Epic: CI/CD consistency | v2.1.0 — Security, data retention & CI/CD | Cross-release epic; child completion still outstanding |
| [#12](https://github.com/theharithsa/SalesDrone/issues/12) Epic: Behaviour decisions needed from the code review | v2.0.2 — Correctness fixes | Cross-release epic; child completion still outstanding |
| [#13](https://github.com/theharithsa/SalesDrone/issues/13) Epic: Product roadmap from the code review | v2.3.0 — Product roadmap | Cross-release epic; child completion still outstanding |
| [#14](https://github.com/theharithsa/SalesDrone/issues/14) Decision: should activity corrections be limited to the author or Admin? | v2.0.2 — Correctness fixes | Behaviour/product decision remains open |
| [#15](https://github.com/theharithsa/SalesDrone/issues/15) Decision: which pending tasks should reassignment and archive cancel? | v2.0.2 — Correctness fixes | Behaviour/product decision remains open |
| [#16](https://github.com/theharithsa/SalesDrone/issues/16) Decision: /summary KPIs hardcode the 'New' stage and 'Connected' outcome | v2.0.2 — Correctness fixes | Behaviour/product decision remains open |
| [#17](https://github.com/theharithsa/SalesDrone/issues/17) Decision: should activity corrections bump lead.version? | v2.0.2 — Correctness fixes | Behaviour/product decision remains open |
| [#18](https://github.com/theharithsa/SalesDrone/issues/18) Decision: support more than two administrators / owner transfer | v2.0.2 — Correctness fixes | Behaviour/product decision remains open |
| [#21](https://github.com/theharithsa/SalesDrone/issues/21) Bug: archive cancels all pending tasks while the UI says only outreach is cancelled | v2.0.2 — Correctness fixes | Implementation/operational acceptance remains open |
| [#23](https://github.com/theharithsa/SalesDrone/issues/23) Epic: Lead lifecycle & data-integrity bugs | v2.0.2 — Correctness fixes | Cross-release epic; child completion still outstanding |
| [#24](https://github.com/theharithsa/SalesDrone/issues/24) Ops: idempotency records (requests) never expire and store full responses | v2.1.0 — Security, data retention & CI/CD | Implementation/operational acceptance remains open |
| [#25](https://github.com/theharithsa/SalesDrone/issues/25) Ops: clean up aiBudgets, delivery, importChunks and pushTests collections | v2.1.0 — Security, data retention & CI/CD | Retention work remains open; approved import details must persist until Admin deletion |
| [#26](https://github.com/theharithsa/SalesDrone/issues/26) Epic: Firestore data retention & TTL | v2.1.0 — Security, data retention & CI/CD | Cross-release epic; child completion still outstanding |
| [#27](https://github.com/theharithsa/SalesDrone/issues/27) Security: add Content-Security-Policy and HSTS to the main app | v2.1.0 — Security, data retention & CI/CD | Implementation/operational acceptance remains open |
| [#28](https://github.com/theharithsa/SalesDrone/issues/28) Security: make bootstrap admins and workspace root configurable | v2.1.0 — Security, data retention & CI/CD | Implementation/operational acceptance remains open |
| [#30](https://github.com/theharithsa/SalesDrone/issues/30) API: map body-parser errors to proper error codes | v2.1.0 — Security, data retention & CI/CD | Partial application fix in PR #72; managed Functions Framework parser boundary remains open (reopened with live evidence) |
| [#33](https://github.com/theharithsa/SalesDrone/issues/33) CI: narrow the partial-deploy window and document rollback | v2.1.0 — Security, data retention & CI/CD | Implementation/operational acceptance remains open |
| [#35](https://github.com/theharithsa/SalesDrone/issues/35) Perf: avoid hot-document contention in Firestore rate limiting | v2.2.0 — Performance & maintainability | Feature/refactor remains open; no verified completion |
| [#37](https://github.com/theharithsa/SalesDrone/issues/37) Search: make search semantics consistent across fields | v2.2.0 — Performance & maintainability | Feature/refactor remains open; no verified completion |
| [#39](https://github.com/theharithsa/SalesDrone/issues/39) Perf/cost: replace per-minute schedulers with event-driven triggers | v2.2.0 — Performance & maintainability | Feature/refactor remains open; no verified completion |
| [#40](https://github.com/theharithsa/SalesDrone/issues/40) Perf: raise reminder dispatch throughput (sequential, 50/min cap) | v2.2.0 — Performance & maintainability | Feature/refactor remains open; no verified completion |
| [#44](https://github.com/theharithsa/SalesDrone/issues/44) Refactor: split functions/src/app.js into per-module routers | v2.2.0 — Performance & maintainability | Feature/refactor remains open; no verified completion |
| [#45](https://github.com/theharithsa/SalesDrone/issues/45) Refactor: split apps/web/src/App.tsx (3.8k lines) | v2.2.0 — Performance & maintainability | Feature/refactor remains open; no verified completion |
| [#46](https://github.com/theharithsa/SalesDrone/issues/46) Refactor: consolidate the layered global CSS files | v2.2.0 — Performance & maintainability | Feature/refactor remains open; no verified completion |
| [#54](https://github.com/theharithsa/SalesDrone/issues/54) Feature: merge duplicate leads | v2.3.0 — Product roadmap | Feature/refactor remains open; no verified completion |
| [#55](https://github.com/theharithsa/SalesDrone/issues/55) Feature: apply batch edits to all rows matching a filter | v2.3.0 — Product roadmap | Feature/refactor remains open; no verified completion |
| [#56](https://github.com/theharithsa/SalesDrone/issues/56) Feature: offboarding — reassign a deactivated member's leads and reminders | v2.3.0 — Product roadmap | Feature/refactor remains open; no verified completion |
| [#57](https://github.com/theharithsa/SalesDrone/issues/57) Feature: signed webhooks for lead and task events | v2.3.0 — Product roadmap | Feature/refactor remains open; no verified completion |
| [#58](https://github.com/theharithsa/SalesDrone/issues/58) Feature: calendar (ICS) export for reminders | v2.3.0 — Product roadmap | Feature/refactor remains open; no verified completion |
| [#59](https://github.com/theharithsa/SalesDrone/issues/59) Feature: full-text search across leads and notes | v2.3.0 — Product roadmap | Feature/refactor remains open; no verified completion |
| [#60](https://github.com/theharithsa/SalesDrone/issues/60) Feature: stage conversion and time-in-stage analytics | v2.3.0 — Product roadmap | Feature/refactor remains open; no verified completion |

## Evidence-bounded triage

#30 cannot be closed from passing inner Express tests: its issue comment records a managed-runtime parser response outside the app envelope. #59 is not completed by an Assistant vector index; it includes product-wide lead/note search. #60 is not completed by observed monthly conversion counts; its broader stage/time-in-stage analytics remain. #15/#21 must be resolved before adding archive actions to Hygiene; the current report stays read-only.

Carryover disposition for this release: keep the historical issues open and outside 2.6.0; no retargeting or completion is implied. Correctness/security issues take priority in subsequent scoped PATCH planning; product epics and unresolved behaviour decisions require their own acceptance scope. #98 establishes this audit and enforced release rules, rather than claiming all historical work is fixed. The audit does not authorize guessing the open behaviour decisions or changing retention rules. Historical release manifests/screenshots remain unchanged.

## Commands

Create the GitHub milestone first, assign its issue list, then prepare its impact plan:

```sh
npm run release:plan -- patch --milestone NUMBER --issues ISSUE1,ISSUE2
npm run release -- patch
```

The first command verifies GitHub scope and writes a new plan without changing versions; it refuses to overwrite an existing plan. The second rechecks the real milestone before touching package/changelog files. Use concrete numeric IDs. Current 2.6.0 review work keeps its existing version; do not run another bump.

CI receives only a read-only GitHub token for milestone checks. PR checks validate closing scope; main/publication checks require completed issue states. The plan remains `planning` while required work is unfinished.
