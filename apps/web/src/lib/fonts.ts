export const interfaceFonts = [
  {
    id: 'standard',
    label: 'Standard',
    description: 'Google Sans headings and Manrope text',
    family: "'Manrope Variable', Arial, sans-serif",
  },
  {
    id: 'inter',
    label: 'Inter',
    description: 'Clear, compact interface lettering',
    family: "'Inter Variable', Arial, sans-serif",
  },
  {
    id: 'source-sans',
    label: 'Source Sans 3',
    description: 'Open, humanist shapes for everyday reading',
    family: "'Source Sans 3 Variable', Arial, sans-serif",
  },
  {
    id: 'lora',
    label: 'Lora',
    description: 'An editorial serif style',
    family: "'Lora Variable', Georgia, serif",
  },
] as const;
export type FontStyle = (typeof interfaceFonts)[number]['id'];
export function normalizeFontStyle(value: unknown): FontStyle {
  return interfaceFonts.some((font) => font.id === value)
    ? (value as FontStyle)
    : 'standard';
}
