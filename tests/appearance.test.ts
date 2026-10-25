import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveVisualPreferences } from '../apps/web/src/lib/appearance.ts';
test('live accounts never inherit guest book mode; unapproved/demo preferences remain local', () => {
  const guest = { appearance: 'dark', bookMode: true } as const;
  assert.deepEqual(
    resolveVisualPreferences({ appearance: 'light' }, false, guest),
    { appearance: 'light', bookMode: false },
  );
  assert.deepEqual(
    resolveVisualPreferences({ appearance: 'system', bookMode: true }, false, {
      appearance: 'light',
      bookMode: false,
    }),
    { appearance: 'system', bookMode: true },
  );
  assert.deepEqual(
    resolveVisualPreferences(
      { appearance: 'light', bookMode: false },
      true,
      guest,
    ),
    guest,
  );
  assert.deepEqual(resolveVisualPreferences(null, true, guest), guest);
  assert.deepEqual(resolveVisualPreferences(null, false, guest), guest);
});
