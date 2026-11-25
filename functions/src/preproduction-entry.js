import { createRuntime } from './runtime.js';

export const { api: preprodApi, emailWorker: preprodEmail } = createRuntime('pre-production');
