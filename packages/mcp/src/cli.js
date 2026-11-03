#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.js';
if (process.argv.includes('--help')) {
  console.log('salesdrone-mcp: read-only stdio MCP server\nRequires SALESDRONE_API_TOKEN. Optional SALESDRONE_API_URL (HTTPS /api/v1 base).\nConfigure your MCP client to launch this executable; stdout is reserved for MCP messages.');
} else if (process.argv.includes('--version')) {
  console.log('1.0.0');
} else {
  try {
    const options = { token: process.env.SALESDRONE_API_TOKEN, apiUrl: process.env.SALESDRONE_API_URL };
    // Validate before opening stdio; errors never echo the credential or URL.
    createServer(options);
    const handle = serveStdio(() => createServer(options), { onerror: () => process.stderr.write('SalesDrone MCP protocol error.\n') });
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { handle.close().catch(() => {}).finally(() => { process.exitCode = 0; }); });
  } catch {
    process.stderr.write('SalesDrone MCP could not start. Supply a valid SALESDRONE_API_TOKEN and SALESDRONE_API_URL.\n');
    process.exitCode = 1;
  }
}
