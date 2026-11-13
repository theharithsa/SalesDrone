const escape = (text) =>
  text.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);

const repository = 'https://github.com/theharithsa/SalesDrone';

function page(title, current, intro, content, detail = false) {
  const base = detail ? '../' : '';
  const link = (name, href) =>
    `<a href="${base}${href}"${name === current ? ' aria-current="page"' : ''}>${name}</a>`;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} | SalesDrone</title><link rel="stylesheet" href="${detail ? '../' : ''}whats-new.css">
${current === 'Release notes' && !detail ? '<script src="release-filter.js" defer></script>' : ''}
</head><body class="${current === 'Release notes' ? 'release-docs' : ''}">
<header><div class="shell"><a class="brand" href="${base}index.html"><span class="brand-mark" aria-hidden="true"></span><span>SalesDrone<span class="brand-dot">.</span></span></a>
<nav aria-label="Documentation">${link('Guide', 'index.html')}${link('Roadmap', 'roadmap.html')}${link('Release notes', 'releases.html')}</nav>
</div></header>
<main class="shell"><div class="intro"><h1>${title}</h1><p>${intro}</p></div>${content}</main>
<footer class="shell"><a href="${base}product.html">Product handbook</a> <a href="${repository}">SalesDrone on GitHub</a></footer>
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

const images = {
  '2.13.0': ['lead-feature-access-demo.jpg', 'Synthetic SalesDrone feature access settings', 'Feature access settings from the v2.13.0 demo.'],
  '2.12.2': ['book-dashboard-demo.jpg', 'Synthetic SalesDrone Book mode dashboard', 'Book mode dashboard from the v2.12.2 demo.'],
};

const renderChange = (text) => text.split(/(`[^`]+`)/).map((part) =>
  part.startsWith('`') && part.endsWith('`') && part.length > 2
    ? `<code>${escape(part.slice(1, -1))}</code>` : escape(part)).join('');

function sectionsFor(entry) {
  const groups = new Map();
  for (const block of entry.split(/^### /m).slice(1)) {
    const [heading, ...lines] = block.trim().split('\n');
    const label = /^(Added|Initial release)$/.test(heading) ? 'New features'
      : /^(Changed|Desktop density maintenance|Lead activity tabs)/.test(heading) ? 'Changes'
      : /^Unpublished candidate$/.test(heading) ? 'Publication status'
      : 'Fixes and maintenance';
    const items = lines.filter((line) => line.startsWith('- ')).map((line) => line.slice(2));
    if (!items.length) continue;
    groups.set(label, [...(groups.get(label) || []), ...items]);
  }
  return [...groups].map(([label, items]) => ({
    label, items, id: label.toLowerCase().replaceAll(' ', '-'),
  }));
}

const dateLabel = (date) => new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium', timeZone: 'UTC',
}).format(new Date(date));

export function renderReleaseNotes(changelog, notes, candidate) {
  const headings = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})[ \t]*$/gm)];
  const history = headings.map((heading, index) => ({ heading, end: headings[index + 1]?.index }))
    .filter(({ heading: [, version] }) => Object.hasOwn(notes, version));
  if (history.length !== Object.keys(notes).length || new Set(headings.map(([, version]) => version)).size !== headings.length
    || headings.some(([, version]) => version !== candidate && !Object.hasOwn(notes, version)))
    throw Error('Public release highlights must match changelog history');

  const rows = [];
  const pages = new Map();
  for (const { heading, end } of history) {
    const [, version, date] = heading;
    const { summary, published } = notes[version];
    if (!summary || (published && !/^\d{4}-\d{2}-\d{2}$/.test(published)))
      throw Error('Invalid public release metadata for ' + version);
    const sections = sectionsFor(changelog.slice(heading.index + heading[0].length, end));
    if (!sections.length) throw Error('Missing release details for ' + version);
    const status = published ? 'Published' : 'Changelog entry';
    const time = `<time datetime="${published || date}">${dateLabel(published || date)}</time>`;
    rows.push(`<tr id="v${version}"><th scope="row"><a href="release-notes/v${version}.html">v${version}</a></th><td>${escape(summary)}</td><td>${time}<small>${status}</small></td></tr>`);

    const figure = images[version];
    const illustration = figure ? `<figure><img src="../assets/screenshots/${figure[0]}" alt="${figure[1]}" loading="lazy"><figcaption>${figure[2]}</figcaption></figure>` : '';
    const changelogLink = `${repository}/blob/main/CHANGELOG.md#${version.replaceAll('.', '')}---${date}`;
    pages.set(version, page(`What’s new in v${version}`, 'Release notes', escape(summary),
      `<p class="meta">${status} · ${time}</p>
<div class="release-detail">
<article>${illustration}
${sections.map(({ label, id, items }) => `<section id="${id}"><h2>${label}</h2><ul>${items.map(item => `<li>${renderChange(item)}</li>`).join('')}</ul></section>`).join('')}
<p class="links"><a href="../releases.html#v${version}">All releases</a>
${published ? `<a href="${repository}/releases/tag/v${version}">GitHub release</a>` : ''}
<a href="${changelogLink}">Full changelog entry</a></p></article>
<aside aria-labelledby="on-this-page"><h2 id="on-this-page">On this page</h2>
<ul>${sections.map(({ label, id }) => `<li><a href="#${id}">${label}</a></li>`).join('')}</ul></aside></div>`, true));
  }

  return {
    index: page('SalesDrone release notes', 'Release notes',
      'Browse new features, changes and fixes by version.',
      `<div class="release-filter" hidden><label for="filter">Filter releases</label>
<input id="filter" type="search" placeholder="Version or keyword" autocomplete="off">
<p id="results" role="status"></p></div>
<table class="release-table"><thead><tr><th scope="col">Version</th><th scope="col">Highlights</th><th scope="col">Date</th></tr></thead>
<tbody>${rows.join('')}</tbody></table>`),
    pages,
  };
}
