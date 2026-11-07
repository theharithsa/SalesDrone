---
name: salesdrone-team
description: "Maintain SalesDrone Admin Team dashboards, workload and recorded member activity. Use for SDR team statistics and activity drill-downs; individual account grants belong to people-permissions and conversion analytics to dashboard."
---

# Admin Team insights

Read [SHARED.md](../SHARED.md), [release readiness](../salesdrone-release-readiness/SKILL.md) and the current API before changing behavior. This is a read-only business reporting module, not employee scoring, presence tracking or permission to delegate/deploy.

## Entry points and ownership

- [team.js](../../functions/src/team.js): bounded deterministic aggregates and fresh Admin checks.
- [app.js](../../functions/src/app.js): routes, encrypted member/period-bound activity continuations and minimal projections.
- [TeamPage.tsx](../../apps/web/src/features/TeamPage.tsx), [team.css](../../apps/web/src/material/team.css): overview, member activity, current stages and lead drill-through.
- [team-demo.ts](../../apps/web/src/lib/team-demo.ts): fictional local-only records. Never run live reporting to populate captures.

## Primary API ownership

- GET /api/v1/team
- GET /api/v1/team/members/{uid}/activities

## Reporting semantics

Google/App Check Admin role plus members:write is required; PATs require explicit team:read; Google sessions retain members:write. Current lead scope still applies. Recheck current membership/policy before publishing; a downgrade or scope change discards an in-flight report. Responses are no-store. Never return account emails, credentials, private chats or personal reminder content.

The legacy days parameter supports 7/30/90 UTC calendar days, default 30, including today up to generatedAt. Current workload counts unarchived assigned leads; inactive membership is separate from recorded work and never means offline. Leads worked is a distinct union of authored notes/calls and recorded stage changes by actor, regardless of later reassignment. Imported workbook notes do not count as authored work. Corrections keep original attribution and count once. Stage changes need a recorded from-stage; initial/import transitions are excluded. Never infer conversions or historical work from current stage labels.

Task backlog/completion follows recipient responsibility for accessible lead tasks only; a teammate may have closed the task. Do not present this as proof the recipient personally completed it. Deleted tasks and unlinked personal reminders are excluded. Last recorded work is within the selected period, not last login.

Overview scans cap at 200 members, 5,000 scoped leads, 10,000 activities, 5,000 tasks and 10,000 transitions. Exceeding any bound returns 413 TEAM_LIMIT, never partial totals. Activity feed uses limit 1–100 and encrypted continuation bound to actor, period, requester and current access. Follow sparse pages until nextCursor is null. These are current reads, not transactionally frozen historical snapshots.

## Verification and deployment

Run [team.test.js](../../functions/test/team.test.js), PAT denial, Team component interactions and actual Auth/Firestore integration in emulator.integration.js. Test imports/corrections, inactive members, deleted sources, reassignment, scope/revocation, empty/limited results and cross-member/period cursor reuse. No prose-only test proves aggregation or index behavior.

Deploy api plus Hosting through the normal checked PR/workflow. Required activity/transition indexes must be READY before cutover; real emulator does not enforce production indexes. Browser-check charts, long names, table-local scrolling, period/member changes, load-more state and lead links across phone/tablet/laptop/wide, themes, large text and short windows. Public captures remain synthetic.

Reads reuse allowlisted HTTP metrics, traces and logs with fixed route templates. No new committed business event is required because reporting does not mutate business state. Never attach names, notes, member IDs, counts by person or raw queries to telemetry.

Adjacent owners: [permissions](../salesdrone-people-permissions/SKILL.md), [leads](../salesdrone-leads/SKILL.md), [interface](../salesdrone-interface/SKILL.md), [dashboard](../salesdrone-dashboard/SKILL.md).

Read-only MCP integration uses explicit `team:read` and `people:read` PAT scopes for Admin owners. Existing tokens gain no new permissions. Team/directory reads recheck token validity and current access before publication; Google sessions still require members:write. PATs cannot read full membership/security records or mutate people. See [MCP adapter](../salesdrone-mcp/SKILL.md) and [integration contract](../../docs/MCP.md). Shared lead task reads accept tasks:read without exposing unrelated personal reminders.

The UI offers Last 24 hours, Last 7 days, Last 30 days and custom inclusive UTC dates. The explicit from/to API accepts UTC instants, at most 90 days apart. Activity cursors bind both fixed bounds and access. Workload remains current while recorded activity and completed totals use the selected period.

The Team activity period and custom dates use one control panel. Keep both native date inputs readable at mobile widths. Snapshot timestamps distinguish the selected activity window from current workload.
