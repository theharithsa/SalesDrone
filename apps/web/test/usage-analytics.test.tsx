// @vitest-environment-options {"url":"https://salesdrone.in/leads/synthetic?search=private"}
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  UsageAnalyticsFrame,
  UsageAnalyticsPreference,
} from '../src/components/UsageAnalytics';

beforeEach(() => {
  vi.stubEnv('PROD', true);
  localStorage.clear();
});

afterEach(() => vi.unstubAllEnvs());

it('loads the analytics frame only after opt-in and removes it on revocation', async () => {
  const user = userEvent.setup();
  render(<><UsageAnalyticsFrame page="leads" /><UsageAnalyticsPreference /></>);
  const consent = screen.getByRole('checkbox', { name: 'Allow usage analytics' });
  expect(consent).not.toBeChecked();
  expect(screen.queryByTitle('Usage analytics')).toBeNull();

  await user.click(consent);
  expect(consent).toBeChecked();
  expect(screen.getByTitle('Usage analytics')).toHaveAttribute('src', '/usage-analytics.html?page=leads');
  expect(screen.getByTitle('Usage analytics')).toHaveAttribute('referrerpolicy', 'no-referrer');

  await user.click(consent);
  expect(consent).not.toBeChecked();
  expect(screen.queryByTitle('Usage analytics')).toBeNull();
});

it('drops unknown page values and observes a revocation from another tab', async () => {
  localStorage.setItem('salesdrone.usageAnalytics', 'on');
  const { rerender } = render(<UsageAnalyticsFrame page="leads/synthetic" />);
  expect(screen.queryByTitle('Usage analytics')).toBeNull();
  rerender(<UsageAnalyticsFrame page="members" />);
  expect(screen.getByTitle('Usage analytics')).toHaveAttribute('src', '/usage-analytics.html?page=settings');

  act(() => {
    localStorage.clear();
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
  });
  expect(screen.queryByTitle('Usage analytics')).toBeNull();
});

it('suppresses the production tag and control in an emulator build', () => {
  vi.stubEnv('VITE_USE_EMULATORS', 'true');
  localStorage.setItem('salesdrone.usageAnalytics', 'on');
  render(<><UsageAnalyticsFrame page="today" /><UsageAnalyticsPreference /></>);
  expect(screen.queryByTitle('Usage analytics')).toBeNull();
  expect(screen.queryByRole('checkbox')).toBeNull();
});
