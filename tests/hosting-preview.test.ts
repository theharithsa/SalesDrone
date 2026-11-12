import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHostingPreview, verifyHostingPreview } from '../scripts/verify-hosting-preview.mjs';

const site = 'demo-salesdrone';
const entry = {
  site,
  url: 'https://demo-salesdrone--rc-7-1-abc123.web.app',
  version: '9b357ee031fa8caf',
};
const receipt = (candidate = entry) => ({ status: 'success', result: { [site]: candidate } });

test('staging uses the immutable version for the configured site and a valid Firebase preview origin', () => {
  assert.equal(parseHostingPreview(receipt(), site).version, entry.version);
  for (const candidate of [
    { ...entry, version: '' },
    { ...entry, version: 'staged\nversion=live' },
    { ...entry, site: 'other-site' },
    { ...entry, url: 'https://demo-salesdrone.web.app' },
    { ...entry, url: 'https://demo-salesdrone--rc-7-1.web.app.example.test' },
    { ...entry, url: 'https://demo-salesdrone--rc-7-1.web.app@other-site.web.app' },
  ]) {
    assert.throws(() => parseHostingPreview(receipt(candidate), site));
  }
  assert.throws(() => parseHostingPreview({ ...receipt(), status: 'error' }, site));
});

test('staging rejects a stale build, stale contract or failed preview request', async () => {
  const preview = parseHostingPreview(receipt(), site);
  const release = { version: '2.13.2', commit: 'candidate' };
  const contract = { openapi: '3.1.0', info: { version: '1.33.0' } };
  const serve = (version = release, api = contract, status = 200) => (
    async (url: URL, init: RequestInit) => {
      assert.equal(url.origin, entry.url);
      assert.equal(init.redirect, 'error');
      return Response.json(url.pathname === '/version.json' ? version : api, { status });
    }
  );
  await verifyHostingPreview(preview, release, contract, serve());
  await assert.rejects(verifyHostingPreview(preview, release, contract, serve({ ...release, commit: 'stale' })), /version\/commit mismatch/);
  await assert.rejects(verifyHostingPreview(preview, release, contract, serve(release, { ...contract, openapi: '3.0.0' })), /OpenAPI mismatch/);
  await assert.rejects(verifyHostingPreview(preview, release, contract, serve(release, contract, 404)), /metadata unavailable/);
});
