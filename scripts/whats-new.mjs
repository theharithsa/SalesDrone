const escape = (text) =>
  text.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);

const repository = 'https://github.com/theharithsa/SalesDrone';

function page(title, current, intro, content) {
  const link = (name, href) =>
    `<a href="${href}"${name === current ? ' aria-current="page"' : ''}>${name}</a>`;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} | SalesDrone</title><link rel="stylesheet" href="whats-new.css">
</head><body>
<header><div class="shell"><a class="brand" href="index.html">SalesDrone</a>
<nav aria-label="Documentation">${link('Guide', 'index.html')}${link('Roadmap', 'roadmap.html')}${link('Release notes', 'releases.html')}</nav>
</div></header>
<main class="shell"><div class="intro"><h1>${title}</h1><p>${intro}</p></div>${content}</main>
<footer class="shell"><a href="product.html">Product handbook</a> <a href="${repository}">SalesDrone on GitHub</a></footer>
</body></html>`;
}

export function renderRoadmap(sprints) {
  if (!sprints.length || sprints.some(({ sprint, milestone }, index) =>
    sprint !== index + 1 || !Number.isSafeInteger(milestone) || milestone < 1))
    throw Error('Invalid public sprint sequence');

  const product = sprints.filter(({ sprint }) => sprint >= 3);
  const maintenance = sprints.filter(({ sprint }) => sprint < 3);
  const cards = (items) => items.map(({ sprint, title, window, summary, milestone }) =>
    `<li><article><p class="meta">Sprint ${sprint} · ${escape(window)}</p>
<h3>${escape(title)}</h3><p>${escape(summary)}</p>
<a href="${repository}/milestone/${milestone}">Sprint ${sprint} milestone</a></article></li>`).join('');

  return page('SalesDrone roadmap', 'Roadmap',
    'See what we’re working on, what it means for your team, and what has to happen first.',
    `<section aria-labelledby="product"><h2 id="product">Product plans</h2>
<p class="note">Dates are planning windows. Pilots and signup move if the required checks take longer.</p>
<ol class="flow" start="3">${cards(product)}</ol></section>
<section aria-labelledby="maintenance"><h2 id="maintenance">Maintenance and documentation</h2>
<ol class="maintenance">${cards(maintenance)}</ol></section>
<p><a href="https://github.com/users/theharithsa/projects/4/views/10">Follow work in GitHub Sprint Delivery</a></p>`);
}

export function renderReleaseNotes(changelog, notes, candidate) {
  const versions = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})\s*$/gm)];
  const history = versions.filter(([, version]) => Object.hasOwn(notes, version));
  if (history.length !== Object.keys(notes).length || new Set(versions.map(([, version]) => version)).size !== versions.length
    || versions.some(([, version]) => version !== candidate && !Object.hasOwn(notes, version)))
    throw Error('Public release highlights must match changelog history');

  const entries = history.map((heading) => {
    const [, version, date] = heading;
    const { summary, published } = notes[version];
    if (!summary || (published && !/^\d{4}-\d{2}-\d{2}$/.test(published)))
      throw Error('Invalid public release metadata for ' + version);
    const changelogLink = `${repository}/blob/main/CHANGELOG.md#${version.replaceAll('.', '')}---${date}`;
    return `<article id="v${version}" class="release">
<div class="release-heading"><h2>v${version}</h2>
<p class="meta">${published ? 'Published' : 'Changelog entry'} <time datetime="${published || date}">${published || date}</time></p></div>
<p>${escape(summary)}</p>
<div class="links">${published ? `<a href="${repository}/releases/tag/v${version}">GitHub release</a>` : ''}
<a href="${changelogLink}">Full changelog entry</a></div></article>`;
  }).join('');

  return page('SalesDrone release notes', 'Release notes',
    'Find what changed in each version, from the first release through the latest verified publication.',
    `<figure><img src="assets/screenshots/book-dashboard-demo.jpg" alt="Synthetic SalesDrone Book mode dashboard with handwritten labels">
<figcaption>Book mode dashboard from a reviewed synthetic demo. See the v2.12 series for appearance changes.</figcaption></figure>
<details class="index"><summary>Jump to a version</summary><ul>${history.map(([, v]) => `<li><a href="#v${v}">v${v}</a></li>`).join('')}</ul></details>
<div class="releases">${entries}</div>`);
}
