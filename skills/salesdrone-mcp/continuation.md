# Standalone MCP integration continuation

Adapter owner: https://github.com/theharithsa/salesdrone-mcp
Website extraction issue: https://github.com/theharithsa/SalesDrone/issues/134
Adapter implementation issue: https://github.com/theharithsa/salesdrone-mcp/issues/1

The human requested independent MCP ownership after initial npm 1.0.0 publication
from SalesDrone commit 6289b1522b25aa8da0c95d15bc2e77d9725f295e. That immutable
package remains available; subsequent releases come from the standalone repository.
SalesDrone retains API 1.29.0 and policy/emulator coverage; no API behavior or
customer data changes accompany removal of the package workspace. Protocol tests,
OTel, screenshots and npm CI are now standalone concerns.

App patch candidate 2.9.1 uses milestone 25 and issue 134. Check its PR/run for
current merge/deployment evidence; this source document is not a release certificate.
Original /Volumes/SUPERMAN/Machy Contents/GitHub/SalesDrone has unrelated dirty
.agents/skills work, which must remain untouched. The fast checkout is
/Users/theharithsa/.codex/workspaces/salesdrone-field-labels-20261031.
