import { useCallback, useContext, useLayoutEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Lead } from '../lib/types';
import { Badge } from './UI';
import BookPageControls from './BookPageControls';
import { ScoreBadge } from './LeadScore';
import { BookPageTurn } from '../lib/use-book-turn';
import { useBookSheet } from '../lib/use-book-sheet';

const leadsPerPage = 4;
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
  const [index, setIndex] = useState(() => Math.max(0, Math.floor(restoreIndex / leadsPerPage)));
  const turnPage = useContext(BookPageTurn);
  const pageCount = Math.max(1, Math.ceil(leads.length / leadsPerPage));
  const pageIndex = Math.min(index, pageCount - 1);
  const first = pageIndex * leadsPerPage;
  const entries = leads.slice(first, first + leadsPerPage);
  const turn = useCallback((direction: number) => {
    const next = pageIndex + direction;
    if (next < 0 || next >= pageCount) return false;
    turnPage(direction);
    setIndex(next);
    return true;
  }, [pageCount, pageIndex, turnPage]);
  const { sheet, gestures } = useBookSheet(pageIndex, pageCount, turn);

  useLayoutEffect(() => {
    if (!returnLeadId) return;
    const restorePage = Math.floor(restoreIndex / leadsPerPage);
    if (restorePage >= 0 && restorePage !== pageIndex) {
      setIndex(restorePage);
      return;
    }
    const button = sheet.current?.querySelector<HTMLButtonElement>(
      `[data-book-lead="${CSS.escape(returnLeadId)}"]`,
    );
    button?.focus({ preventScroll: true });
    button?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    onRestoreFocus?.();
  }, [onRestoreFocus, pageIndex, restoreIndex, returnLeadId, sheet]);

  function renderEntries(rows: Lead[]) {
    return (
      <ol>
        {rows.map((lead) => {
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
              <button type="button" className="book-index-link" data-book-lead={lead.id}
                onClick={() => onSelect(lead)}>
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
    );
  }

  return (
    <div className="book-index">
      <BookPageControls index={pageIndex} count={pageCount} label="Lead index pages" onTurn={turn} />
      <div className="book-page-stage">
        <section className="book-index-page" ref={sheet} tabIndex={-1}
          aria-label={`Lead index page ${pageIndex + 1}`} {...gestures}>
          {renderEntries(entries)}
        </section>
      </div>
    </div>
  );
}
