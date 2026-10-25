export const DEFAULT_BLADE_WIDTH = 420;
export const BLADE_WIDTH_KEY = 'salesdrone.lead-blade-width';
export function bladeBounds(containerWidth: number) {
  const available = Number.isFinite(containerWidth)
    ? Math.max(0, containerWidth)
    : 0;
  const max = Math.min(
    1100,
    Math.max(0, available - Math.min(300, available * 0.4)),
  );
  return { min: Math.min(360, max), max };
}
export function clampBladeWidth(
  width: number,
  bounds: { min: number; max: number },
) {
  return Math.round(
    Math.max(
      bounds.min,
      Math.min(
        bounds.max,
        Number.isFinite(width) ? width : DEFAULT_BLADE_WIDTH,
      ),
    ),
  );
}
export function dragBladeWidth(
  startWidth: number,
  startX: number,
  currentX: number,
  bounds: { min: number; max: number },
) {
  return clampBladeWidth(startWidth + startX - currentX, bounds);
}
export function keyboardBladeWidth(
  key: string,
  width: number,
  bounds: { min: number; max: number },
  shift = false,
) {
  const step = shift ? 48 : 24;
  return key === 'ArrowLeft'
    ? clampBladeWidth(width + step, bounds)
    : key === 'ArrowRight'
      ? clampBladeWidth(width - step, bounds)
      : key === 'Home'
        ? bounds.min
        : key === 'End'
          ? bounds.max
          : null;
}
