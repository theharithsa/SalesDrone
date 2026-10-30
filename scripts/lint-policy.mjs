export function warningCounts(results, root) {
  const counts = {};
  for (const result of results)
    for (const message of result.messages) {
      if (message.severity !== 1) continue;
      const file = result.filePath.slice(root.length + 1).replaceAll("\\", "/");
      const key = file + "::" + message.ruleId;
      counts[key] = (counts[key] || 0) + 1;
    }
  return counts;
}
export function newWarnings(counts, baseline) {
  return Object.entries(counts)
    .filter(([key, count]) => count > (baseline[key] || 0))
    .map(([key, count]) => `${key}: ${count} > ${baseline[key] || 0}`);
}
