export function scoreDisplay(value: unknown) {
  const score =
    typeof value === 'number' && Number.isFinite(value)
      ? Math.max(0, Math.min(100, Math.round(value)))
      : null;
  return {
    score,
    label: score === null ? 'Unscored' : `${score} out of 100`,
    progress: score ?? 0,
  };
}
