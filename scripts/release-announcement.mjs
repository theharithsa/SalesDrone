/** Use the same reviewed public notes that the release page publishes. */
export function publicReleaseAnnouncement({ version, commit, releases, notes, changelog }) {
  const publication = releases.find(row => row.tagName === 'v' + version && !row.isDraft && !row.isPrerelease && row.publishedAt);
  if (!publication) return null;
  const section = changelog.split('## [' + version + '] - ')[1]?.split('\n## [')[0];
  if (!section) throw Error('Missing changelog section for the release announcement');
  const plain = line => line
    .replace(/!?\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replaceAll('**', '').replaceAll('`', '').trim();
  const highlights = (notes?.emailHighlights || section.split('\n')
    .filter(line => /^-\s+/.test(line)).map(line => plain(line.slice(2))))
    .filter(Boolean).slice(0, 5).map(line => line.slice(0, 240));
  if (!highlights.length) return null;
  const date = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(publication.publishedAt));
  return {
    version, commit, publishedAt: publication.publishedAt, date,
    summary: (notes?.summary || 'See what changed in this SalesDrone update.').slice(0, 250),
    highlights,
  };
}
