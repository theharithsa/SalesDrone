/** Retain the exact write on uncertain retries; never reuse a key for edited text. */
export function commentAttempt(
  previous: { notes: string; expectedVersion: number; key: string } | null,
  notes: string,
  version: number,
  makeKey = () => crypto.randomUUID(),
) {
  const text = notes.trim();
  if (!text) throw Error('Write a comment before posting.');
  if (text.length > 4000)
    throw Error('Comments must be 4,000 characters or fewer.');
  return previous?.notes === text
    ? previous
    : { notes: text, expectedVersion: version, key: makeKey() };
}
