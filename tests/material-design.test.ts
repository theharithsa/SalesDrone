import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leadTableColumns } from '../apps/web/src/lib/lead-table.ts';
import { defaultFieldOptions } from '../apps/web/src/lib/field-options.ts';
const css = readFileSync(
  new URL('../apps/web/src/material/tokens.css', import.meta.url),
  'utf8',
);
const luminance = (hex: string) => {
  const rgb = hex
    .slice(1)
    .match(/../g)!
    .map((s) => parseInt(s, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
};
const contrast = (a: string, b: string) => {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
test('day, night and Book palettes keep body, supporting and primary text at AA contrast', () => {
  const themes = [...css.matchAll(/:root(?:\[[^\]]+\])*\s*\{([^}]+)\}/g)]
    .map((m) =>
      Object.fromEntries(
        [
          ...m[1].matchAll(/--md-sys-color-([\w-]+):\s*(#[a-f0-9]{3,6})\s*;/gi),
        ].map((v) => [
          v[1],
          v[2].length === 4
            ? '#' +
              v[2]
                .slice(1)
                .split('')
                .map((x) => x + x)
                .join('')
            : v[2],
        ]),
      ),
    )
    .filter((t) => t.surface);
  assert.equal(themes.length, 4);
  for (const theme of themes)
    for (const [fg, bg] of [
      ['on-surface', 'surface'],
      ['on-surface', 'surface-container-lowest'],
      ['on-surface-variant', 'surface'],
      ['primary', 'surface'],
      ['on-primary', 'primary'],
      ['on-primary-container', 'primary-container'],
      ['on-secondary-container', 'secondary-container'],
    ])
      assert.ok(
        contrast(theme[fg], theme[bg]) >= 4.5,
        `${fg}/${bg} must remain legible`,
      );
});
test('lead table anchors identity first, shows stage, and preserves configured names, hidden and custom fields', () => {
  const fields = leadTableColumns(defaultFieldOptions).map((c) => c[0]);
  assert.equal(fields[0], 'name');
  assert.ok(fields.includes('stage'));
  assert.ok(fields.includes('leadScore'));
  assert.ok(!fields.includes('company'));
  const custom = {
    ...defaultFieldOptions,
    hiddenFields: ['name', 'stage'],
    labels: { ...defaultFieldOptions.labels, company: 'Organisation' },
    customFields: [
      {
        id: 'cf_project',
        label: 'Project',
        type: 'text' as const,
        options: [],
        required: false,
        deleted: false,
      },
      {
        id: 'cf_old',
        label: 'Retired',
        type: 'text' as const,
        options: [],
        required: false,
        deleted: true,
      },
    ],
  };
  const cols = leadTableColumns(custom);
  assert.deepEqual(cols[0], ['company', 'Organisation']);
  assert.ok(!cols.some((c) => ['name', 'stage', 'cf_old'].includes(c[0])));
  assert.ok(cols.some((c) => c[0] === 'cf_project'));
});
test('production application has a single Material styling entry and does not import review fixtures', () => {
  const main = readFileSync(
    new URL('../apps/web/src/main.tsx', import.meta.url),
    'utf8',
  );
  assert.ok(main.includes('./material/tokens.css'));
  for (const old of [
    'ui-refresh.css',
    'settings-refresh.css',
    'lead-overview.css',
    'design-system.css',
    'book-mode.css',
  ])
    assert.ok(!main.includes("'./" + old + "'"));
  assert.ok(!main.includes('AdminReview'));
});
