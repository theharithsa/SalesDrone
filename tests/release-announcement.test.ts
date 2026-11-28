import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicReleaseAnnouncement } from '../scripts/release-announcement.mjs';

test('the public release marker uses published release notes and ignores draft builds', () => {
  const common = {
    version: '2.15.0',
    commit: 'a'.repeat(40),
    changelog: '## [2.15.0] - 2026-11-29\n\n### Added\n- A **new** feature\n## [2.14.0] - 2026-11-22\n- Old notes',
  };
  const release = { tagName: 'v2.15.0', isDraft: true, publishedAt: '2026-11-28T20:00:00Z' };
  assert.equal(publicReleaseAnnouncement({ ...common, releases: [release] }), null);
  const published = { ...common, releases: [{ ...release, isDraft: false }] };
  const marker = publicReleaseAnnouncement(published);
  assert.equal(marker.date, '2026-11-29');
  assert.equal(marker.commit, common.commit);
  assert.deepEqual(marker.highlights, ['A new feature']);
  assert.deepEqual(publicReleaseAnnouncement({
    ...published, notes: { summary: 'New change', emailHighlights: ['Reviewed highlight'] },
  }).highlights, ['Reviewed highlight']);
});
