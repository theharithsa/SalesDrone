import { writeFile } from 'node:fs/promises';
import { functionEnvironment } from './function-environment.mjs';
const project = process.env.GCP_PROJECT_ID;
if (!/^[a-z][a-z0-9-]{4,62}$/.test(project || ''))
  throw Error('Invalid deployment project');
await writeFile('functions/.env.' + project, functionEnvironment(process.env));
console.log('Prepared non-interactive function parameters from shared defaults.');
