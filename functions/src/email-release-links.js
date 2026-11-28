export const RELEASE_NOTES_ORIGIN = 'https://theharithsa.github.io/SalesDrone/';

export const releaseNotesUrl = version =>
  new URL('release-notes/v' + version + '.html', RELEASE_NOTES_ORIGIN).href;
