import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PAT_ROUTES } from '../src/api-scopes.js';
const root = new URL('../../', import.meta.url),
  read = (p) => readFile(new URL(p, root), 'utf8');
test('published contract covers every route with explicit PAT or Google/App Check authentication', async () => {
  const spec = JSON.parse(await read('docs/openapi.json')),
    source = await read('functions/src/app.js');
  const endpoints = [
    ...source.matchAll(
      /route\(\s*['"](get|post|patch|delete)['"]\s*,\s*['"]([^'"]+)['"]/g,
    ),
  ].map((m) => [m[1], m[2]]);
  endpoints.push(['get', '/me'], ['post', '/invitations/:id/accept']);
  assert.equal(endpoints.length, 47);
  for (const [method, url] of endpoints) {
    const op =
      spec.paths['/api/v1' + url.replace(/:([a-zA-Z]+)/g, '{$1}')][method];
    assert.ok(op, url);
    const scope = PAT_ROUTES[method + ' ' + url];
    assert.equal(op['x-personal-access-token-scope'], scope || null);
    assert.deepEqual(
      op.security,
      scope
        ? [{ personalAccessToken: [] }, { firebaseIdToken: [], appCheck: [] }]
        : [{ firebaseIdToken: [], appCheck: [] }],
    );
    assert.ok(op.responses['401']);
    assert.ok(op.responses['403']);
    assert.ok(op.responses['429']);
  }
  const create = spec.paths['/api/v1/personal-access-tokens'].post;
  assert.ok(!create.parameters.some((p) => p.name === 'Idempotency-Key'));
  assert.equal(
    create.requestBody.content['application/json'].schema.$ref,
    '#/components/schemas/TokenInput',
  );
  assert.ok(
    !JSON.stringify(spec.components.schemas.PersonalAccessToken).includes(
      'tokenHash',
    ),
  );
  assert.equal(
    spec.components.securitySchemes.personalAccessToken.scheme,
    'bearer',
  );
  assert.deepEqual(
    new Set(Object.values(spec.paths).flatMap((p) => Object.keys(p))),
    new Set(['get', 'post', 'patch', 'delete']),
  );
});
test('credential portal is self-hosted, nonpersistent and restricted to its own origin', async () => {
  const html = await read('apps/web/public/api-docs.html'),
    script = await read('apps/web/public/api-portal.js'),
    config = JSON.parse(await read('firebase.json'));
  const sources = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(
    (m) => m[1],
  );
  assert.equal(sources.length, 2);
  assert.ok(
    sources.every((src) => src.startsWith('/') && !src.startsWith('//')),
  );
  assert.ok(!html.includes('rum-bootstrap'));
  assert.match(script, /persistAuthorization:\s*false/);
  assert.match(script, /validatorUrl:\s*null/);
  assert.match(script, /u.origin !== location.origin/);
  assert.match(script, /pagehide/);
  for (const source of ['/api/docs', '/api-docs.html']) {
    const headers = config.hosting.headers.find(
      (h) => h.source === source,
    ).headers;
    assert.ok(
      headers.some((h) => h.key === 'Cache-Control' && h.value === 'no-store'),
    );
    assert.ok(
      headers.some(
        (h) =>
          h.key === 'Content-Security-Policy' &&
          h.value.includes("connect-src 'self'") &&
          h.value.includes("script-src 'self'"),
      ),
    );
  }
});
