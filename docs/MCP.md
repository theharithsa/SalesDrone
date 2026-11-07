# Standalone SalesDrone MCP integration

The MCP server is maintained in **[theharithsa/salesdrone-mcp](https://github.com/theharithsa/salesdrone-mcp)** and published as [@theharithsa/salesdrone-mcp](https://www.npmjs.com/package/@theharithsa/salesdrone-mcp).
Its source, protocol/package tests, screenshots, OpenTelemetry runtime, GitHub
lifecycle observer and npm publishing workflow live in that independent repository.
This SalesDrone repository contains no MCP runtime/package workspace or npm publisher.

## HTTP contract owned here

The adapter calls `/api/v1`, never Firestore. Contract 1.29.0 provides explicit
Admin-owned team:read and people:read PAT scopes. Current membership, token expiry,
revocation and assigned/all lead scope remain authoritative. Google sessions retain
members:write for Team/people. The minimal directory exposes id/name/active, never
account emails or capabilities. No PAT can administer people/security/tokens.
Shared lead task reads require tasks:read; unrelated personal reminders stay private.

Existing tokens gain no new scope automatically. API/policy tests remain in
functions/test/team.test.js, personal-access-tokens.test.js and the real
Auth/Firestore emulator integration. Adapter verification belongs to the standalone
repository's checked CI and npm release evidence.

Team shows recorded work, not online presence or an employee rating. Task counts
attribute recipient responsibility. Reports are current reads, not transactional
historical snapshots. Current stage counts are not historical conversion.

## Version and migration boundary

The HTTP API/app and MCP npm versions are independent. npm 1.0.0 was initially
published from SalesDrone commit 6289b1522b25aa8da0c95d15bc2e77d9725f295e; its
immutable archive is retained. Standalone compatible releases use the new repo.
Existing `npx @theharithsa/salesdrone-mcp` clients keep the same package name.
Only the MCP repo publishes it. See its README for client/OTLP configuration,
privacy defaults, protocol screenshots and telemetry/publication verification.

## Designing cost-effective tools

Prefer a tool for one intent, using the server's scoped aggregate for counts and the narrowest list/search endpoint for records. A stage distribution describes current state; a conversion metric requires recorded transitions and a date window. Return the source, effective time window, partial coverage and cursor where relevant. Never infer a total from one page or a limited scan.

Preserve the versioned OpenAPI contract and each operation's actual scope. Validate allowlisted filters and dates, use stable ordering and opaque cursors, and continue through sparse pages only to an explicit page/record/deadline budget. Return the cursor to the caller when the budget is reached. Treat 401/403 as terminal and honor Retry-After for 429; bound transient retries, and classify a non-JSON upstream error without forwarding its body. Prefer typed tool inputs and outputSchema/structuredContent with compact, backward-compatible text. Reuse the app's policy and projections rather than exposing Firestore or raw URLs to the adapter.

Review operation counts before adding fan-out or automatic pagination, including the two durable PAT counter writes per accepted API call. Cover assigned scope, revoked tokens, empty pages with a cursor, partial limits, malformed upstream responses and model-readable errors in the adapter's contract tests. [MCP tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) · [Pagination guidance](https://google.aip.dev/158) · [Filtering guidance](https://google.aip.dev/160) · [SalesDrone FinOps](FINOPS.md)
