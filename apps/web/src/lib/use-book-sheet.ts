import { useCallback, useEffect, useLayoutEffect, useRef, type TouchEvent as ReactTouchEvent } from 'react';

const wheelPause = 180;
const swipeDistance = 48;

function atEdge(element: HTMLElement, direction: number) {
  return direction < 0
    ? element.scrollTop <= 1
    : element.scrollHeight - element.clientHeight - element.scrollTop <= 1;
}

export function useBookSheet(pageIndex: number, pageCount: number, turn: (direction: number) => boolean) {
  const sheet = useRef<HTMLElement>(null);
  const wheel = useRef({ last: -Infinity, distance: 0, turned: false });
  const touch = useRef<{ x: number; y: number; start: boolean; end: boolean } | null>(null);

  useLayoutEffect(() => {
    if (sheet.current) sheet.current.scrollTop = 0;
  }, [pageIndex]);

  const turnFromSheet = useCallback((element: HTMLElement, direction: number) => {
    const moved = turn(direction);
    if (moved && element.contains(document.activeElement)) element.focus({ preventScroll: true });
    return moved;
  }, [turn]);

  useEffect(() => {
    const element = sheet.current;
    if (!element) return;
    function onWheel(event: WheelEvent) {
      if (!element || event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const direction = Math.sign(event.deltaY);
      if (!direction) return;
      const state = wheel.current;
      if (event.timeStamp - state.last > wheelPause) {
        state.distance = 0;
        state.turned = false;
      }
      state.last = event.timeStamp;
      if (state.turned) {
        event.preventDefault();
        return;
      }
      if (!atEdge(element, direction)) {
        state.distance = 0;
        return;
      }
      if ((direction < 0 && pageIndex === 0) || (direction > 0 && pageIndex === pageCount - 1)) return;
      event.preventDefault();
      state.distance += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
      if (Math.abs(state.distance) >= 28) {
        state.turned = turnFromSheet(element, Math.sign(state.distance));
      }
    }
    function onTouchMove(event: TouchEvent) {
      const start = touch.current;
      if (!start || !event.cancelable || event.touches.length !== 1) return;
      const point = event.touches[0];
      const x = point.clientX - start.x;
      const y = point.clientY - start.y;
      if (Math.abs(y) <= Math.abs(x)) return;
      const canTurn = y < 0 ? start.end && pageIndex < pageCount - 1 : start.start && pageIndex > 0;
      if (canTurn) event.preventDefault();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
          (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]'))) return;
      const direction = { ArrowLeft: -1, ArrowRight: 1, PageUp: -1, PageDown: 1 }[event.key];
      if (!element || !direction || !turnFromSheet(element, direction)) return;
      event.preventDefault();
    }
    element.addEventListener('keydown', onKeyDown);
    element.addEventListener('wheel', onWheel, { passive: false });
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      element.removeEventListener('keydown', onKeyDown);
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('touchmove', onTouchMove);
    };
  }, [pageCount, pageIndex, turnFromSheet]);

  const gestures = {
    onTouchStart(event: ReactTouchEvent<HTMLElement>) {
      const point = event.touches[0];
      touch.current = event.touches.length === 1
        ? { x: point.clientX, y: point.clientY, start: atEdge(event.currentTarget, -1), end: atEdge(event.currentTarget, 1) }
        : null;
    },
    onTouchCancel() { touch.current = null; },
    onTouchEnd(event: ReactTouchEvent<HTMLElement>) {
      const start = touch.current;
      touch.current = null;
      const point = event.changedTouches[0];
      if (!start || !point || event.touches.length) return;
      const x = point.clientX - start.x;
      const y = point.clientY - start.y;
      if (Math.abs(x) >= swipeDistance && Math.abs(x) > Math.abs(y)) turnFromSheet(event.currentTarget, -Math.sign(x));
      else if (y <= -swipeDistance && start.end) turnFromSheet(event.currentTarget, 1);
      else if (y >= swipeDistance && start.start) turnFromSheet(event.currentTarget, -1);
    },
  };
  return { sheet, gestures };
}
