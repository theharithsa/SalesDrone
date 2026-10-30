export function pendingTtlPolicies(expected, actual) {
  const active = new Set(
    actual
      .filter((f) => f.ttlConfig?.state === 'ACTIVE')
      .map((f) => f.name?.split('/collectionGroups/')[1]),
  );
  return expected.filter(
    (f) => f.ttl && !active.has(`${f.collectionGroup}/fields/${f.fieldPath}`),
  );
}

export function indexKey(index) {
  return JSON.stringify([
    index.collectionGroup ||
      index.name?.split('/collectionGroups/')[1]?.split('/')[0],
    index.queryScope,
    index.fields
      .filter((f) => f.fieldPath !== '__name__')
      .map((f) => [f.fieldPath, f.order || f.arrayConfig]),
  ]);
}
