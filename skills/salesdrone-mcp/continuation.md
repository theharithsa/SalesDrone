# MCP implementation continuation

Owner issue: https://github.com/theharithsa/SalesDrone/issues/132
Branch: codex/read-only-mcp
Working checkout: /Users/theharithsa/.codex/workspaces/salesdrone-field-labels-20261031
Original checkout: /Volumes/SUPERMAN/Machy Contents/GitHub/SalesDrone

The original .agents/skills dirty entry is unrelated and must remain untouched.
Implementation starts from published app 2.8.2 / bef29c740586fadaa9ca4e7f361cc2c1f5838209.
App candidate 2.9.0, API contract 1.29.0, milestone 24, issue 132. The independently
versioned npm package is @theharithsa/salesdrone-mcp 1.0.0 (name approved in chat).

The source implements 21 GET-only stdio tools with the official MCP server SDK.
New team:read and people:read PAT scopes remain Admin-only and opt-in; shared lead
tasks use tasks:read. No member administration, presence claims or business writes.

Local verification passed under Node 22: 230 function cases, 12 ingress cases,
102 root cases (including seven real MCP protocol/package cases), 34 component
cases and 13 actual Auth/Firestore/Storage emulator cases. Types, build, contracts,
docs, skills, release/readiness, lint (no new warnings) and secret scan passed.
The real six-file npm tarball installed in isolation and passed all seven MCP cases.
Archive SHA-1: ea357ee5041e8a703f9be1b317b703bb2f2908d3.
PR current-head CI, merge/deployment, npm publication and live package verification
remain pending until recorded below.
No npm publication or backend deployment is implied by this document.

npm login is now verified as theharithsa. Use the existing CLI session; do not print, request or persist registry secrets.
Publication is authorized by the task, subject to checked PR/API deployment and
registry access. No raw PAT or customer PDF/report belongs in source or npm archives.

Next: finish documentation/QA/contract checks; run all required verification and real
Auth/Firestore integration; inspect/execute packed package in isolation; create a
linked PR and wait for current-head checks; merge normally; verify deployed contract;
then npm publish and verify registry/install behavior when npm login is available.
