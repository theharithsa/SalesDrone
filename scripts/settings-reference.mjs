const groupNames = {
  personal: 'Personal',
  workspace: 'Workspace · Admin',
  manageFields: 'Manage fields',
  intelligence: 'AvinyaIntelligence',
  product: 'Product',
};
const escape = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
export function validateSettingsReference(catalog, sections) {
  if (
    catalog.schemaVersion !== 1 ||
    !Array.isArray(catalog.sections) ||
    !Array.isArray(catalog.environment)
  )
    throw Error('Unsupported settings reference');
  const ids = new Set();
  for (const section of catalog.sections) {
    if (
      ids.has(section.sectionId) ||
      !sections.some((s) => s.id === section.sectionId)
    )
      throw Error('Duplicate or unknown settings section');
    ids.add(section.sectionId);
    for (const key of ['scope', 'api', 'permissions'])
      if (!section[key]?.trim()) throw Error('Missing settings ' + key);
    if (!section.controls?.length)
      throw Error('Every settings section needs documented controls');
    const controls = new Set();
    for (const c of section.controls) {
      if (!c.id || controls.has(c.id)) throw Error('Duplicate control');
      controls.add(c.id);
      for (const key of ['label', 'default', 'description', 'effect'])
        if (typeof c[key] !== 'string' || !c[key].trim())
          throw Error('Missing control ' + key);
    }
  }
  if (ids.size !== sections.length)
    throw Error('Every UI settings section must be documented');
  for (const item of catalog.environment)
    if (!item.name?.trim() || !item.description?.trim())
      throw Error('Incomplete environment guide');
}
export function renderSettings(catalog, sections, scopes, version) {
  validateSettingsReference(catalog, sections);
  let md = `# Customize SalesDrone\n\nSettings guide for **v${version}**. Desktop groups expand to reveal their sections; mobile uses a grouped Settings section selector. Admin-only sections are hidden for other members. Changes to workspace data are authorized by the API, not by navigation.\n\n`,
    body = '';
  for (const section of sections) {
    const ref = catalog.sections.find((r) => r.sectionId === section.id),
      title = `${groupNames[section.group]} → ${section.label}`;
    md += `## ${title}\n\n**Who/where:** ${ref.scope}.\n\n**API:** ${ref.api}.\n\n**Permissions:** ${ref.permissions}.\n\n`;
    body += `<article id="${escape(section.id)}"><h2>${escape(title)}</h2><p><strong>Who/where:</strong> ${escape(ref.scope)}</p><p><strong>API:</strong> <code>${escape(ref.api)}</code></p><p><strong>Permissions:</strong> ${escape(ref.permissions)}</p>`;
    for (const c of ref.controls) {
      md += `### ${c.label}\n\n**Default:** ${c.default}.\n\n${c.description}\n\n${c.effect}${c.example ? '\n\n**Example:** ' + c.example : ''}\n\n`;
      body += `<details><summary>${escape(c.label)}</summary><p><strong>Default:</strong> ${escape(c.default)}</p><p>${escape(c.description)}</p><p>${escape(c.effect)}</p>${c.example ? `<p><strong>Example:</strong> ${escape(c.example)}</p>` : ''}</details>`;
    }
    if (section.id === 'developer') {
      md += '### API token scope catalog\n\n';
      body += '<h3>API token scope catalog</h3><ul>';
      for (const scope of scopes) {
        md += `- **${scope.id}** — ${scope.description}.\n`;
        body += `<li><code>${escape(scope.id)}</code>: ${escape(scope.description)}</li>`;
      }
      md += '\n';
      body += '</ul>';
    }
    body += '</article>';
  }
  md += '## Operator environment configuration\n\n';
  body +=
    '<article id="environment"><h2>Operator environment configuration</h2>';
  for (const e of catalog.environment) {
    md += `### ${e.name}\n\n${e.description}\n\n`;
    body += `<h3>${escape(e.name)}</h3><p>${escape(e.description)}</p>`;
  }
  body += '</article>';
  md +=
    'See [setup](SETUP.md), [API contracts](API.md), [reports](REPORTS.md), [intelligence](INTELLIGENCE.md), [security](../SECURITY.md) and [release checks](RELEASE.md) for detailed procedures. This file is generated from settings-reference.json and the shared UI section catalog; run npm run docs:settings after changes.\n';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="salesdrone-version" content="${escape(version)}"><title>SalesDrone settings guide</title><link rel="stylesheet" href="guide.css"><style>main{max-width:1100px;margin:auto;padding:32px}article{padding:32px 0;border-bottom:1px solid var(--line)}details{margin:14px 0;padding:16px}summary{font-weight:650;cursor:pointer}code{overflow-wrap:anywhere}nav{display:flex;flex-wrap:wrap;gap:12px}p{max-width:85ch}details p{font-size:1rem;color:var(--muted)}h2{font-size:clamp(1.4rem,4vw,2rem)}@media(prefers-color-scheme:dark){:root{background:#171c28;color:#eef1f7;--muted:#bdc9d6;--blue:#8cc8ff;--line:#39465c}body{background:#171c28;color:#eef1f7}h1,h2,h3,summary{color:#eef1f7}nav a{color:#b8dafb}}</style></head><body><main><a href="index.html#settings">← Product guide</a><h1>Customize SalesDrone</h1><p>Every setting explained · v${escape(version)}. Workspace settings need Admin access; personal preferences affect only you. Use Manage fields for lead definitions and dropdown choices.</p><nav aria-label="Settings guide">${sections.map((s) => `<a href="#${escape(s.id)}">${escape(s.label)}</a>`).join('')}<a href="#environment">Operator environment</a></nav>${body}<p><a href="https://github.com/theharithsa/SalesDrone/blob/main/docs/SETUP.md">Operator setup</a> · <a href="https://sales-drone-avinya.firebaseapp.com/api/docs">Swagger API portal</a></p></main></body></html>`;
  return { markdown: md, html };
}
