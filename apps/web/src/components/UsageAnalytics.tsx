import { useSyncExternalStore } from 'react';
import {
  setUsageAnalytics,
  subscribeToUsageAnalytics,
  usageAnalyticsAvailable,
  usageAnalyticsEnabled,
  usagePage,
} from '../lib/usage-analytics';

export function UsageAnalyticsFrame({ page }: { page: string }) {
  const enabled = useSyncExternalStore(subscribeToUsageAnalytics, usageAnalyticsEnabled);
  const view = usagePage(page);
  return enabled && view ? (
    <iframe
      key={view.id}
      hidden
      title="Usage analytics"
      referrerPolicy="no-referrer"
      src={`/usage-analytics.html?page=${view.id}`}
    />
  ) : null;
}

export function UsageAnalyticsPreference() {
  const enabled = useSyncExternalStore(subscribeToUsageAnalytics, usageAnalyticsEnabled);
  if (!usageAnalyticsAvailable()) return null;
  return (
    <section className="panel" aria-labelledby="usage-analytics-heading">
      <h3 id="usage-analytics-heading">Usage analytics</h3>
      <p id="usage-analytics-description">
        Share which workspace pages you use with Google Analytics. This choice applies
        to this browser. Lead details, account information and search terms are excluded.
      </p>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={enabled}
          aria-describedby="usage-analytics-description"
          onChange={(event) => setUsageAnalytics(event.currentTarget.checked)}
        />
        Allow usage analytics
      </label>
    </section>
  );
}
