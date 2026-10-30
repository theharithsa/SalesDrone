import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  validateSettingsReference,
  renderSettings,
} from '../scripts/settings-reference.mjs';
import { routeSkills, validateSkillTree } from '../scripts/skill-routing.mjs';
const read = async (p) =>
  JSON.parse(await readFile(new URL('../' + p, import.meta.url), 'utf8'));
test('shared navigation groups fields and choices and every visible settings section has a scoped, actionable guide', async () => {
  const sections = await read('apps/web/src/lib/settings-sections.json'),
    catalog = await read('docs/settings-reference.json');
  assert.deepEqual(
    sections.filter((s) => s.group === 'manageFields').map((s) => s.id),
    ['fields', 'choices'],
  );
  assert.ok(
    sections.filter((s) => s.group === 'manageFields').every((s) => s.admin),
  );
  validateSettingsReference(catalog, sections);
  const missing = structuredClone(catalog);
  missing.sections.pop();
  assert.throws(() => validateSettingsReference(missing, sections));
  const incomplete = structuredClone(catalog);
  incomplete.sections[0].controls[0].effect = '';
  assert.throws(() => validateSettingsReference(incomplete, sections));
});
test('settings documentation escapes markup and includes defaults, permission boundaries and environment guidance', async () => {
  const sections = await read('apps/web/src/lib/settings-sections.json'),
    catalog = await read('docs/settings-reference.json');
  catalog.sections[0].controls[0].description = '<script>unsafe</script>';
  const output = renderSettings(
    catalog,
    sections,
    [{ id: 'example:read', description: 'Synthetic scope' }],
    '9.8.7',
  );
  assert.ok(output.html.includes('&lt;script&gt;'));
  assert.ok(!output.html.includes('<script>unsafe'));
  assert.ok(output.html.includes('name="salesdrone-version" content="9.8.7"'));
  assert.ok(output.markdown.includes('Manage fields → Lead fields'));
  assert.ok(output.markdown.includes('example:read'));
  assert.ok(output.markdown.includes('Operator environment configuration'));
});
test('skill tree routes prompts to current modules and rejects orphan routing references', async () => {
  const tree = await read('skill-tree.json');
  validateSkillTree(
    tree,
    tree.nodes.map((n) => n.id),
  );
  assert.equal(
    routeSkills(
      'Manage fields: rename lead fields and dropdown choices',
      tree,
    )[0].id,
    'salesdrone-workspace-settings',
  );
  assert.equal(
    routeSkills('Export a filtered report to Excel', tree)[0].id,
    'salesdrone-leads',
  );
  assert.equal(
    routeSkills('Dynatrace telemetry metrics and logs', tree)[0].id,
    'salesdrone-observability',
  );
  const invalid = structuredClone(tree);
  invalid.nodes[0].related.push('not-a-module');
  assert.throws(() =>
    validateSkillTree(
      invalid,
      tree.nodes.map((n) => n.id),
    ),
  );
});

test('generic SalesDrone design prompts prioritize the Material interface owner', async()=>{
 const tree=await read('skill-tree.json');
 for(const prompt of ['SalesDrone design review','make my site stunning with responsive UI','Tailwind styling for the Material 3 page'])assert.equal(routeSkills(prompt,tree)[0].id,'salesdrone-interface');
 const readme=await readFile(new URL('../skills/README.md',import.meta.url),'utf8');
 const catalog=readme.split('<!-- module-catalog:start -->')[1].split('<!-- module-catalog:end -->')[0];
 assert.equal((catalog.match(/\| \[salesdrone-/g)||[]).length,tree.nodes.length);
 for(const node of tree.nodes)assert.ok(catalog.includes(`](${node.id}/SKILL.md)`));
});
