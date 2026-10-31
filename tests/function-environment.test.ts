import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { functionEnvironment } from '../scripts/function-environment.mjs';
import { DEFAULT_GEMINI_MODEL } from '../functions/src/model-config.js';
const require = createRequire(import.meta.url);
const { resolveParams, ParamValue } = require('firebase-tools/lib/deploy/functions/params.js');
const { parseStrict } = require('firebase-tools/lib/functions/env.js');
const params = [{ name: 'GEMINI_MODEL', type: 'string', default: DEFAULT_GEMINI_MODEL }];
const options = {
  params, firebaseConfig: { projectId: 'demo-salesdrone' },
  codebase: 'salesdrone', nonInteractive: true, isEmulator: true,
};

test('Firebase non-interactive resolver needs explicit dotenv values even with SDK defaults', async () => {
  await assert.rejects(resolveParams({ ...options, userEnvs: {} }), /GEMINI_MODEL/);
  for (const override of [undefined, '', 'synthetic-model-override']) {
    const values = parseStrict(functionEnvironment({
      DYNATRACE_TENANT_URL: 'https://example.live.dynatrace.com',
      GEMINI_MODEL: override,
    }));
    const userEnvs = Object.fromEntries(Object.entries(values).map(([name, value]) =>
      [name, new ParamValue(value, false, { string: true })]));
    const result = await resolveParams({ ...options, userEnvs });
    assert.equal(result.paramValues.GEMINI_MODEL.asString(), override || DEFAULT_GEMINI_MODEL);
    assert.equal(values.APP_CHECK_MODE, 'enforce');
    assert.equal(values.SDR_REGION, 'asia-south1');
  }
});

test('deployment environment rejects missing tenant and dotenv line injection', () => {
  assert.throws(() => functionEnvironment({}), /DYNATRACE_TENANT_URL/);
  for (const value of ['bad\nAPP_CHECK_MODE=off', 'bad\rvalue', '   '])
    assert.throws(() => functionEnvironment({DYNATRACE_TENANT_URL:'https://example.live.dynatrace.com',GEMINI_MODEL:value}), /GEMINI_MODEL/);
});
