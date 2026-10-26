import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { resolveVisualPreferences } from '../apps/web/src/lib/appearance.ts';
test('live accounts never inherit guest book mode; unapproved/demo preferences remain local', () => {
  const guest = {
    appearance: 'dark',
    bookMode: true,
    fontStyle: 'lora',
    displayScale: 90,
  } as const;
  assert.deepEqual(
    resolveVisualPreferences({ appearance: 'light' }, false, guest),
    {
      appearance: 'light',
      bookMode: false,
      fontStyle: 'standard',
      displayScale: 100,
    },
  );
  assert.deepEqual(
    resolveVisualPreferences({ appearance: 'system', bookMode: true }, false, {
      appearance: 'light',
      bookMode: false,
    }),
    {
      appearance: 'system',
      bookMode: true,
      fontStyle: 'standard',
      displayScale: 100,
    },
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

import {
  normalizeFontStyle,
  interfaceFonts,
} from '../apps/web/src/lib/fonts.ts';
test('font choices are allowlisted and live accounts do not inherit guest styles', () => {
  const spec = JSON.parse(
    readFileSync(new URL('../docs/openapi.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(
    interfaceFonts.map((f) => f.id),
    spec.components.schemas.Preferences.properties.fontStyle.enum,
  );
  for (const font of interfaceFonts)
    assert.equal(normalizeFontStyle(font.id), font.id);
  for (const value of [
    undefined,
    null,
    '',
    'url(https://example.invalid)',
    'comic-sans',
    42,
  ])
    assert.equal(normalizeFontStyle(value), 'standard');
  assert.equal(
    resolveVisualPreferences({ appearance: 'light' }, false, {
      appearance: 'dark',
      fontStyle: 'lora',
    }).fontStyle,
    'standard',
  );
  assert.equal(
    resolveVisualPreferences(
      { appearance: 'light', fontStyle: 'inter' },
      false,
      { appearance: 'dark', fontStyle: 'lora' },
    ).fontStyle,
    'inter',
  );
});
