/** Preserve order, update overlapping IDs, and never render a lead twice. */
export function appendUniqueRows<T extends { id: string }>(
  loaded: T[],
  incoming: T[],
): T[] {
  return [
    ...new Map([...loaded, ...incoming].map((row) => [row.id, row])).values(),
  ];
}
/** Appending a page keeps selection; changing/removing a selected record clears it. */
export function retainLeadSelection(
  selected: Set<string>,
  before: Map<string, number>,
  rows: { id: string; version: number }[],
): Set<string> {
  return new Set(
    rows
      .filter(
        (row) => selected.has(row.id) && before.get(row.id) === row.version,
      )
      .map((row) => row.id),
  );
}
