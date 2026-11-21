export function matchStage(value, stages) {
  if (typeof value !== 'string') return undefined;
  const clean = s => s.trim().replace(/\s+/g, ' ').toLowerCase();
  if (stages.includes(value.trim())) return value.trim();
  const matches = stages.filter(stage => clean(stage) === clean(value));
  return matches.length === 1 ? matches[0] : undefined;
}
