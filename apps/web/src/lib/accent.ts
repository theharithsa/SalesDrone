export const accentPalettes = [
  { id: 'blue', label: 'Ocean', colors: ['#005ca9', '#d5e4ff', '#006b5f'] },
  { id: 'teal', label: 'Forest', colors: ['#146754', '#a9f2d7', '#3f6374'] },
  { id: 'plum', label: 'Plum', colors: ['#684fa1', '#eaddff', '#82526b'] },
  { id: 'clay', label: 'Terracotta', colors: ['#8b432d', '#ffdbcf', '#775a2d'] },
  { id: 'monochrome', label: 'Black & white', colors: ['#212121', '#e2e2e2', '#ffffff'] },
] as const;

export type AccentPalette = (typeof accentPalettes)[number]['id'];

export function normalizeAccent(value: unknown): AccentPalette {
  return accentPalettes.find((palette) => palette.id === value)?.id ?? 'blue';
}
