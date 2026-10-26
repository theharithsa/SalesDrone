import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDisplayScale,
  displayScales,
  scaleFromCSS,
  layoutPixels,
} from '../apps/web/src/lib/display-scale.ts';
import { resolveVisualPreferences } from '../apps/web/src/lib/appearance.ts';
import { scoreDisplay } from '../apps/web/src/lib/score-display.ts';
import { readFileSync } from 'node:fs';
test('display scale is allowlisted, defaults safely and stays personal', () => {
  for (const n of displayScales) assert.equal(normalizeDisplayScale(n), n);
  for (const n of [undefined, null, 0, 95, 200, '85', NaN])
    assert.equal(normalizeDisplayScale(n), 100);
  assert.equal(
    resolveVisualPreferences({ appearance: 'light' }, false, {
      appearance: 'dark',
      displayScale: 85,
    }).displayScale,
    100,
  );
  assert.equal(
    resolveVisualPreferences(
      { appearance: 'light', displayScale: 125 },
      false,
      { appearance: 'dark', displayScale: 85 },
    ).displayScale,
    125,
  );
  const spec = JSON.parse(
    readFileSync(new URL('../docs/openapi.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(
    spec.components.schemas.Preferences.properties.displayScale.anyOf.map(
      (x) => x.const,
    ),
    [...displayScales],
  );
});
test('blade pointer coordinates convert to layout pixels under explicit zoom', () => {
  assert.equal(scaleFromCSS('85%'), 0.85);
  assert.equal(scaleFromCSS('1.25'), 1.25);
  assert.equal(scaleFromCSS('normal'), 1);
  for (const scale of [0.85, 0.9, 1, 1.1, 1.25])
    assert.ok(Math.abs(layoutPixels(100 * scale, scale) - 100) < 0.00001);
  assert.equal(layoutPixels(100, 0), 100);
});
test('score display distinguishes unknown and real zero, bounds arcs and rejects non-numbers', () => {
  for (const v of [undefined, null, '0', NaN, Infinity])
    assert.deepEqual(scoreDisplay(v), {
      score: null,
      label: 'Unscored',
      progress: 0,
    });
  assert.deepEqual(scoreDisplay(0), {
    score: 0,
    label: '0 out of 100',
    progress: 0,
  });
  assert.equal(scoreDisplay(100).progress, 100);
  assert.equal(scoreDisplay(69.8).score, 70);
  assert.equal(scoreDisplay(-10).score, 0);
  assert.equal(scoreDisplay(101).score, 100);
});
