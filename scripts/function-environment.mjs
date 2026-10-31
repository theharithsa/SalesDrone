import { DEFAULT_GEMINI_MODEL } from '../functions/src/model-config.js';

/** Materialize defaults for Firebase CLI non-interactive parameter resolution. */
export function functionEnvironment(env) {
  const values = {
    SDR_REGION: 'asia-south1',
    APP_CHECK_MODE: 'enforce',
    DYNATRACE_TENANT_URL: env.DYNATRACE_TENANT_URL,
    GEMINI_MODEL: env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
  };
  for (const [name, value] of Object.entries(values))
    if (typeof value !== 'string' || !value.trim() || /[\r\n]/.test(value))
      throw Error('Missing or invalid deployment parameter: ' + name);
  return Object.entries(values)
    .map(([name, value]) => name + '=' + JSON.stringify(value))
    .join('\n') + '\n';
}
