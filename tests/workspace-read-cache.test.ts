import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorkspaceReadCache } from '../apps/web/src/lib/workspace-read-cache.ts';

test('repeat page reads coalesce, expire, and do not share mutable values', async () => {
  const cache = new WorkspaceReadCache();
  let reads = 0;
  let time = 0;
  const load = async () => ({ items: [++reads] });
  const read = () => cache.read('workspace-a', '/leads?limit=30', load, () => time);
  const [first, joined] = await Promise.all([read(), read()]);
  first.items.push(99);
  assert.deepEqual(joined.items, [1]);
  assert.deepEqual((await read()).items, [1]);
  assert.equal(reads, 1);
  time = 15_000;
  assert.deepEqual((await read()).items, [2]);
});

test('workspace scope and invalidation discard cache entries including late results', async () => {
  const cache = new WorkspaceReadCache();
  let finish!: (value: number) => void;
  const old = cache.read('workspace-a', '/summary', () => new Promise((resolve) => { finish = resolve; }));
  cache.clear();
  assert.equal(await cache.read('workspace-a', '/summary', async () => 2), 2);
  finish(1);
  assert.equal(await old, 1);
  assert.equal(await cache.read('workspace-a', '/summary', async () => 3), 2);
  assert.equal(await cache.read('workspace-b', '/summary', async () => 4), 4);
  assert.equal(await cache.read('workspace-a', '/summary', async () => 5), 5);
});

test('details, search, pagination, auth and failed reads always reach the server', async () => {
  const cache = new WorkspaceReadCache();
  for (const path of ['/me', '/leads/a', '/leads?search=sample', '/leads?cursor=opaque', '/notifications', '/personal-access-tokens']) {
    assert.equal(await cache.read('scope', path, async () => 1), 1);
    assert.equal(await cache.read('scope', path, async () => 2), 2);
  }
  await assert.rejects(cache.read('scope', '/summary', async () => { throw Error('Denied'); }), /Denied/);
  assert.equal(await cache.read('scope', '/summary', async () => 42), 42);
});
