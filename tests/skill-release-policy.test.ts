import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertSkillUpdate } from '../scripts/skill-release-policy.mjs';
test('published application, documentation and deletion changes require a module skill update', () => {
  for (const paths of [
    ['apps/web/src/App.tsx'],
    ['README.md'],
    ['functions/src/removed.js'],
    ['skills/README.md'],
    ['skills/salesdrone-dashboard/agents/openai.yaml'],
  ])
    assert.throws(() => assertSkillUpdate(paths), /SKILL.md/);
  assert.throws(
    () => assertSkillUpdate(['skills/salesdrone-dashboard/SKILL.md'], []),
    /SKILL.md/,
  );
});
test('an affected module playbook update admits an integrated change or skill-only maintenance', () => {
  assert.doesNotThrow(() =>
    assertSkillUpdate([
      'apps/web/src/features/DashboardPage.tsx',
      'skills/salesdrone-dashboard/SKILL.md',
    ]),
  );
  assert.doesNotThrow(() =>
    assertSkillUpdate(['skills/salesdrone-release/SKILL.md']),
  );
  assert.doesNotThrow(() => assertSkillUpdate([]));
});
