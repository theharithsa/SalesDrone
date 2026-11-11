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
      /route\(\s*['"](get|post|put|patch|delete)['"]\s*,\s*['"]([^'"]+)['"]/g,
    ),
  ].map((m) => [m[1], m[2]]);
  endpoints.push(['get', '/me'], ['post', '/invitations/:id/accept']);
  assert.equal(endpoints.length, 97);
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
    new Set(['get', 'post', 'put', 'patch', 'delete']),
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

test('shared task routes publish the bounded Task page and strict versioned mutation schema',async()=>{
 const spec=JSON.parse(await read('docs/openapi.json'));
 const readOp=spec.paths['/api/v1/leads/{id}/tasks'].get;
 assert.ok(JSON.stringify(readOp.responses['200']).includes('Task'));
 assert.deepEqual(readOp.parameters.filter(p=>p.in==='query').map(p=>p.name).sort(),['cursor','limit','state']);
 assert.equal(readOp.parameters.find(p=>p.name==='limit').schema.maximum,100);
 const change=spec.paths['/api/v1/leads/{id}/tasks/{taskId}'].patch;
 assert.equal(change.requestBody.content['application/json'].schema.$ref,'#/components/schemas/SharedTaskPatch');
 const retry=change.parameters.find(p=>p.name==='Idempotency-Key');assert.equal(retry.in,'header');assert.equal(retry.required,true);assert.equal(retry.schema.format,'uuid');
});

test('main task contract documents opt-in accessible browsing and action flags without expanding PAT routes',async()=>{
 const spec=JSON.parse(await read('docs/openapi.json')),op=spec.paths['/api/v1/tasks'].get;
 assert.deepEqual(op.parameters.find(p=>p.name==='view').schema.enum,['accessible']);assert.equal(op['x-personal-access-token-scope'],'tasks:read');
 assert.ok(JSON.stringify(op.responses['200']).includes('Task'));assert.ok(spec.components.schemas.Task.properties.canEditOwn);assert.ok(spec.components.schemas.Task.properties.canManage);
});

test('Team contract exposes typed admin-only reporting and literal assignment export filtering',async()=>{const spec=JSON.parse(await read('docs/openapi.json'));assert.equal(spec.info.version,'1.33.0');for(const p of ['/team','/team/members/{uid}/activities','/lead-assignees'])assert.equal(spec.paths['/api/v1'+p].get['x-personal-access-token-scope'],p==='/lead-assignees'?'people:read':'team:read');assert.ok(spec.paths['/api/v1/team'].get.parameters.some(p=>p.name==='days'));assert.ok(spec.components.schemas.LeadExportInput.properties.assignedToUid);});
