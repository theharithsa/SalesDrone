import { spawnSync } from 'node:child_process';
import { assertSkillUpdate } from './skill-release-policy.mjs';
// Repository skill integrity and complete primary API ownership; no dependencies.
import { readFile, readdir, stat, realpath } from 'node:fs/promises';
import { dirname, resolve, basename, relative } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const skillRoot = resolve(root, 'skills');
const fail = (message) => {
  throw new Error(message);
};
const contract = JSON.parse(
  await readFile(resolve(root, 'docs/openapi.json'), 'utf8'),
);
const methods = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
]);
const expected = new Set(
  Object.entries(contract.paths).flatMap(([path, operations]) =>
    Object.keys(operations)
      .filter((method) => methods.has(method))
      .map((method) => method.toUpperCase() + ' ' + path),
  ),
);
const owners = new Map();
const folders = (await readdir(skillRoot, { withFileTypes: true })).filter(
  (d) => d.isDirectory() && d.name.startsWith('salesdrone-'),
);
if (!folders.length) fail('No SalesDrone skills found');
const markdown = [
  resolve(skillRoot, 'README.md'),
  resolve(skillRoot, 'SHARED.md'),
];
for (const folder of folders) {
  const entry = resolve(skillRoot, folder.name, 'SKILL.md');
  const text = await readFile(entry, 'utf8');
  const header = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!header) fail('Missing frontmatter: ' + entry);
  const name = header[1].match(/^name: ([a-z0-9-]+)$/m)?.[1];
  if (name !== folder.name || name.length > 64 || name.includes('--'))
    fail('Invalid skill name: ' + folder.name);
  const description = header[1].match(/^description: (.+)$/m)?.[1];
  if (
    !description ||
    typeof JSON.parse(description) !== 'string' ||
    !JSON.parse(description).trim()
  )
    fail('Missing skill description: ' + name);
  if (/\b(?:TODO|TBD)\b|\[INSERT/.test(text))
    fail('Unfinished scaffold: ' + name);
  const metadata = await readFile(
    resolve(dirname(entry), 'agents/openai.yaml'),
    'utf8',
  );
  for (const field of ['display_name', 'short_description', 'default_prompt']) {
    const value = metadata.match(
      new RegExp('^  ' + field + ': (.+)$', 'm'),
    )?.[1];
    if (!value || typeof JSON.parse(value) !== 'string')
      fail('Invalid metadata: ' + name + '/' + field);
    if (
      field === 'short_description' &&
      (JSON.parse(value).length < 25 || JSON.parse(value).length > 64)
    )
      fail('Invalid UI description length: ' + name);
    if (field === 'default_prompt' && !JSON.parse(value).includes('$' + name))
      fail('Prompt must invoke skill: ' + name);
  }
  for (const match of text.matchAll(
    /^- (GET|POST|PATCH|PUT|DELETE|OPTIONS|HEAD) (\/api\/v1\S*)$/gm,
  )) {
    const operation = match[1] + ' ' + match[2];
    if (!expected.has(operation))
      fail('Obsolete or unknown skill endpoint: ' + operation);
    if (owners.has(operation)) fail('Duplicate API owner: ' + operation);
    owners.set(operation, name);
  }
  markdown.push(entry);
}
for (const file of markdown) {
  const text = await readFile(file, 'utf8');
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^(?:https?:|#)/.test(target)) continue;
    if (target.startsWith('/')) fail('Nonportable absolute link: ' + target);
    const local = resolve(
      dirname(file),
      decodeURIComponent(target.split('#')[0]),
    );
    if (relative(root, local).startsWith('..'))
      fail('Skill link escapes repository: ' + target);
    await stat(local).catch(() =>
      fail('Missing skill link in ' + basename(file) + ': ' + target),
    );
  }
}
for (const operation of expected)
  if (!owners.has(operation)) fail('Missing primary API owner: ' + operation);
if (
  (await realpath(resolve(root, '.agents/skills'))) !==
  (await realpath(skillRoot))
)
  fail('Project skill discovery must resolve to canonical skills/');
console.log(
  `Validated ${folders.length} module skills, metadata, links, project discovery and ${owners.size} API operation owners.`,
);

const base = process.env.BASE_SHA;
if (base && !/^0+$/.test(base)) {
  if (!/^[a-f0-9]{40}$/.test(base))
    fail('Invalid BASE_SHA for skill release checks');
  const changed = (filter) => {
    const result = spawnSync(
      'git',
      [
        'diff',
        '--name-only',
        ...(filter ? ['--diff-filter=AMR'] : []),
        base,
        'HEAD',
        '--',
      ],
      { cwd: root, encoding: 'utf8' },
    );
    if (result.status)
      fail('Cannot inspect skill changes; fetch full Git history');
    return result.stdout.split('\n').filter(Boolean);
  };
  assertSkillUpdate(changed(false), changed(true));
  console.log('Release skill update requirement passed.');
}
