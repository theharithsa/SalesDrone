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

export const leadWorkspaceTabs = [
  'all',
  'comments',
  'calls',
  'tasks',
  'files',
  'review',
] as const;
export type LeadWorkspaceTab = (typeof leadWorkspaceTabs)[number];
/** Filter only the authorized loaded page(s); never imply unrequested history is complete. */
export function filterLeadActivities(
  items: Entity[],
  tab: LeadWorkspaceTab,
): Entity[] {
  if (tab === 'comments') return items.filter((a) => a.type === 'note');
  if (tab === 'calls') return items.filter((a) => a.type === 'call');
  if (tab === 'review') return reviewActivities(items);
  if (tab === 'tasks' || tab === 'files') return [];
  return items;
}

/** Preserve the requested tab when an inspector expands or reloads the same lead. */
export function tabAfterLeadLoad(
  tab: LeadWorkspaceTab,
  selectedId: string | undefined,
  loadedId: string,
): LeadWorkspaceTab {
  return selectedId === loadedId ? tab : 'all';
}
