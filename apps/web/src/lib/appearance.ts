import { normalizeDisplayScale } from './display-scale.ts';
import { normalizeFontStyle } from './fonts.ts';
import type { Session } from './types';
type VisualPreferences = Pick<
  Session['preferences'],
  'appearance' | 'bookMode' | 'fontStyle' | 'displayScale'
>;
/** Live identity preferences win; demo/unapproved identities use the guest style. */
export function resolveVisualPreferences(
  preferences: VisualPreferences | null,
  demo: boolean,
  guest: VisualPreferences,
) {
  const selected = !demo && preferences ? preferences : guest;
  return {
    appearance: selected.appearance,
    bookMode: selected.bookMode === true,
    fontStyle: normalizeFontStyle(selected.fontStyle),
    displayScale: normalizeDisplayScale(selected.displayScale),
  };
}
