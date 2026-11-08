import { readStored, writeStored } from './browser-storage';

const preferenceKey = 'salesdrone.usageAnalytics';
const preferenceChange = 'salesdrone:usage-analytics';
const productionOrigins = new Set([
  'https://salesdrone.in',
  'https://sales-drone-avinya.web.app',
  'https://sales-drone-avinya.firebaseapp.com',
]);
const pageTitles = {
  today: 'Today',
  leads: 'Leads',
  tasks: 'Tasks',
  notifications: 'Notifications',
  team: 'Team',
  hygiene: 'Lead Hygiene',
  assistant: 'Lead Assistant',
  imports: 'Import enquiries',
  settings: 'Settings',
} as const;

export function usageAnalyticsAvailable() {
  return import.meta.env.PROD && import.meta.env.VITE_USE_EMULATORS !== 'true' &&
    productionOrigins.has(window.location.origin);
}

export function usageAnalyticsEnabled() {
  return usageAnalyticsAvailable() && readStored('localStorage', preferenceKey) === 'on';
}

export function setUsageAnalytics(enabled: boolean) {
  if (!usageAnalyticsAvailable()) return;
  writeStored('localStorage', preferenceKey, enabled ? 'on' : 'off');
  window.dispatchEvent(new Event(preferenceChange));
}

export function subscribeToUsageAnalytics(listener: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key === preferenceKey || event.key === null) listener();
  };
  window.addEventListener('storage', sync);
  window.addEventListener(preferenceChange, listener);
  return () => {
    window.removeEventListener('storage', sync);
    window.removeEventListener(preferenceChange, listener);
  };
}

export function usagePage(page: string | null) {
  if (page === 'members') page = 'settings';
  if (!page || !Object.hasOwn(pageTitles, page)) return null;
  return { id: page, title: pageTitles[page as keyof typeof pageTitles] };
}
