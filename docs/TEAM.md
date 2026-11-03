# Team reporting contract

Team is an Admin-only read surface. Google sign-in, App Check, active Admin membership and members:write are required. No PAT scope is added. Current lead scope still applies, and membership/policy is checked again before any report or activity page is returned.

GET `/api/v1/team?days=30` returns generatedAt, since, days, UTC timezone, bounded member rows, unassigned/unavailable-assignee counts, daily authored-comment/call trend and explicit scan limits. Days is 7, 30 or 90, default 30, covering UTC calendar days including today up to generatedAt. This local page choice is not a saved workspace setting. No historical backfill is performed.

| Figure | Meaning |
| --- | --- |
| Assigned / stage distribution | Current unarchived accessible leads assigned to the member |
| Comments / calls / connected | Authored activities by actor in period; imported workbook text and missing source leads excluded |
| Leads worked | Distinct leads with those notes/calls or a recorded stage change by actor; includes later reassignment |
| Stage changes | Actual transitions with a prior stage, excluding initial/import transitions; no inferred conversion |
| Pending / overdue | Nondeleted accessible lead tasks by responsible recipient; overdue uses the current timestamp |
| Completed tasks | Those assigned lead tasks completed in period, including closure by another editor |
| Last recorded work | Latest counted activity/transition within period; not last login |
| Active / inactive | Current workspace membership; not online presence |

Corrections retain original authorship and count once. Historical source text, private reminders, account credentials, private chats and online-presence signals are not inputs to published figures. No AI inference, employee rating or leaderboard is created.

GET `/api/v1/team/members/{uid}/activities?days=30&limit=20` returns notes/calls with literal latest corrected text (up to 4,000 characters), original timestamp, revision, outcome and current lead link. Limit is 1–100. Encrypted continuations bind the requester, current access, actor and UTC period. Sparse pages may continue; follow nextCursor until null. A UTC date rollover changes the window and requires restarting pagination. A missing member returns 404. Unknown query/window returns 400. Changed access rejects publication; downgrade/revocation returns 403 or TEAM_STALE 409. Reads use no-store and are current reads, not transactionally frozen snapshots.

Overview reads at most 200 members, 5,000 scoped leads, 10,000 in-period activities, 5,000 task records and 10,000 in-period transitions. Crossing any bound fails with 413 TEAM_LIMIT; incomplete totals are never returned as complete. Shortening the period can reduce activity/transition volume; larger directories/current collections need a later aggregate design. The UI refreshes on entry, period change or explicit Refresh, not a background poll.

GET `/api/v1/lead-assignees` is an Admin-only paginated id/name/active projection, with no account email/capabilities. The client follows pages to a 1,000-row directory bound and reports errors. GET `/leads` and POST `/leads/export` accept the existing Admin assignedToUid filter; reserved `__unassigned__` matches null assignment. It composes with all other criteria and binds continuation. Export uses literal UID matching, not normalized text Equals. Non-admin assignee-filter privileges remain unchanged.

The sidebar registry in WorkspaceNavigation feeds group menus, route discovery and quick navigation. Workspace/Insights/Manage groups retain capability gates. Desktop pointer rows are 36px with 18px icons and 8px selection shape; phone/coarse targets remain at least 48px. The product region scrolls independently from utilities/profile; short windows use a whole-drawer scrolling fallback so individual menu rows remain fully usable. Groups collapse in the drawer, expand on navigation to a contained destination, and keep all links visible in rail mode. Team reserves Overview and Member activity under one module rather than adding every subview to the sidebar.

Design references: [Google Cloud navigation and search](https://cloud.google.com/blog/products/management-tools/improved-google-cloud-console-search-experience) and [Material navigation accessibility](https://github.com/material-components/material-components-android/blob/master/docs/components/NavigationDrawer.md). This is a responsive web adaptation, not a native Material certification.

API deployment requires activity/transition createdAt/id and actorUid/createdAt/id indexes READY. Deny-all client rules are unchanged. Existing allowlisted route metrics/logs/traces cover reads; no new committed business event is warranted. Do not export names, comment text, task titles, raw queries, report contents or member dimensions to Dynatrace. Release/test/deployment events retain normal version/commit/run binding.
