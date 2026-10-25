import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRumIdentity } from '../apps/web/src/lib/rum-identity.ts';
function fixture() {
  const tags: string[] = [],
    ended: string[] = [];
  let agent: any,
    listener: () => void = () => {},
    timers: (() => void)[] = [];
  const identify = createRumIdentity({
    agent: () => agent,
    anonymous: () => 'browser:synthetic',
    hash: async (uid) => 'user:hash-' + uid,
    onReady: () => {},
    listen: (fn) => {
      listener = fn;
      return () => {
        if (listener === fn) listener = () => {};
      };
    },
    schedule: (fn) => {
      timers.push(fn);
      return fn;
    },
    clear: (timer) => {
      timers = timers.filter((fn) => fn !== timer);
    },
  });
  return {
    identify,
    tags,
    ended,
    ready: () => {
      agent = {
        identifyUser: (v: string) => tags.push(v),
        endSession: () => ended.push('ended'),
      };
      listener();
    },
    tick: () => {
      const pending = timers;
      timers = [];
      pending.forEach((fn) => fn());
    },
  };
}
test('RUM tags approved member email, ends former sessions and restores anonymous identity on sign-out', async () => {
  const f = fixture();
  f.ready();
  let cancel = f.identify('one', 'One@Example.com');
  await Promise.resolve();
  assert.deepEqual(f.tags, ['one@example.com']);
  cancel();
  cancel = f.identify('two', 'two@example.com');
  await Promise.resolve();
  assert.deepEqual(f.ended, ['ended']);
  cancel();
  f.identify(null);
  await Promise.resolve();
  assert.equal(f.tags.at(-1), 'browser:synthetic');
  assert.equal(f.ended.length, 2);
});
test('a late RUM ready event identifies after bounded polling expires and cancelled login cannot overwrite sign-out', async () => {
  const f = fixture();
  const cancel = f.identify('one', 'one@example.com');
  await Promise.resolve();
  for (let i = 0; i < 20; i++) f.tick();
  assert.equal(f.tags.length, 0);
  f.ready();
  assert.deepEqual(f.tags, ['one@example.com']);
  cancel();
  const cancelLate = f.identify('stale');
  cancelLate();
  f.identify(null);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(f.tags.at(-1), 'browser:synthetic');
});
