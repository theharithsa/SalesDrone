import { createRequire } from 'node:module';
import { mkdir, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
const require = createRequire(
  new URL('../apps/web/package.json', import.meta.url),
);
const source = dirname(require.resolve('swagger-ui-dist/package.json'));
const target = new URL('../apps/web/public/swagger/', import.meta.url);
await mkdir(target, { recursive: true });
for (const file of ['swagger-ui.css', 'swagger-ui-bundle.js', 'LICENSE'])
  await copyFile(join(source, file), new URL(file, target));
console.log('Built self-hosted Swagger UI assets.');
