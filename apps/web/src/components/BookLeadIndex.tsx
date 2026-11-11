import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Lead } from '../lib/types';
import { Badge } from './UI';
import { ScoreBadge } from './LeadScore';

const leadsPerPage = 4;
const wheelPause = 180;
const swipeDistance = 48;

function atEdge(element: HTMLElement, direction: number) {
  return direction < 0
    ? element.scrollTop <= 1
    : element.scrollHeight - element.clientHeight - element.scrollTop <= 1;
}

export default function BookLeadIndex({
  leads, scores, showScores, hiddenFields, checkedIds, onToggle, onSelect,
  returnLeadId, onRestoreFocus,
}: {
  leads: Lead[];
  scores: Record<string, unknown>;
  showScores: boolean;
  hiddenFields: readonly string[];
  checkedIds?: Set<string>;
  onToggle?: (id: string) => void;
  onSelect: (lead: Lead) => void;
  returnLeadId?: string | null;
  onRestoreFocus?: () => void;
}) {
  const restoreIndex = returnLeadId ? leads.findIndex((lead) => lead.id === returnLeadId) : -1;
  const [page, setPage] = useState(() => ({
    index: Math.max(0, Math.floor(restoreIndex / leadsPerPage)),
    direction: 0,
  }));
  const pageCount = Math.max(1, Math.ceil(leads.length / leadsPerPage));
  const pageIndex = Math.min(page.index, pageCount - 1);
  const first = pageIndex * leadsPerPage;
  const entries = leads.slice(first, first + leadsPerPage);
  const sheet = useRef<HTMLElement>(null);
  const wheel = useRef({ last: -Infinity, distance: 0, turned: false });
  const touch = useRef<{ x: number; y: number; start: boolean; end: boolean } | null>(null);

  useLayoutEffect(() => {
    if (sheet.current) sheet.current.scrollTop = 0;
  }, [pageIndex]);

  useLayoutEffect(() => {
    if (!returnLeadId) return;
    const restorePage = Math.floor(restoreIndex / leadsPerPage);
    if (restorePage >= 0 && restorePage !== pageIndex) {
      setPage({ index: restorePage, direction: 0 });
      return;
    }
    const button = sheet.current?.querySelector<HTMLButtonElement>(
      `[data-book-lead="${CSS.escape(returnLeadId)}"]`,
    );
    button?.focus({ preventScroll: true });
    button?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    onRestoreFocus?.();
  }, [onRestoreFocus, pageIndex, restoreIndex, returnLeadId]);

  const turn = useCallback((direction: number) => {
    const next = pageIndex + direction;
    if (next < 0 || next >= pageCount) return false;
    const element = sheet.current;
    if (element?.contains(document.activeElement)) element.focus({ preventScroll: true });
    setPage({ index: next, direction });
    return true;
  }, [pageCount, pageIndex]);

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
      if (Math.abs(state.distance) >= 28) state.turned = turn(Math.sign(state.distance));
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
      if (direction && turn(direction)) event.preventDefault();
    }
    element.addEventListener('keydown', onKeyDown);
    element.addEventListener('wheel', onWheel, { passive: false });
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      element.removeEventListener('keydown', onKeyDown);
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('touchmove', onTouchMove);
    };
  }, [pageCount, pageIndex, turn]);


  return (
    <div className="book-index">
      <nav className="book-page-controls" aria-label="Lead index pages">
        <button type="button" className="button" aria-disabled={pageIndex === 0}
          onClick={() => turn(-1)}><ChevronLeft size={18} aria-hidden="true" /> Previous</button>
        <span className="book-page-number" role="status">Page {pageIndex + 1} of {pageCount}</span>
        <button type="button" className="button" aria-disabled={pageIndex === pageCount - 1}
          onClick={() => turn(1)}>Next <ChevronRight size={18} aria-hidden="true" /></button>
      </nav>
      <div className="book-page-stage">
        <section className="book-index-page" ref={sheet} tabIndex={-1}
          aria-label={`Lead index page ${pageIndex + 1}`}
          onTouchStart={(event) => {
            const point = event.touches[0];
            touch.current = event.touches.length === 1
              ? { x: point.clientX, y: point.clientY, start: atEdge(event.currentTarget, -1), end: atEdge(event.currentTarget, 1) }
              : null;
          }}
          onTouchCancel={() => { touch.current = null; }}
          onTouchEnd={(event) => {
            const start = touch.current;
            touch.current = null;
            const point = event.changedTouches[0];
            if (!start || !point || event.touches.length) return;
            const x = point.clientX - start.x;
            const y = point.clientY - start.y;
            if (Math.abs(x) >= swipeDistance && Math.abs(x) > Math.abs(y)) turn(-Math.sign(x));
            else if (y <= -swipeDistance && start.end) turn(1);
            else if (y >= swipeDistance && start.start) turn(-1);
          }}>
          <ol>
            {entries.map((lead) => {
              const showCompany = !hiddenFields.includes('company');
              const company = showCompany ? lead.company : '';
              const name = hiddenFields.includes('name') ? '' : lead.name;
              const title = name || company || 'Lead enquiry';
              const companyLabel = company || (showCompany && name ? 'Individual Customer' : '');
              const context = [
                companyLabel === title ? '' : companyLabel,
                hiddenFields.includes('location') ? '' : lead.location,
              ].filter(Boolean).join(' · ');
              return (
                <li key={lead.id} className="book-index-entry">
                  {checkedIds && <label className="lead-selection-control">
                    <input type="checkbox" checked={checkedIds.has(lead.id)}
                      aria-label={`Select ${title}`}
                      onChange={() => onToggle?.(lead.id)} />
                  </label>}
                  <button type="button" className="book-index-link" data-book-lead={lead.id} onClick={() => onSelect(lead)}>
                    <span className="book-index-identity">
                      <strong>{title}</strong>
                      {context && <span>{context}</span>}
                      {!hiddenFields.includes('phone') && lead.phone && <span className="phone-number">{lead.phone}</span>}
                    </span>
                    <span className="book-index-status">
                      {!hiddenFields.includes('stage') && <Badge stage={lead.stage} />}
                      {showScores && <ScoreBadge score={scores[lead.id]} />}
                    </span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
        {page.direction !== 0 && (
          <div key={pageIndex} className="book-page-flap"
            data-direction={page.direction > 0 ? 'next' : 'previous'} aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
