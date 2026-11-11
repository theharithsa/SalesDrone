import { useEffect, useRef, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Lead } from '../lib/types';
import { Badge } from './UI';
import { ScoreBadge } from './LeadScore';

const leadsPerPage = 8;

function IndexPage({ number, children }: { number: number; children: ReactNode }) {
  const page = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = page.current;
    if (!element || number === 1 || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      element.dataset.turned = 'true';
      observer.disconnect();
    }, { threshold: 0.2 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [number]);
  return (
    <section className="book-index-page" ref={page} aria-label={`Lead index page ${number}`}>
      <ol>{children}</ol>
      <p className="book-page-number" aria-hidden="true">{number}</p>
    </section>
  );
}

export default function BookLeadIndex({ leads, scores, showScores, hiddenFields, checkedIds, onToggle, onSelect }: {
  leads: Lead[];
  scores: Record<string, unknown>;
  showScores: boolean;
  hiddenFields: readonly string[];
  checkedIds?: Set<string>;
  onToggle?: (id: string) => void;
  onSelect: (lead: Lead) => void;
}) {
  const pages = Array.from({ length: Math.ceil(leads.length / leadsPerPage) }, (_, index) =>
    leads.slice(index * leadsPerPage, (index + 1) * leadsPerPage),
  );
  return <div className="book-index">
    {pages.map((page, index) => (
      <IndexPage key={index} number={index + 1}>
        {page.map((lead) => {
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
      </IndexPage>
    ))}
  </div>;
}
