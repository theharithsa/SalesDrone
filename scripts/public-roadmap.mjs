// The label opts the issue title and a single plain-text paragraph into Pages.
export function publicRoadmapFeatures(issues) {
  return issues.flat()
    .filter((issue) => !issue.pull_request && issue.state === 'open' &&
      issue.labels?.some(({ name }) => name === 'roadmap-public'))
    .map(({ number, title, body, milestone }) => {
      const publicSection = body?.split(/^## Public summary[ \t]*\r?$/m)[1];
      const summary = publicSection?.split(/^#{1,6} /m)[0]?.trim();
      if (summary?.includes('\n'))
        throw Error('Public summary must be one paragraph on one line: #' + number);
      if (!Number.isSafeInteger(number) || number < 1 || !title?.trim() || !summary)
        throw Error('Public roadmap issue needs a title and one-line Public summary: #' + number);
      return { number, title, summary, milestone: milestone?.number };
    })
    .sort((first, second) => first.number - second.number);
}
