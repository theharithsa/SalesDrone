export type Entity = { id: string; [key: string]: any };
export type Lead = Entity & {
  name: string;
  company: string;
  phone: string;
  email: string;
  stage: string;
  version: number;
  source: string;
  enquiryDate: string;
  location: string;
  zone: string;
  comments: string;
  assignedToUid: string | null;
  createdAt: string;
  doNotContact: boolean;
  needsReview: boolean;
};
export type Task = Entity & {
  title: string;
  dueAt: string;
  timezone: string;
  state: string;
  version: number;
  leadId: string | null;
};
export type Session = {
  identity: { uid: string; email: string; name: string; photoURL?: string };
  mode: 'live' | 'demo';
  workspaceSettings?: {
    version: number;
    exportsEnabled: boolean;
    assignedOnly: boolean;
  };
  member: Entity | null;
  preferences: {
    timezone: string;
    appearance: 'light' | 'dark' | 'system';
    bookMode?: boolean;
    fontStyle?: 'standard' | 'inter' | 'source-sans' | 'lora';
    automaticReminders?: boolean;
    reminderTime?: string;
    nextWeekRule?: 'seven_days' | 'next_monday';
    moveWeekends?: boolean;
  };
  invitation?: { id: string; role: string; scope: string } | null;
};
export const stages = [
  'New',
  'Working',
  'Qualified',
  'Meeting booked',
  'Nurture',
  'Disqualified',
  'Won',
];
export const outcomes = [
  'Connected',
  'No answer',
  'Busy',
  'Voicemail',
  'Wrong number',
  'Failed',
];
export const dateOnly = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const displayDate = (v: string, tz?: string) =>
  !v
    ? 'Not recorded'
    : new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        ...(v.includes('T')
          ? { hour: 'numeric', minute: '2-digit', timeZone: tz }
          : {}),
      }).format(new Date(v.includes('T') ? v : v + 'T12:00:00'));
export const initials = (s: string) => {
  const words = s.trim().split(/\s+/).filter(Boolean);
  const chosen = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  const segmenter =
    typeof Intl.Segmenter === 'function'
      ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
      : null;
  return (
    chosen
      .map((word) =>
        segmenter
          ? segmenter.segment(word)[Symbol.iterator]().next().value?.segment ||
            ''
          : Array.from(word)[0] || '',
      )
      .join('')
      .toLocaleUpperCase() || '?'
  );
};
