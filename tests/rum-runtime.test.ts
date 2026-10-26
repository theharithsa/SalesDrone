import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAnonymousId,
  finishAction,
} from '../apps/web/src/lib/rum-runtime.ts';
test('blocked storage preserves one page identity without collapsing different visitors', () => {
  const deps = {
    read: () => {
      throw Error('blocked');
    },
    write: () => {},
    random: () => crypto.randomUUID(),
  };
  const page = createAnonymousId(deps),
    other = createAnonymousId(deps);
  assert.equal(page(), page());
  assert.notEqual(page(), other());
  assert.match(page(), /^browser:[a-f0-9-]{36}$/);
});
test('invalid stored identity is replaced and valid origin-local IDs survive reloads', () => {
  let value = 'PRIVATE invalid identifier';
  const deps = {
    read: () => value,
    write: (id: string) => {
      value = id;
    },
    random: () => crypto.randomUUID(),
  };
  const page = createAnonymousId(deps);
  const id = page();
  assert.ok(!id.includes('PRIVATE'));
  assert.equal(createAnonymousId(deps)(), id);
});
test('action closes once on property failure, missing agent or repeated completion', () => {
  let closed = 0;
  const finish = finishAction(
    {
      addActionProperties: () => {
        throw Error('offline');
      },
      leaveAction: () => closed++,
    },
    1,
  );
  finish({ outcome: 'failure' });
  finish({ outcome: 'success' });
  assert.equal(closed, 1);
  assert.doesNotThrow(() => finishAction(undefined, undefined)({}));
});
