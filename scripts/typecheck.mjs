import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// The TypeScript 6 API compatibility package also exports a transitive `tsc`.
// Select the native compiler explicitly instead of relying on npm bin link order.
const compiler = fileURLToPath(new URL('../node_modules/typescript-7/bin/tsc', import.meta.url));
const result = spawnSync(process.execPath, [compiler, ...process.argv.slice(2)], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
