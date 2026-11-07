import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, GripVertical } from 'lucide-react';

const defaultOrder = ['journey', 'details', 'activity'] as const;
type Card = (typeof defaultOrder)[number];
const labels = { journey: 'Lead journey', details: 'Details & qualification', activity: 'Lead activity' };
const storageKey = (viewer: string) => 'salesdrone.lead-card-order:' + viewer;

function readOrder(viewer: string): Card[] {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(viewer)) || 'null');
    if (Array.isArray(saved) && saved.length === defaultOrder.length &&
        defaultOrder.every((key) => saved.includes(key))) return saved;
  } catch { /* Storage may be unavailable. */ }
  return [...defaultOrder];
}

export default function LeadCardOrder({ viewer, cards }: { viewer: string; cards: Record<Card, ReactNode> }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [order, setOrder] = useState(() => readOrder(viewer));
  const [dragged, setDragged] = useState<Card | null>(null);
  const [target, setTarget] = useState<Card | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const before = useRef<Map<string, number> | null>(null);
  const active = useRef<Card | null>(null);
  const over = useRef<Card | null>(null);

  function move(card: Card, position: number) {
    if (position < 0 || position >= order.length || order.indexOf(card) === position) return;
    before.current = new Map(Array.from(root.current?.children || [], (node) =>
      [(node as HTMLElement).dataset.leadCard || '', node.getBoundingClientRect().top]));
    const next = order.filter((key) => key !== card);
    next.splice(position, 0, card);
    setOrder(next);
    setAnnouncement(labels[card] + ' moved to position ' + (position + 1) + ' of ' + next.length);
    try { localStorage.setItem(storageKey(viewer), JSON.stringify(next)); } catch { /* Keep the order for this visit. */ }
  }
  useLayoutEffect(() => {
    const previous = before.current;
    before.current = null;
    if (!previous || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const node of Array.from(root.current?.children || [])) {
      const top = previous.get((node as HTMLElement).dataset.leadCard || '');
      if (top === undefined) continue;
      const offset = top - node.getBoundingClientRect().top;
      if (offset) node.animate?.([{ transform: 'translateY(' + offset + 'px)' }, { transform: 'none' }],
        { duration: 260, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
    }
  }, [order]);
  function end(commit: boolean) {
    if (commit && active.current && over.current) move(active.current, order.indexOf(over.current));
    active.current = over.current = null;
    setDragged(null);
    setTarget(null);
  }
  return <>
    <div ref={root} className="lead-card-order">
      {order.map((card, index) => (
        <div key={card} data-lead-card={card} className="lead-order-card"
          data-dragging={dragged === card || undefined} data-drop-target={target === card && dragged !== card || undefined}>
          <header className="lead-card-heading">
            <h3>{card === 'details' ? (
              <button type="button" className="lead-card-disclosure" aria-expanded={detailsOpen}
                aria-controls="lead-qualification-content" onClick={() => setDetailsOpen(!detailsOpen)}>
                {labels[card]} <ChevronDown size={17} aria-hidden="true" />
              </button>
            ) : labels[card]}</h3>
          <div className="lead-card-controls" aria-label={labels[card] + ' arrangement'}>
            <button className="icon-button lead-card-grip" type="button" aria-label={'Drag ' + labels[card]}
              onPointerDown={(event) => {
                if (event.button !== 0 || active.current) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                active.current = card;
                setDragged(card);
              }}
              onPointerMove={(event) => {
                if (active.current !== card) return;
                const candidate = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-lead-card]');
                over.current = candidate && root.current?.contains(candidate) ? candidate.dataset.leadCard as Card : null;
                setTarget(over.current);
              }}
              onPointerUp={() => end(true)}
              onPointerCancel={() => end(false)}
              onLostPointerCapture={() => end(false)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') end(false);
                if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                event.preventDefault();
                move(card, index + (event.key === 'ArrowUp' ? -1 : 1));
              }}>
              <GripVertical size={18} aria-hidden="true" />
            </button>
            <button className="icon-button" type="button" disabled={index === 0}
              aria-label={'Move ' + labels[card] + ' up'} onClick={() => move(card, index - 1)}><ArrowUp size={16} /></button>
            <button className="icon-button" type="button" disabled={index === order.length - 1}
              aria-label={'Move ' + labels[card] + ' down'} onClick={() => move(card, index + 1)}><ArrowDown size={16} /></button>
          </div>
          </header>
          {card === 'details' ? (
            <div className="lead-qualification" id="lead-qualification-content" hidden={!detailsOpen}>
              {cards[card]}
            </div>
          ) : cards[card]}
        </div>
      ))}
    </div>
    <span className="sr-only" aria-live="polite">{announcement}</span>
  </>;
}
