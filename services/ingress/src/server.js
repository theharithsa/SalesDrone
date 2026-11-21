import { createGateway } from './gateway.js';
import { createTelemetry } from '../../../functions/src/telemetry.js';
import { APP_VERSION, BUILD_COMMIT } from '../../../functions/src/version.js';
const preprod = process.env.SALESDRONE_ENVIRONMENT === 'pre-production';
if (preprod && !/^https:\/\/preprodapi-[a-z0-9-]+\.a\.run\.app$/.test(process.env.API_UPSTREAM || ''))
  throw Error('Pre-production ingress requires the dedicated API upstream');
const telemetry = createTelemetry({ tenant: process.env.DYNATRACE_TENANT_URL, key: process.env.DYNATRACE_API_TOKEN, service: preprod ? 'salesdrone-preprod-ingress' : 'salesdrone-ingress', environment: preprod ? 'pre-production' : 'production' });
const server = createGateway({ upstream: process.env.API_UPSTREAM, version: APP_VERSION, commit: BUILD_COMMIT, telemetry });
server.listen(Number(process.env.PORT || 8080), '0.0.0.0');
process.on('SIGTERM', () => { server.close(async () => { await telemetry.flush(); await telemetry.shutdown(); process.exit(0); }); setTimeout(() => process.exit(1), 10000).unref(); });
