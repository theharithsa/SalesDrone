export const displayScales = [85, 90, 100, 110, 125] as const;
export type DisplayScale = (typeof displayScales)[number];
export function normalizeDisplayScale(value: unknown): DisplayScale {
  return displayScales.includes(value as DisplayScale)
    ? (value as DisplayScale)
    : 100;
}
export function scaleFromCSS(value: string) {
  const n = Number.parseFloat(value) / (value.endsWith('%') ? 100 : 1);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
export function layoutPixels(value: number, scale: number) {
  return value / (Number.isFinite(scale) && scale > 0 ? scale : 1);
}
