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
  if (env.SDR_EMAIL_ENABLED === 'true') {
    const addresses = (env.SDR_EMAIL_PILOT_ALLOWLIST || '').split(',').map(value => value.trim());
    if (!addresses.length || addresses.length > 20 || addresses.some(value => !/^[^\s,<>@]+@[^\s,<>@]+\.[^\s,<>@]+$/.test(value)))
      throw Error('Set a valid email pilot allowlist with no more than twenty members.');
    values.SDR_EMAIL_ENABLED = 'true';
    values.SDR_EMAIL_PILOT_ALLOWLIST = addresses.join(',');
  }
  return Object.entries(values)
    .map(([name, value]) => name + '=' + JSON.stringify(value))
    .join('\n') + '\n';
}
