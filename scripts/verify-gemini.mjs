// Operator verification: synthetic notes only. Credential stays in memory.
import { cloud } from './cloud-access.mjs';
import { geminiExtractor } from '../functions/src/gemini.js';
import { resolveExtraction } from '../functions/src/automatic-reminders.js';
const d = await cloud(
  'https://secretmanager.googleapis.com/v1/projects/sales-drone-avinya/secrets/GEMINI_API_KEY/versions/latest:access',
);
const extract = geminiExtractor({
  key: Buffer.from(d.payload.data, 'base64').toString(),
});
const referenceAt = new Date().toISOString();
const cases = [
  ['Call them next week.', 'Scheduled'],
  ['Call them in 10 minutes.', 'Scheduled'],
  ['Email the proposal tomorrow at 11 AM.', 'Scheduled'],
  ['Follow up later.', 'NeedsReview'],
  ['Already called yesterday.', 'NoAction'],
  ['Do not call them again.', 'NoAction'],
  ['Call them if they reply.', 'NeedsReview'],
];
for (const [notes, expected] of cases) {
  const input = { notes, referenceAt, timezone: 'Asia/Kolkata' };
  const result = resolveExtraction(await extract(input), {
    ...input,
    now: referenceAt,
  });
  if (result.status !== expected)
    throw Error(
      `Synthetic fixture failed: ${notes} expected ${expected}, got ${result.status}`,
    );
  console.log(
    JSON.stringify({
      fixture: notes,
      status: result.status,
      dueAt: result.dueAt,
    }),
  );
}
