import { createElement as h, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import { Card, HStack, VStack } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Link } from '@astryxdesign/core/Link';

const repository = 'https://github.com/theharithsa/SalesDrone';
const heading = (level, content, className) =>
  h(Heading, { level, weight: 'normal', className }, content);
const paragraph = (content, className) =>
  h(Text, { as: 'p', type: 'body', className }, content);
const link = (href, content, props = {}) => h(Link, { href, ...props }, content);
const buttonLink = (href, label, variant = 'secondary') => h(Button, { href, label, variant, className: 'wrap-button' },
    h('span', { className: 'wrap-button-label' }, label));
const section = (id, title, ...children) =>
  h(VStack, { as: 'section', gap: 5, 'aria-labelledby': id },
    h(Heading, { id, level: 2, weight: 'normal' }, title), ...children);

function page(title, current, content, { detail = false, filter = false } = {}) {
  const base = detail ? '../' : '';
  const navigation = [['Roadmap', 'roadmap.html'], ['Release notes', 'releases.html'], ['Product guide', 'index.html']];
  const stylesheet = (path) => h('link', { key: path, rel: 'stylesheet', href: base + path });
  return '<!doctype html>\n' + renderToStaticMarkup(h('html', { lang: 'en', 'data-theme': 'light' },
    h('head', null,
      h('meta', { charSet: 'utf-8' }),
      h('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }),
      h('title', null, title + ' | SalesDrone'),
      h('link', { rel: 'icon', href: base + 'assets/brand/icon.svg' }),
      ['astryx/reset.css', 'astryx/core.css', 'astryx/neutral.css', 'whats-new.css'].map(stylesheet),
      filter && h('script', { src: 'release-filter.js', defer: true })),
    h('body', null, h(Theme, { theme: neutralTheme, mode: 'light' },
      h('a', { className: 'skip-link', href: '#content' }, 'Skip to content'),
      h('header', { className: 'updates-header' },
        h(HStack, { className: 'shell header-content', justify: 'between', align: 'center', wrap: 'wrap', gap: 3 },
          h(HStack, { as: 'a', href: base + 'index.html', className: 'brand', align: 'center', gap: 2 },
            h('img', { src: base + 'assets/brand/salesdrone-mark.png', width: 32, height: 32, alt: '' }),
            h(Text, { weight: 'semibold' }, 'SalesDrone')),
          h(HStack, { as: 'nav', 'aria-label': 'Documentation', className: 'updates-nav', gap: 1, wrap: 'wrap' },
            navigation.map(([label, href]) => h('a', {
              key: href, href: base + href,
              'aria-current': current === label ? (detail ? 'location' : 'page') : undefined,
            }, label))))),
      h(VStack, { as: 'main', id: 'content', tabIndex: -1, className: 'shell updates-main', gap: 8 }, content),
      h(HStack, { as: 'footer', className: 'shell updates-footer', justify: 'between', wrap: 'wrap', gap: 3 },
        h(Text, { type: 'supporting', color: 'secondary' }, 'SalesDrone by AvinyaTech'),
        h(HStack, { gap: 4, wrap: 'wrap' }, link(base + 'product.html', 'Product handbook'), link(repository, 'GitHub')))))));
}

const artwork = (name, loading) => h('img', {
  className: 'editorial-image', src: 'assets/roadmap/' + name + '.webp',
  alt: '', width: 1200, height: 800, loading,
});

function sprintRows(sprints) {
  return h('ol', { className: 'sprint-list', start: sprints[0]?.sprint },
    sprints.map(({ sprint, title, window, summary, milestone }) =>
      h('li', { key: sprint, id: 'sprint-' + sprint },
        h(HStack, { as: 'article', className: 'sprint-row', gap: 4 },
          h(VStack, { className: 'sprint-date', gap: 1 },
            paragraph('Sprint ' + sprint, 'kicker'), paragraph(window, 'muted')),
          h(VStack, { gap: 2 }, heading(3, title), paragraph(summary, 'muted'),
            link(repository + '/milestone/' + milestone, 'View Sprint ' + sprint + ' milestone'))))));
}

function upcomingFeatures(features, sprints = []) {
  if (!features.length) return null;
  return section('upcoming', 'Upcoming features',
    h('ul', { className: 'upcoming-list' }, features.map(({ number, title, summary, milestone }) => {
      const sprint = sprints.find((entry) => entry.milestone === milestone);
      return h('li', { key: number }, h(Card, { padding: 4 },
        h(VStack, { gap: 2 },
          paragraph(sprint ? 'Sprint ' + sprint.sprint + ' · ' + sprint.window : 'Planned · Date to be confirmed', 'kicker'),
          heading(3, title),
          paragraph(summary, 'muted'),
          link(repository + '/issues/' + number, 'Track this feature on GitHub'))));
    })));
}

export function renderRoadmap(sprints, redesign, features = []) {
  if (sprints.length < 6 || sprints.some(({ sprint, milestone }, index) =>
    sprint !== index + 1 || !Number.isSafeInteger(milestone) || milestone < 1) ||
    !Number.isSafeInteger(redesign.issue) || redesign.issue < 1)
    throw Error('Invalid public sprint sequence or redesign issue');

  const prerequisites = [
    ['4', 'Isolate organizations', 'Verify that each workspace can access only its own data.', 4],
    ['4', 'Move the existing workspace', 'Rehearse the migration and test how to roll it back.', 4],
    ['5', 'Pilot invoicing', 'Try invoices and payments with a small group.', 5],
    ['6', 'Decide on public signup', 'Review pilot and staged signup results before opening access.', 6],
  ];
  return page('Product roadmap', 'Roadmap', h(Fragment, null,
    h(Card, { className: 'editorial-card', padding: 0 },
      h(VStack, { className: 'editorial-copy', gap: 4 },
        paragraph('Product updates', 'kicker'),
        heading(1, 'Product roadmap', 'display-heading'),
        paragraph('See what’s planned for SalesDrone, when we’re aiming to deliver it, and what needs to happen first.', 'lede'),
        h(HStack, { gap: 2, wrap: 'wrap' },
          buttonLink('#sprint-plan', 'Sprint plan', 'primary'),
          buttonLink('releases.html', 'Release notes'))),
      artwork('flight-plan', 'eager')),
    section('dependencies', 'From isolated workspaces to public signup',
      paragraph('Each step depends on the one before it. Sprint dates are targets and can move if a check takes longer.', 'muted'),
      h('ol', { className: 'dependency-flow' }, prerequisites.map(([step, title, summary, sprint]) =>
        h('li', { key: step }, h(Card, { className: 'flow-card', padding: 4 },
          h(VStack, { gap: 2 }, paragraph('Sprint ' + step, 'kicker'),
            heading(3, link('#sprint-' + sprint, title)), paragraph(summary, 'muted'))))))),
    features.some(({ number }) => number === redesign.issue) && section('workspace-redesign', 'A redesigned SalesDrone workspace',
      h(Card, { className: 'editorial-card roadmap-feature', padding: 0 },
        h(VStack, { className: 'editorial-copy', gap: 3 },
          paragraph('Planned · Upcoming sprints', 'kicker'),
          heading(3, 'Astryx across SalesDrone'),
          paragraph('This roadmap and the release notes are the first step. The next phase brings the same design system to the workspace, starting with navigation, leads and tasks. Dashboard, Settings and the remaining screens follow in stages.', 'muted'),
          buttonLink(repository + '/issues/' + redesign.issue, 'View redesign plan')),
        artwork('workspace-redesign', 'lazy')),
      h('ol', { className: 'redesign-flow', 'aria-label': 'Workspace redesign sequence' },
        ['Public docs', 'Workspace navigation', 'Leads and tasks', 'Dashboard and Settings'].map((phase) =>
          h('li', { key: phase }, paragraph(phase))))),
    upcomingFeatures(features.filter(({ number }) => number !== redesign.issue), sprints),
    section('sprint-plan', 'Sprint plan',
      sprintRows(sprints),
      link('https://github.com/users/theharithsa/projects/4/views/10', 'Open Sprint Delivery on GitHub'))));
}

const images = {
  '2.13.0': ['lead-feature-access-demo.jpg', 'Synthetic SalesDrone feature access settings', 'Feature access settings from the v2.13.0 demo.'],
  '2.12.2': ['book-dashboard-demo.jpg', 'Synthetic SalesDrone Book mode dashboard', 'Book mode dashboard from the v2.12.2 demo.'],
};

const renderChange = (text) => text.split(/(`[^`]+`)/).map((part, index) =>
  part.startsWith('`') && part.endsWith('`') && part.length > 2
    ? h('code', { key: index }, part.slice(1, -1)) : part);

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
const dateTime = (date) => h('time', { key: date, dateTime: date }, dateLabel(date));

export function renderReleaseNotes(changelog, notes, features = [], sprints = []) {
  const headings = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})[ \t]*$/gm)];
  const history = headings.map((heading, index) => ({ heading, end: headings[index + 1]?.index }));
  const versions = new Set(headings.map(([, version]) => version));
  if (versions.size !== headings.length || Object.keys(notes).some((version) => !versions.has(version)))
    throw Error('Public release highlights must match changelog history');

  const records = history.map(({ heading, end }) => {
    const [, version, date] = heading;
    const sections = sectionsFor(changelog.slice(heading.index + heading[0].length, end));
    if (!sections.length) throw Error('Missing release details for ' + version);
    const { summary = sections[0].items[0].replaceAll('`', ''), published } = notes[version] || {};
    if (!summary || (published && !/^\d{4}-\d{2}-\d{2}$/.test(published)))
      throw Error('Invalid public release metadata for ' + version);
    return { version, date, summary, published, sections,
      label: published ? 'Published' : 'Changelog entry',
      href: 'release-notes/v' + version + '.html' };
  });
  const latest = records.find((record) => record.published);
  const pages = new Map(records.map((record, index) => {
    const { version, date, summary, published, sections, label } = record;
    const figure = images[version];
    const illustration = figure && h('figure', { className: 'release-figure' },
      h('img', { src: '../assets/screenshots/' + figure[0], alt: figure[1], loading: 'lazy' }),
      h('figcaption', null, figure[2]));
    const related = [[records[index - 1], 'Newer release'], [records[index + 1], 'Older release']];
    return [version, page('What’s new in v' + version, 'Release notes', h(Fragment, null,
      h(VStack, { gap: 3, className: 'detail-intro' },
        link('../releases.html#v' + version, '← All release notes'),
        paragraph([label, ' · ', dateTime(published || date)], 'kicker'),
        heading(1, 'What’s new in v' + version, 'display-heading'),
        paragraph(summary, 'lede')),
      h('section', { className: 'release-detail', 'aria-label': 'Release changes' },
        h(VStack, { as: 'aside', className: 'contents', gap: 2, 'aria-labelledby': 'on-this-page' },
          h(Heading, { id: 'on-this-page', level: 2, weight: 'medium' }, 'On this page'),
          h(VStack, { as: 'nav', 'aria-label': 'On this page', gap: 2 },
            sections.map(({ label, id }) => link('#' + id, label, { key: id })))),
        h(VStack, { as: 'article', gap: 5 }, illustration,
          sections.map(({ label, id, items }) =>
            h(VStack, { key: id, as: 'section', id, gap: 3, className: 'change-section' },
              heading(2, label),
              h('ul', { className: 'changes' }, items.map((item, index) =>
                h('li', { key: index }, renderChange(item)))))),
          h(HStack, { gap: 2, wrap: 'wrap' },
            published && buttonLink(repository + '/releases/tag/v' + version, 'GitHub release'),
            buttonLink(repository + '/blob/main/CHANGELOG.md#' + version.replaceAll('.', '') + '---' + date, 'View changelog')),
          h(HStack, { as: 'nav', className: 'adjacent-releases', 'aria-label': 'Adjacent releases', gap: 4, wrap: 'wrap' },
            related.filter(([item]) => item).map(([item, direction]) =>
              link('../' + item.href, direction + ' · v' + item.version, { key: item.version })))))),
    { detail: true })];
  }));

  const archive = records.map(({ version, date, published, label, summary, href }) =>
    h('li', { key: version, id: 'v' + version },
      h('article', { className: 'release-row' },
        heading(3, link(href, 'v' + version)),
        paragraph(summary),
        paragraph([dateTime(published || date), h('small', { key: 'status' }, label)], 'release-date'))));

  return {
    index: page('Release notes', 'Release notes', h(Fragment, null,
      h('section', { className: 'release-overview', 'aria-label': 'Release notes overview' },
        h(VStack, { className: 'editorial-copy release-intro', gap: 3 },
          paragraph('Product updates', 'kicker'),
          heading(1, 'Release notes', 'display-heading'),
          paragraph('Find new features, fixes and changes for every SalesDrone version.', 'lede'),
          h(HStack, { gap: 3, wrap: 'wrap' },
            link('#release-history', 'Search versions'),
            link('roadmap.html', 'View roadmap'))),
        latest && h(Card, { className: 'latest-release', padding: 5 },
          h(VStack, { gap: 3 },
            paragraph('Latest published', 'kicker'),
            heading(2, 'v' + latest.version),
            paragraph(latest.summary, 'muted'),
            paragraph(dateTime(latest.published), 'muted'),
            buttonLink(latest.href, 'Read the latest notes', 'primary')))),
      upcomingFeatures(features, sprints),
      section('release-history', 'All versions',
        h('section', { className: 'release-filter', hidden: true, 'aria-label': 'Find releases' },
          h('label', { htmlFor: 'filter' }, 'Search releases'),
          h('input', { id: 'filter', type: 'search', placeholder: 'Version, feature or keyword', autoComplete: 'off' }),
          h('p', { id: 'results', role: 'status' })),
        h('ol', { className: 'release-list' }, archive))),
    { filter: true }),
    pages,
  };
}
