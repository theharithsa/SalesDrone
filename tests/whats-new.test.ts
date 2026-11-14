import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { renderReleaseNotes, renderRoadmap } from '../scripts/whats-new.mjs';

const read = (name: string) => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

test('release archive preserves every changelog version and keeps unpublished entries out of the latest card', () => {
  const changelog = read('CHANGELOG.md');
  const notes = JSON.parse(read('docs/whats-new/releases.json'));
  const { index, pages } = renderReleaseNotes(changelog, notes);
  const versions = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)].map((entry) => entry[1]);
  assert.deepEqual([...pages.keys()], versions);
  const document = new JSDOM(index).window.document;
  assert.deepEqual([...document.querySelectorAll('.release-list > li')].map((row) => row.id),
    versions.map((version) => 'v' + version));
  const latest = versions.find((version) => notes[version]?.published);
  assert.equal(document.querySelector('.latest-release a')?.getAttribute('href'), 'release-notes/v' + latest + '.html');
  assert.equal(new JSDOM(pages.get('2.13.0')).window.document.querySelector('article img')
    ?.getAttribute('src'), '../assets/screenshots/lead-feature-access-demo.jpg');
});

test('archive filtering handles matching, empty, and cleared queries', () => {
  const { index } = renderReleaseNotes(
    '## [2.0.1] - 2026-11-13\n### Fixed\n- Improve invoicing.\n## [2.0.0] - 2026-11-12\n### Added\n- Add search.',
    { '2.0.0': { summary: 'Add search.', published: '2026-11-12' } },
  );
  const { window } = new JSDOM(index, { runScripts: 'outside-only' });
  window.eval(read('site/release-filter.js'));
  const filter = window.document.querySelector<HTMLInputElement>('#filter')!;
  const result = window.document.querySelector('#results')!;
  for (const [query, expected] of [['INVOICING 2.0.1', '1 version'], ['unknown', 'No matching releases.'], ['', '2 versions']]) {
    filter.value = query;
    filter.dispatchEvent(new window.Event('input'));
    assert.equal(result.textContent, expected);
  }
});

test('roadmap flow targets sprint sections and links the workspace redesign issue', () => {
  const { sprints, redesign, preview } = JSON.parse(read('docs/whats-new/roadmap.json'));
  const document = new JSDOM(renderRoadmap(sprints, redesign, preview)).window.document;
  const targets = [...document.querySelectorAll('.dependency-flow a')].map((anchor) => anchor.getAttribute('href'));
  assert.deepEqual(targets, ['#sprint-4', '#sprint-4', '#sprint-5', '#sprint-6']);
  assert.ok(targets.every((target) => document.querySelector(target!)));
  assert.ok(document.querySelector(`section[aria-labelledby="workspace-redesign"] a[href$="/issues/${redesign.issue}"]`));
});

test('public roadmap only uses approved open issues and never publishes engineering notes', async () => {
  const { publicRoadmapFeatures } = await import('../scripts/public-roadmap.mjs');
  const approved = {
    number: 217, title: 'Email reminders', state: 'open',
    labels: [{ name: 'roadmap-public' }], milestone: { number: 48 },
    body: '## Public summary\n\nSend <mail> to assigned team members.\n\n## Internal\nPrivate acceptance notes.',
  };
  const features = publicRoadmapFeatures([[approved, { ...approved, number: 218, state: 'closed' }], [
    { ...approved, number: 219, labels: [] },
    { ...approved, number: 220, pull_request: {} },
  ]]);
  assert.deepEqual(features, [{
    number: 217, title: 'Email reminders', summary: 'Send <mail> to assigned team members.', milestone: 48,
  }]);
  assert.throws(() => publicRoadmapFeatures([{ ...approved, body: '## Internal\nOther notes.' }]), /#217/);
  const { sprints, redesign } = JSON.parse(read('docs/whats-new/roadmap.json'));
  const roadmap = new JSDOM(renderRoadmap(sprints, redesign, features)).window.document;
  const upcoming = roadmap.querySelector('section[aria-labelledby="upcoming"]');
  assert.match(upcoming?.textContent || '', /Sprint 3.*Send <mail>/);
  assert.equal(upcoming?.querySelector('mail'), null);
  assert.doesNotMatch(roadmap.body.textContent || '', /Private acceptance notes/);
  assert.ok(new JSDOM(renderReleaseNotes(read('CHANGELOG.md'), {}, features).index)
    .window.document.querySelector('section[aria-labelledby="upcoming"] a[href$="/issues/217"]'));
});

test('SDLC reading path links to the pre-production environment and weekly release policy', async () => {
  const { renderSdlcGuide } = await import('../scripts/sdlc-guide.mjs');
  const document = new JSDOM(renderSdlcGuide()).window.document;
  for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
    assert.ok(document.getElementById(anchor.hash.slice(1)), `Missing guide target ${anchor.hash}`);
  }
  const preprod = document.querySelector('#preproduction')!;
  assert.ok(preprod.querySelector('a[href="https://sales-drone-avinya-preprod.web.app/"]'));
  assert.deepEqual([...preprod.querySelectorAll<HTMLAnchorElement>('a[href*="/issues/"]')].map(a => a.href.split('/').at(-1)), ['223','224','225','226','222']);
  assert.ok(document.querySelector('#weekly-releases a[href$="RELEASE-GOVERNANCE.md#weekly-production-cadence"]'));
  assert.match(document.querySelector('#example')?.textContent || '', /planned, not shipped/);
  assert.equal(document.querySelectorAll('script[src*="firebase"]').length, 0);
});
