type StorageKind = 'localStorage' | 'sessionStorage';
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const resolveStore = (kind: StorageKind) => () => globalThis[kind];
export function readStored(
  kind: StorageKind,
  key: string,
  resolve: () => Store = resolveStore(kind),
): string | null {
  try {
    return resolve().getItem(key);
  } catch {
    return null;
  }
}
export function writeStored(
  kind: StorageKind,
  key: string,
  value: string,
  resolve: () => Store = resolveStore(kind),
): boolean {
  try {
    resolve().setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
export function removeStored(
  kind: StorageKind,
  key: string,
  resolve: () => Store = resolveStore(kind),
): boolean {
  try {
    resolve().removeItem(key);
    return true;
  } catch {
    return false;
  }
}
