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
