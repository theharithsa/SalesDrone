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
