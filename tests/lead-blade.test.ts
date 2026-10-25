import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bladeBounds,
  clampBladeWidth,
  dragBladeWidth,
  keyboardBladeWidth,
  DEFAULT_BLADE_WIDTH,
} from '../apps/web/src/lib/lead-blade.ts';
test('blade sizes reserve usable lead-list space and remain bounded across desktop/embedded containers', () => {
  for (const width of [0, 300, 500, 720, 1056, 1600, 2600]) {
    const bounds = bladeBounds(width);
    assert.ok(bounds.min >= 0 && bounds.min <= bounds.max);
    assert.ok(bounds.max <= 1100 && bounds.max <= width);
    if (width >= 750) assert.ok(width - bounds.max >= 300);
    for (const requested of [-500, 0, 420, 900, 99999]) {
      const result = clampBladeWidth(requested, bounds);
      assert.ok(
        result >= Math.round(bounds.min) && result <= Math.round(bounds.max),
      );
    }
  }
});
test('dragging the left edge left expands, right contracts, and overshoot clamps rather than covering the list', () => {
  const bounds = bladeBounds(1500);
  assert.equal(dragBladeWidth(420, 1000, 800, bounds), 620);
  assert.equal(dragBladeWidth(620, 800, 1000, bounds), 420);
  assert.equal(dragBladeWidth(420, 1000, -9999, bounds), bounds.max);
  assert.equal(dragBladeWidth(420, 1000, 9999, bounds), bounds.min);
});
test('keyboard resizing follows the same direction and supports precision, minimum and maximum widths', () => {
  const bounds = bladeBounds(1500);
  assert.equal(keyboardBladeWidth('ArrowLeft', 420, bounds), 444);
  assert.equal(keyboardBladeWidth('ArrowRight', 420, bounds), 396);
  assert.equal(keyboardBladeWidth('ArrowLeft', 420, bounds, true), 468);
  assert.equal(keyboardBladeWidth('Home', 420, bounds), bounds.min);
  assert.equal(keyboardBladeWidth('End', 420, bounds), bounds.max);
  assert.equal(keyboardBladeWidth('Tab', 420, bounds), null);
});
test('malformed saved widths recover to a safe default', () => {
  const bounds = bladeBounds(1500);
  for (const input of [NaN, Infinity, -Infinity])
    assert.equal(clampBladeWidth(input, bounds), DEFAULT_BLADE_WIDTH);
  assert.deepEqual(bladeBounds(NaN), { min: 0, max: 0 });
});
