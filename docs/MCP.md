# Read-only SalesDrone MCP integration

The public npm package `@theharithsa/salesdrone-mcp` runs locally over stdio and
adapts the existing `/api/v1` HTTP API. It does not connect to Firestore, hold cloud
credentials, serve remote HTTP, issue tokens or implement a second policy layer.
See [package setup, tool list and limits](../packages/mcp/README.md).

App 2.9.0 / contract 1.29.0 adds explicit opt-in `team:read` and `people:read` PAT
scopes. Both require an active Admin owner. Team rechecks token, current membership,
policy and owner role before publishing results. The minimal people directory
returns id/name/active only. Google sessions retain their existing members:write
requirement. Existing tokens gain no new scopes implicitly; PATs still cannot read
full membership records or administer people/security/tokens. Shared lead task reads
accept `tasks:read` under current lead scope; the default task list remains private
to the token owner and the all-accessible task view stays Google-only.

The npm package version starts at 1.0.0 independently of application/API versions.
Its 21 tools send GET only to a fixed allowlist. All schemas reject unknown keys,
IDs exclude path traversal, and list tools return one bounded page. Sparse pages
and opaque cursors retain server policy. The fixed environment-configured URL is
not model-controlled; HTTPS (except loopback development), no embedded credentials,
no redirects, a 15-second deadline and a 2 MiB response cap bound transport. Four
concurrent reads are allowed. Errors contain safe codes, never upstream bodies,
customer text, tokens or raw URLs. Credentials stay in process memory.

Names, notes, imported content and AI prose remain untrusted data. MCP clients must
not execute embedded instructions. The operator chooses which MCP host/model gets
authorized results and must apply that host's privacy policy. The package adds no
separate telemetry exporter; existing API RED metrics, traces and safe operational
logs apply. Business records are not mutated, so no new canonical business event is
invented. Auth counters, last-used metadata and access telemetry can change on reads.

Team describes recorded work and current scope, not online presence or an employee
score. Tasks attribute responsibility to the recipient. Reports are not frozen
historical snapshots; current stage distributions are not conversion histories.

## Verification and release

Run `npm run test:mcp`, targeted Team/PAT tests and actual Auth/Firestore emulator
integration before the adapter is published. MCP tests use real stdio protocol
initialize/list/call exchanges and the existing HTTP API with synthetic data; they
cover denial, revocation, privacy, sparse pages, bounded payloads, redirects and
missing credentials. Root test/CI discovery includes `tests/mcp.test.ts`, so existing
web-suite case receipts and safe CI reporting include actual MCP results.

Inspect `npm pack --dry-run -w packages/mcp` and the real packed tarball. Allowlisted
contents are LICENSE, README.md, package.json and the three runtime JS files. Test
an isolated installation and the packed CLI. No install scripts, credential files,
local reports, customer data or test fixtures belong in the archive.

Publication requires a checked PR merged into main and compatible API deployment
before npm publication. Use `npm publish -w packages/mcp --access public` from the
reviewed revision after npm login/2FA. npm identity/scope ownership is an external
gate. Trusted GitHub publishing can be configured by the npm owner using npm's
OIDC workflow; no registry key is committed. Never overwrite a published npm version.

After publication verify registry name/version/integrity and install/run the exact
published package. Test read-only live API denial and, with a newly scoped token,
Team/people reads without customer mutations. Record separately: local protocol
checks, emulator policy, merged revision, deployed app/API, npm publication and live
MCP reads. See [continuation](../skills/salesdrone-mcp/continuation.md).
