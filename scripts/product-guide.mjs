import { createElement as h } from 'react';
import { Card, HStack, VStack } from '@astryxdesign/core/Layout';
import { heading, paragraph, link, buttonLink, page } from './public-docs-layout.mjs';

const references = [
  ['index.html', 'Product overview'],
  ['settings.html', 'Settings reference'],
  ['https://sales-drone-avinya.firebaseapp.com/api/docs', 'API portal'],
];

export function renderProductGuide(guide, version, screenshotManifest = []) {
  const ids = new Set();
  for (const m of guide.modules) {
    if (
      !/^[a-z][a-z0-9-]+$/.test(m.id) ||
      ids.has(m.id) ||
      (m.screenshot !== undefined &&
        (typeof m.screenshot !== 'string' ||
          !/^[a-z0-9-]+\.jpg$/.test(m.screenshot))) ||
      !m.steps?.length ||
      !m.details?.length ||
      !m.faq?.length
    )
      throw Error('Incomplete or duplicate product module');
    ids.add(m.id);
  }
  const md = [
    '# ' + guide.title,
    '',
    'Version ' + version,
    '',
    '[Complete settings reference](SETTINGS.md) · [API guide](API.md) · [Technical architecture](TECHNICAL.md)',
    '',
  ];
  const capture = (name, alt, caption, fallbackWidth, className) => {
    const entry = screenshotManifest.find((item) => item.file === name);
    const dimensions = entry && /^(\d+) x (\d+)$/.exec(entry.capturePixels || '');
    if (entry && !dimensions) throw Error('Invalid screenshot dimensions: ' + name);
    return h('figure', { className, key: name },
      h('img', {
        src: 'assets/screenshots/' + name, alt, loading: 'lazy',
        width: dimensions ? Number(dimensions[1]) : fallbackWidth,
        height: dimensions ? Number(dimensions[2]) : undefined,
      }),
      h('figcaption', null, caption));
  };
  const sections = guide.modules.map((m) => {
      md.push(
        '## ' + m.title,
        '',
        m.audience,
        '',
        ...m.steps.flatMap((s, i) => [i + 1 + '. ' + s, '']),
        ...m.details.flatMap((p) => [p, '']),
        ...(m.screenshot
          ? [
              `![${m.title} — synthetic demo only](../site/assets/screenshots/${m.screenshot})`,
              '',
            ]
          : []),
        '### Questions',
        '',
        ...m.faq.flatMap(([q, a]) => ['**' + q + '**', '', a, '']),
      );
    return h('section', { id: m.id, key: m.id, 'data-guide-module': '' },
      h(Card, { padding: 0 },
        h(VStack, { gap: 4, className: 'guide-module' },
          paragraph(m.audience, 'kicker'),
          heading(2, m.title),
          h('ol', { className: 'guide-steps' }, m.steps.map((step, i) => h('li', { key: i }, step))),
          m.details.map((detail, i) => h('p', { key: i }, detail)),
          m.screenshot && capture(m.screenshot, m.title + ' — synthetic demo only', 'Fictional demo data only.'),
          heading(3, 'Questions & troubleshooting'),
          h(VStack, { gap: 2 }, m.faq.map(([question, answer], i) =>
            h('details', { key: i },
              h('summary', null, question),
              h('p', null, answer)))))));
  });

  const referenceLinks = references.map(([href, label]) => link(href, label, { key: href }));
  const topicLinks = guide.modules.map(({ id, title }) => link('#' + id, title, { key: id }));
  const gallery = [
    ['mobile-leads-demo.jpg', 'Synthetic mobile lead list with search and filters', 'Phone layout with synthetic records.', 390, 'phone-capture'],
    ['book-mode-light.jpg', 'Synthetic dashboard in Book mode', 'Book mode is a personal setting under Appearance & time.', 1440],
    ['laptop-demo.jpg', 'Synthetic laptop lead table', 'Laptop lead layout.', 1280],
    ['tablet-demo.jpg', 'Synthetic tablet lead list with column scrolling', 'Tablet-width lead list.', 900],
    ['import-demo.jpg', 'Isolated import preview', 'Workbook upload is disabled in this isolated preview.', 1280],
    ['lead-tasks-demo.jpg', 'Synthetic shared tasks with responsibility and task actions', 'Shared lead tasks with responsible team members.', 1440],
    ['activity-demo.jpg', 'Synthetic lead activity and recorded calls', 'Lead activity with fictional notes.', 1000],
    ['font-settings-demo.jpg', 'Appearance settings with font selector and preview', 'Personal font preferences.', 1280],
  ];
  const html = page('Product handbook', 'Handbook',
    h(VStack, { gap: 6 },
      h(Card, { padding: 0, className: 'editorial-card handbook-hero' },
        h(VStack, { gap: 3, className: 'editorial-copy' },
          paragraph('SalesDrone · v' + version, 'kicker'),
          heading(1, 'Product handbook', 'display-heading'),
          paragraph('Find step-by-step help for managing leads, following up, and configuring your workspace.', 'lede'),
          h(HStack, { gap: 2, wrap: 'wrap' }, buttonLink('settings.html', 'Settings reference'), buttonLink(references[2][0], 'API portal')),
h('section', { className: 'release-filter handbook-search', hidden: true, 'aria-label': 'Search the handbook' },
        h('label', { htmlFor: 'find' }, 'Find in handbook'),
        h('input', { id: 'find', type: 'search', placeholder: 'Search a feature or question', autoComplete: 'off' }),
        h('p', { id: 'search-status', role: 'status' }))),
        capture('lead-workspace-demo.jpg', 'Synthetic lead workspace with comments selected',
          'Lead workspace with fictional demonstration data.', 1440)),
      h('section', { className: 'handbook-grid', 'aria-label': 'Handbook content' },
        h('aside', { className: 'handbook-topics' },
          h('details', { id: 'handbook-topics', open: true },
            h('summary', null, 'Browse topics'),
            h(VStack, { as: 'nav', 'aria-label': 'Handbook modules', gap: 1 }, topicLinks))),
        h(VStack, { className: 'handbook-content', gap: 4 }, sections,
          h('section', { id: 'handbook-gallery', className: 'handbook-gallery', 'aria-label': 'Workspace examples' },
            heading(2, 'Workspace examples'),
            gallery.map((item) => capture(...item))),
          h(HStack, { as: 'nav', 'aria-label': 'Related documentation', gap: 3, wrap: 'wrap' }, referenceLinks)))),
    { handbook: true, version });
  return { html, markdown: md.join('\n').trimEnd() + '\n' };
}
