import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readStored,
  writeStored,
  removeStored,
} from '../apps/web/src/lib/browser-storage.ts';
test('browser storage failures do not block sign-in cleanup or presentation preferences', () => {
  const denied = () => {
    throw Error('Storage denied');
  };
  assert.equal(readStored('localStorage', 'sidebar', denied), null);
  assert.equal(writeStored('localStorage', 'sidebar', 'true', denied), false);
  assert.equal(removeStored('sessionStorage', 'import', denied), false);
});
test('storage helpers preserve normal values and surface quota failure', () => {
  const data = new Map<string, string>();
  const store = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
  assert.ok(writeStored('sessionStorage', 'import', 'id', () => store));
  assert.equal(
    readStored('sessionStorage', 'import', () => store),
    'id',
  );
  assert.ok(removeStored('sessionStorage', 'import', () => store));
  assert.equal(
    readStored('sessionStorage', 'import', () => store),
    null,
  );
  assert.equal(
    writeStored('localStorage', 'x', 'y', () => ({
      ...store,
      setItem: () => {
        throw Error('Quota');
      },
    })),
    false,
  );
});
