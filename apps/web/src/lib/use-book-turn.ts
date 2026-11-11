import { useEffect, useRef } from 'react';

export function useBookTurn(enabled: boolean, page: string, recordId: string | null) {
  const surface = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = surface.current;
    if (!enabled || !element?.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const turn = element.animate(
      [
        { transform: 'perspective(1000px) rotateY(-2.5deg) translateX(5px)', opacity: 0.8 },
        { transform: 'perspective(1000px) rotateY(0) translateX(0)', opacity: 1 },
      ],
      { duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
    );
    return () => turn.cancel();
  }, [enabled, page, recordId]);
  return surface;
}
