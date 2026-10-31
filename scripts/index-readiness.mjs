export function pendingTtlPolicies(expected, actual) {
  const active = new Set(
    actual
      .filter((f) => f.ttlConfig?.state === "ACTIVE")
      .map((f) => f.name?.split("/collectionGroups/")[1]),
  );
  return expected.filter(
    (f) => f.ttl && !active.has(`${f.collectionGroup}/fields/${f.fieldPath}`),
  );
}

export function assertUniqueIndexes(indexes) {
  const canonical = (value) =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, canonical(value[key])]),
          )
        : value;
  const seen = new Set();
  for (const index of indexes) {
    const key = JSON.stringify(canonical(index));
    if (seen.has(key))
      throw Error(
        "Duplicate Firestore index declaration: " + index.collectionGroup,
      );
    seen.add(key);
  }
  return indexes.length;
}
