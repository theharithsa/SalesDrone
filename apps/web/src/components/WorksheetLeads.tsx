import { Badge } from './UI';
import { ScoreBadge } from './LeadScore';
import { Lead, displayDate } from '../lib/types';
import {
  defaultFieldOptions,
  FieldOptions,
  labelFor,
} from '../lib/field-options';
import { leadTableColumns } from '../lib/lead-table';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
export default function WorksheetLeads({
  leads,
  selectedId,
  onSelect,
  config = defaultFieldOptions,
  scores = {},
  checkedIds,
  onToggle,
}: {
  checkedIds?: Set<string>;
  onToggle?: (id: string) => void;
  scores?: Record<string, any>;
  leads: Lead[];
  selectedId: string | null;
  onSelect: (lead: Lead) => void;
  config?: FieldOptions;
}) {
  const columns = leadTableColumns(config);
  const scroller = useRef<HTMLDivElement>(null);
  const [horizontal, setHorizontal] = useState({ max: 0, position: 0 });
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const measure = () =>
      setHorizontal({
        max: Math.max(0, element.scrollWidth - element.clientWidth),
        position: element.scrollLeft,
      });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    element.addEventListener('scroll', measure, { passive: true });
    measure();
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', measure);
    };
  }, []);
  const value = (lead: Lead, field: string) =>
    field === 'enquiryDate'
      ? displayDate(lead.enquiryDate)
      : field === 'phone'
        ? lead.phone || lead.originalPhone || '—'
        : field.startsWith('cf_')
          ? typeof lead.customFields?.[field] === 'boolean'
            ? lead.customFields[field]
              ? 'Yes'
              : 'No'
            : String(lead.customFields?.[field] ?? '—')
          : String(lead[field] || '—');
  return (
    <>
      <div className="worksheet-desktop">
        {horizontal.max > 1 && (
          <div className="worksheet-scroll-controls">
            <span>More columns</span>
            <button
              type="button"
              className="icon-button"
              aria-label="Scroll lead columns left"
              disabled={horizontal.position <= 1}
              onClick={() =>
                scroller.current?.scrollBy({
                  left: -scroller.current.clientWidth * 0.75,
                })
              }
            >
              <ChevronLeft size={18} />
            </button>
            <input
              type="range"
              min={0}
              max={horizontal.max}
              step={1}
              value={Math.min(horizontal.max, Math.max(0, horizontal.position))}
              aria-label="Scroll lead columns"
              aria-valuetext={
                horizontal.position <= 1
                  ? 'First columns'
                  : horizontal.position >= horizontal.max - 1
                    ? 'Last columns'
                    : 'Middle columns'
              }
              onChange={(event) => {
                if (scroller.current)
                  scroller.current.scrollLeft = Number(event.target.value);
              }}
            />
            <button
              type="button"
              className="icon-button"
              aria-label="Scroll lead columns right"
              disabled={horizontal.position >= horizontal.max - 1}
              onClick={() =>
                scroller.current?.scrollBy({
                  left: scroller.current.clientWidth * 0.75,
                })
              }
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
        <div
          className="worksheet-leads-scroll"
          ref={scroller}
          tabIndex={0}
          role="region"
          aria-label="Lead table, scroll horizontally for more columns"
        >
          <table className="worksheet-leads-table">
            <thead>
              <tr>
                {checkedIds && (
                  <th className="lead-select-cell">
                    <span className="sr-only">Select lead</span>
                  </th>
                )}
                {columns.map(([field, label]) => (
                  <th key={field} data-field={field}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className={selectedId === lead.id ? 'selected' : ''}
                  onClick={() => onSelect(lead)}
                  tabIndex={
                    config.hiddenFields.includes('name') ? 0 : undefined
                  }
                  aria-label={
                    config.hiddenFields.includes('name')
                      ? 'Open lead details'
                      : undefined
                  }
                  onKeyDown={(event) => {
                    if (
                      event.target === event.currentTarget &&
                      (event.key === 'Enter' || event.key === ' ')
                    ) {
                      event.preventDefault();
                      onSelect(lead);
                    }
                  }}
                >
                  {checkedIds && (
                    <td
                      className="lead-select-cell"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label className="lead-selection-control">
                        <input
                          type="checkbox"
                          aria-label={'Select ' + (lead.name || 'unnamed lead')}
                          checked={checkedIds.has(lead.id)}
                          onChange={() => onToggle?.(lead.id)}
                        />
                      </label>
                    </td>
                  )}
                  {columns.map(([field]) => (
                    <td key={field} data-field={field}>
                      {field === 'leadScore' ? (
                        <ScoreBadge score={scores[lead.id]} />
                      ) : field === 'stage' ? (
                        <Badge stage={lead.stage} />
                      ) : field === 'name' ? (
                        <button
                          className="text-button worksheet-name-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(lead);
                          }}
                        >
                          <span>{lead.name || 'Name not recorded'}</span>
                          {!config.hiddenFields.includes('company') &&
                          lead.company ? (
                            <small className="worksheet-company">
                              {lead.company}
                            </small>
                          ) : null}
                        </button>
                      ) : (
                        <span
                          className={
                            'worksheet-cell ' +
                            (field === 'phone' ? 'phone-number' : '')
                          }
                          title={value(lead, field)}
                        >
                          {value(lead, field)}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="worksheet-lead-cards">
        {leads.map((lead) => (
          <article
            key={lead.id}
            className={
              'worksheet-lead-card ' +
              (selectedId === lead.id ? 'selected' : '')
            }
          >
            {checkedIds && (
              <label className="mobile-lead-select">
                <input
                  type="checkbox"
                  aria-label={'Select ' + (lead.name || 'lead')}
                  checked={checkedIds.has(lead.id)}
                  onChange={() => onToggle?.(lead.id)}
                />
                <span className="sr-only">Select lead</span>
              </label>
            )}
            <button
              className="worksheet-card-open"
              aria-label={'Open ' + (lead.name || 'lead')}
              onClick={() => onSelect(lead)}
            >
              <strong>{lead.name || 'Name not recorded'}</strong>
              <ScoreBadge score={scores[lead.id]} />
              <span>{lead.company || 'Company not recorded'}</span>
              <span>
                {[lead.location, lead.zone].filter(Boolean).join(' · ') ||
                  'City / sector not recorded'}
              </span>
              <small>
                <span className="phone-number">{value(lead, 'phone')}</span> ·{' '}
                {lead.legacyStatus || lead.stage}
              </small>
            </button>
          </article>
        ))}
      </div>
    </>
  );
}
