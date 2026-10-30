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
