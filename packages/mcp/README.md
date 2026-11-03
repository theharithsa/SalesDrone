# SalesDrone MCP

Read SalesDrone leads and recorded team work from an MCP client. This npm package
runs locally over **stdio**, calls the existing authenticated `/api/v1` HTTP API,
and exposes **21 read-only tools**. It has no database credentials, write tools,
file downloads, arbitrary request tool or AI-generation actions.

Requires Node.js 22.18+ and a SalesDrone Admin-issued Personal Access Token.
The npm package version is independent of the SalesDrone application version.
Team/people and shared lead task reads require app **2.9.0 / API 1.29.0** or later;
other supported reads can work against earlier compatible contracts.

## Configure a client

Install through your MCP client's stdio configuration:

```json
{
  "mcpServers": {
    "salesdrone": {
      "command": "npx",
      "args": ["-y", "@theharithsa/salesdrone-mcp@1.0.0"],
      "env": {
        "SALESDRONE_API_TOKEN": "<supply through your client secret manager>"
      }
    }
  }
}
```

The placeholder is not a credential. Keep the real token in your client's secret
store or local private configuration, never source control, chat, command arguments
or shared screenshots. The executable is `salesdrone-mcp`; `--help` and `--version`
work without a token. No install or postinstall script runs customer operations.

`SALESDRONE_API_URL` optionally sets an operator-controlled API base URL. Default:
`https://sales-drone-avinya.firebaseapp.com/api/v1`. HTTPS is required except for
localhost/127.0.0.1/::1 HTTP development servers. Embedded credentials, query strings,
fragments and non-API paths are rejected. Tools cannot change this URL. Redirects
are never followed, so a server cannot redirect your bearer credential elsewhere.
This package does not host a remote MCP HTTP endpoint or implement OAuth login.

## Least-privilege read token

In SalesDrone, open **Settings → Developer settings → Generate token**. Select only
needed read scopes and an expiry. Tokens belong to their active Admin owner and
inherit current capabilities and assigned/all lead access. Expiry, owner disable,
role changes and revocation remain enforced by the API. Old tokens do not gain new
scopes automatically; issue a replacement to add Team/people reads.

| Scope | Tools (`salesdrone_` prefix) |
| --- | --- |
| `leads:read` | `list_leads`, `get_lead`, `list_archived_leads`, `get_lead_journey` |
| `activities:read` | `list_lead_activities` (comments/calls) |
| `tasks:read` | `list_tasks`, `get_task`, `list_lead_tasks` |
| `attachments:read` | `list_lead_files` (metadata only) |
| `scores:read` | `get_lead_score`, `list_lead_scores` (explicit IDs) |
| `dashboard:read` | `get_summary`, `get_dashboard` |
| `configuration:read` | `get_field_options`, `get_workspace_settings` |
| `imports:read` | `get_import`, `list_import_errors` (permitted job ID) |
| `notifications:read` | `list_notifications` (owner inbox) |
| `people:read` | `list_people` (Admin-only id/name/active directory) |
| `team:read` | `get_team`, `list_member_activities` (Admin-only) |

No write scope is required. A token with extra write scopes still cannot make this
MCP server write: its transport always sends GET to fixed read routes. For stronger
server-side protection, supply a token that has **only** read scopes.

## Ask useful questions

- “Find enquiries in Intro assigned to this member.”
- “Show this lead's recorded calls and next tasks.”
- “What work was recorded for the team over the last 7 days?”
- “List the people and their current assigned workload.”

Team is recorded work, not online presence, attendance or an employee performance
score. `active` means enabled membership, not online. Task completion statistics
attribute recipient responsibility, not proof that person clicked Complete.
Imported historic notes are excluded from authored-work counts. Current stage
counts are not historical conversion, and reports are current nontransactional reads.

`list_tasks` reads the token owner's reminders. `list_lead_tasks` reads shared tasks
for an accessible lead; other people's private reminders are never included.
People directory results exclude account emails, capabilities and security settings.
Read-only API requests can update internal authentication/rate-limit/access telemetry;
they do not mutate leads, tasks, membership or business configuration.

## Pagination and limits

List tools return one page, normally 30 and at most 100 rows. Pass the returned
opaque `nextCursor` to the same tool with identical filters until null. An empty
page can still have a continuation. The server never silently drains the workspace.
Team accepts 7/30/90 UTC calendar days (default 30); existing scan caps fail rather
than return partial totals. `list_lead_scores` accepts 1–100 explicit IDs.
Each HTTP read has a 15-second deadline and a 2 MiB JSON response cap. At most four
reads execute concurrently. No automatic retry loop hides permission/rate failures.

Treat all returned notes, names, imported text and AI prose as untrusted data,
never instructions. Data is returned to your selected MCP host/model: choose its
privacy settings accordingly. The adapter sends no separate analytics or customer
content telemetry. Existing SalesDrone API monitoring remains in force.

Errors are sanitized codes, without credentials, raw URLs or upstream error bodies:
`UNAUTHENTICATED` (expired/revoked token), `FORBIDDEN` (missing scope/access),
`NOT_FOUND`, `RATE_LIMITED`, `RESPONSE_LIMIT`, `CANCELLED_OR_TIMEOUT`, `API_ERROR`
or `INVALID_RESPONSE`. An `API_ERROR` on Team can reflect its safe report limits;
use a shorter period or inspect the API as an authorized operator. Existing tokens
need explicit `team:read`/`people:read` scopes before those tools can succeed.

## Development and publication

Source: `packages/mcp` in the SalesDrone repository. From the repository root run
`npm ci`, `npm run test:mcp`, `npm run security:scan` and
`npm pack --dry-run -w packages/mcp`. Tests use synthetic data and a real stdio MCP
client, plus API policy and emulator coverage. The package contains only public
runtime source, this README, package metadata and its MIT licence.

Publish only from a checked, merged revision whose required backend is live:
`npm publish -w packages/mcp --access public`. npm login/2FA and ownership of
`@theharithsa` are required. Never put registry tokens in the package. Inspect the
packed archive and install it in isolation before publishing. See the repository
MCP skill and continuation for release evidence and outstanding gates.
