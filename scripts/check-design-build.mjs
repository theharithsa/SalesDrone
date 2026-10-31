import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
const root = 'apps/web/dist';
async function files(dir) {
  return (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true })).map((e) =>
        e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
      ),
    )
  ).flat();
}
for (const file of await files(root)) {
  if (/design-(admin|review)\.html$|AdminReview|ImportReviewFixture|ResearchFixture|LeadAssistantPrototype/.test(file))
    throw Error('Development review entry leaked into application build');
  if (
    file.endsWith('.js') &&
    /Fictional admin workspace|Fictional review preview|Synthetic adapter for real research components/.test(await readFile(file, 'utf8'))
  )
    throw Error('Admin design fixture leaked into application bundle');
}
console.log(
  'Local bundle excludes design entries and fictional admin fixtures. This is not deployment verification.',
);
