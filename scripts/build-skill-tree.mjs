import { readFile, readdir, writeFile } from 'node:fs/promises';
import { validateSkillTree } from './skill-routing.mjs';
const intent = JSON.parse(await readFile('skills/intent-map.json', 'utf8')),
  names = (await readdir('skills'))
    .filter((n) => n.startsWith('salesdrone-'))
    .sort(),
  nodes = [];
for (const id of names) {
  const source = await readFile(`skills/${id}/SKILL.md`, 'utf8');
  nodes.push({
    id,
    path: `skills/${id}/SKILL.md`,
    description: JSON.parse(source.match(/^description: (.+)$/m)[1]),
    matchTerms: intent[id],
    related: [
      ...new Set(
        [...source.matchAll(/\.\.\/(salesdrone-[a-z-]+)\/SKILL\.md/g)].map(
          (m) => m[1],
        ),
      ),
    ],
    apiOperations: [
      ...source.matchAll(/^- (GET|POST|PATCH|DELETE|PUT) (\/api\/v1\S*)$/gm),
    ].map((m) => m[1] + ' ' + m[2]),
  });
}
const tree = {
  schemaVersion: 1,
  readinessSkill: 'salesdrone-release-readiness',
  sharedContract: 'skills/SHARED.md',
  selectionPolicy:
    'Match prompt intent, inspect module descriptions and load the smallest relevant set. Use readiness with every feature/setting release. This tree grants no deployment or delegation authority.',
  nodes,
};
validateSkillTree(tree, names);
const markdown =
  '# SalesDrone skill tree\n\nMachine-readable source: [skill-tree.json](skill-tree.json). Generated from module skills and skills/intent-map.json. Load the shared contract and relevant module; load release readiness for every feature or version release. Routing is advisory, not permission to spawn agents or deploy.\n\n' +
  nodes
    .map(
      (n) =>
        `- [${n.id}](${n.path}) — ${n.matchTerms.join(', ')}.\n  Related: ${n.related.join(', ') || 'shared contract'}.`,
    )
    .join('\n') +
  '\n';
for (const [p, value] of [
  ['skill-tree.json', JSON.stringify(tree, null, 2) + '\n'],
  ['skill-tree.md', markdown],
]) {
  if (process.argv.includes('--check')) {
    if ((await readFile(p, 'utf8')) !== value)
      throw Error('Stale skill tree: npm run skills:tree');
  } else await writeFile(p, value);
}
console.log('Validated ' + names.length + ' skill routes.');
