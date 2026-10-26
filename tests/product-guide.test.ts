import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderProductGuide } from '../scripts/product-guide.mjs';
const module = {
  id: 'start',
  title: 'Title <script>',
  audience: 'Anyone',
  steps: ['Open & save'],
  details: ['<img src=x>'],
  faq: [['Why?', '<script>bad</script>']],
};
test('handbook escapes content and creates matching navigation and section ids', () => {
  const { html, markdown } = renderProductGuide(
    { title: 'Guide', modules: [module] },
    '1.6.0',
  );
  assert.ok(html.includes('href="#start"'));
  assert.ok(html.includes('id="start"'));
  assert.ok(html.includes('&lt;img src=x&gt;'));
  assert.ok(!html.includes('<script>bad'));
  assert.ok(markdown.includes('Open & save'));
});
test('handbook rejects duplicate anchors and incomplete modules', () => {
  assert.throws(() => renderProductGuide({ modules: [module, module] }, '1'));
  assert.throws(() =>
    renderProductGuide({ modules: [{ ...module, steps: [] }] }, '1'),
  );
});

test('published product handbook must match release metadata and required workflows', async () => {
  const { checkProductPage } = await import(
    '../scripts/post-deploy-checks.mjs'
  );
  const { html } = renderProductGuide(
    {
      modules: [
        { ...module, id: 'lead-workspace' },
        { ...module, id: 'api' },
      ],
    },
    '1.6.0',
  );
  assert.doesNotThrow(() => checkProductPage(html, '1.6.0'));
  assert.throws(() => checkProductPage(html, '1.5.1'));
  assert.throws(() => checkProductPage('<html/>', '1.6.0'));
});

test('same-version documentation still has to match the deployed source commit', async () => {
  const { checkProductPage, checkSettingsPage } = await import(
    '../scripts/post-deploy-checks.mjs'
  );
  const stamp =
    '<meta name="salesdrone-version" content="1.6.1"><meta name="salesdrone-commit" content="new-sha">';
  const product = stamp + 'Handbook modules id="lead-workspace" id="api"';
  const settings = stamp + 'Manage fields id="fields" id="choices"';
  assert.doesNotThrow(() => checkProductPage(product, '1.6.1', 'new-sha'));
  assert.throws(() => checkProductPage(product, '1.6.1', 'old-sha'));
  assert.doesNotThrow(() => checkSettingsPage(settings, '1.6.1', 'new-sha'));
  assert.throws(() => checkSettingsPage(settings, '1.6.1', 'old-sha'));
});

test('handbook screenshots accept curated names and reject path or script injection', () => {
  const { html, markdown } = renderProductGuide(
    {
      title: 'Guide',
      modules: [{ ...module, screenshot: 'lead-files-demo.jpg' }],
    },
    '1.9.0',
  );
  assert.ok(html.includes('assets/screenshots/lead-files-demo.jpg'));
  assert.ok(markdown.includes('site/assets/screenshots/lead-files-demo.jpg'));
  for (const screenshot of [
    '../../private.jpg',
    'https://example.invalid/file.jpg',
    'x.jpg" onerror="alert(1)',
    42,
  ])
    assert.throws(() =>
      renderProductGuide(
        { title: 'Guide', modules: [{ ...module, screenshot }] },
        '1.9.0',
      ),
    );
});
