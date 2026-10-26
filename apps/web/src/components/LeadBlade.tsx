import { layoutPixels, scaleFromCSS } from '../lib/display-scale';
import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { Maximize2 } from 'lucide-react';
import {
  BLADE_WIDTH_KEY,
  DEFAULT_BLADE_WIDTH,
  bladeBounds,
  clampBladeWidth,
  dragBladeWidth,
  keyboardBladeWidth,
} from '../lib/lead-blade';
function savedWidth() {
  try {
    const saved = localStorage.getItem(BLADE_WIDTH_KEY);
    return saved === null ? DEFAULT_BLADE_WIDTH : Number(saved);
  } catch {
    return DEFAULT_BLADE_WIDTH;
  }
}
export default function LeadBlade({
  toolbar,
  workflow,
  identity,
  children,
  fullPage = false,
  onExpand,
  onClose,
}: {
  fullPage?: boolean;
  onExpand: () => void;
  onClose: () => void;
  toolbar: ReactNode;
  workflow: ReactNode;
  identity: ReactNode;
  children: ReactNode;
}) {
  const root = useRef<HTMLElement>(null),
    widthRef = useRef(DEFAULT_BLADE_WIDTH),
    boundsRef = useRef(bladeBounds(1000));
  const [width, setWidth] = useState(savedWidth),
    [bounds, setBounds] = useState(boundsRef.current),
    [top, setTop] = useState(12),
    [resizing, setResizing] = useState(false);
  widthRef.current = width;
  const drag = useRef<{
      pointerId: number;
      startX: number;
      startWidth: number;
      lastX: number;
    } | null>(null),
    frame = useRef<number | undefined>(undefined);
  const scale = () =>
    scaleFromCSS(getComputedStyle(document.documentElement).zoom);
  function apply(value: number) {
    const next = clampBladeWidth(value, boundsRef.current);
    widthRef.current = next;
    setWidth(next);
    return next;
  }
  function persist(value: number) {
    try {
      localStorage.setItem(BLADE_WIDTH_KEY, String(value));
    } catch {}
  }
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  useLayoutEffect(() => {
    if (fullPage) return;
    const node = root.current,
      parent = node?.parentElement;
    if (!node || !parent) return;
    let measureFrame: number | undefined;
    const measure = () => {
      measureFrame = undefined;
      if (!window.matchMedia('(min-width: 1001px)').matches) return;
      const next = bladeBounds(
        layoutPixels(parent.getBoundingClientRect().width, scale()),
      );
      boundsRef.current = next;
      setBounds((old) =>
        old.min === next.min && old.max === next.max ? old : next,
      );
      setWidth((old) => {
        const w = clampBladeWidth(old, next);
        widthRef.current = w;
        return w;
      });
      setTop(
        Math.max(
          12,
          Math.min(
            layoutPixels(window.innerHeight, scale()) - 240,
            Math.round(layoutPixels(node.getBoundingClientRect().top, scale())),
          ),
        ),
      );
    };
    const queue = () => {
      if (measureFrame === undefined)
        measureFrame = requestAnimationFrame(measure);
    };
    let observedWidth = -1;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w !== undefined && w !== observedWidth) {
        observedWidth = w;
        queue();
      }
    });
    observer.observe(parent);
    window.addEventListener('resize', queue);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', queue);
      if (measureFrame !== undefined) cancelAnimationFrame(measureFrame);
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
      document.documentElement.classList.remove('resizing-lead-blade');
    };
  }, [fullPage]);
  function finish(event: PointerEvent<HTMLDivElement>, cancel = false) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (frame.current !== undefined) {
      cancelAnimationFrame(frame.current);
      frame.current = undefined;
    }
    const next = apply(
      cancel
        ? active.startWidth
        : dragBladeWidth(
            active.startWidth,
            active.startX,
            active.lastX,
            boundsRef.current,
          ),
    );
    drag.current = null;
    setResizing(false);
    document.documentElement.classList.remove('resizing-lead-blade');
    persist(next);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return (
    <aside
      ref={root}
      className={
        'lead-detail lead-blade' +
        (fullPage ? ' full-lead-page' : '') +
        (resizing ? ' is-resizing' : '')
      }
      aria-label="Lead details"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (
          e.key === 'Escape' &&
          !fullPage &&
          !(e.target instanceof HTMLSelectElement)
        ) {
          e.stopPropagation();
          onClose();
        }
      }}
      style={
        {
          '--blade-width': `${width}px`,
          '--blade-top': `${top}px`,
        } as CSSProperties
      }
    >
      <div
        className="blade-resizer"
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-label="Resize lead details"
        aria-controls="lead-details-content"
        aria-describedby="blade-resize-help"
        aria-valuemin={Math.round(bounds.min)}
        aria-valuemax={Math.round(bounds.max)}
        aria-valuenow={Math.round(width)}
        aria-valuetext={`${Math.round(width)} pixels`}
        title="Drag left to widen. Double-click to reset."
        onPointerDown={(e) => {
          if (e.button !== 0 || drag.current) return;
          e.preventDefault();
          for (const motion of root.current?.getAnimations?.() || [])
            motion.finish();
          e.currentTarget.focus({ preventScroll: true });
          drag.current = {
            pointerId: e.pointerId,
            startX: layoutPixels(e.clientX, scale()),
            startWidth: widthRef.current,
            lastX: layoutPixels(e.clientX, scale()),
          };
          e.currentTarget.setPointerCapture(e.pointerId);
          setResizing(true);
          document.documentElement.classList.add('resizing-lead-blade');
        }}
        onPointerMove={(e) => {
          const active = drag.current;
          if (!active || active.pointerId !== e.pointerId) return;
          active.lastX = layoutPixels(e.clientX, scale());
          if (frame.current === undefined)
            frame.current = requestAnimationFrame(() => {
              frame.current = undefined;
              const d = drag.current;
              if (d)
                apply(
                  dragBladeWidth(
                    d.startWidth,
                    d.startX,
                    d.lastX,
                    boundsRef.current,
                  ),
                );
            });
        }}
        onPointerUp={(e) => finish(e)}
        onPointerCancel={(e) => finish(e, true)}
        onLostPointerCapture={(e) => finish(e)}
        onDoubleClick={() => persist(apply(DEFAULT_BLADE_WIDTH))}
        onKeyDown={(e) => {
          if (drag.current) return;
          const next = keyboardBladeWidth(
            e.key,
            widthRef.current,
            boundsRef.current,
            e.shiftKey,
          );
          if (next !== null) {
            e.preventDefault();
            persist(apply(next));
          }
        }}
      >
        <span />
      </div>
      <span className="sr-only" id="blade-resize-help">
        Drag left to expand, right to shrink. Arrow Left widens, Arrow Right
        narrows. Home selects minimum width, End expands. Double-click resets
        the width.
      </span>
      <header className="blade-header">
        <div className="detail-top">
          {toolbar}
          {!fullPage ? (
            <button
              className="icon-button blade-expand"
              aria-label="Open full lead page"
              title="Open full lead page"
              onClick={onExpand}
            >
              <Maximize2 size={17} />
            </button>
          ) : null}
        </div>
        <div className="lead-overview">
          {identity}
          <div className="blade-workflow">{workflow}</div>
        </div>
      </header>
      <div
        className="blade-body"
        id="lead-details-content"
        tabIndex={0}
        aria-label="Lead detail content"
      >
        {children}
      </div>
    </aside>
  );
}
