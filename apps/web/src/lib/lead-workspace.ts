import type { Entity, Task } from './types';
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
export const defaultLeadTab: LeadWorkspaceTab = 'all';

export type LeadTimelineEntry =
  | { kind: 'activity'; id: string; date: string | null; activity: Entity }
  | { kind: 'task' | 'reminder'; id: string; date: string | null; task: Task };

function recordedDate(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}

/** Order the loaded records only. An import timestamp is not a conversation date. */
export function buildLeadTimeline(activities: Entity[], tasks: Task[], chronological = true): LeadTimelineEntry[] {
  const entries: LeadTimelineEntry[] = [
    ...activities.map((activity) => ({
      kind: 'activity' as const,
      id: 'activity:' + activity.id,
      date: activity.imported ? null : recordedDate(activity.createdAt),
      activity,
    })),
    ...tasks.map((task) => ({
      kind: task.kind === 'outreach' ? 'reminder' as const : 'task' as const,
      id: 'task:' + task.id,
      date: recordedDate(task.createdAt),
      task,
    })),
  ];
  const time = (entry: LeadTimelineEntry) => entry.date ? Date.parse(entry.date) : Number.MIN_SAFE_INTEGER;
  return chronological ? entries.sort((a, b) => time(b) - time(a)) : entries;
}
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

/** Preserve the requested tab when the page reloads the same lead. */
export function tabAfterLeadLoad(
  tab: LeadWorkspaceTab,
  selectedId: string | undefined,
  loadedId: string,
): LeadWorkspaceTab {
  return selectedId === loadedId ? tab : defaultLeadTab;
}
