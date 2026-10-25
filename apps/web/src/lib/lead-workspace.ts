import type { Entity } from './types';
export function leadPathId(path: string): string | null {
  const match = /^\/leads\/([^/]+)\/?$/.exec(path);
  if (!match) return null;
  try {
    const id = decodeURIComponent(match[1]);
    return id && !id.includes('/') ? id : null;
  } catch {
    return null;
  }
}
export function reviewActivities(items: Entity[]) {
  return items.filter((a) =>
    ['Pending', 'Failed', 'NeedsReview'].includes(a.autoReminder?.status),
  );
}
