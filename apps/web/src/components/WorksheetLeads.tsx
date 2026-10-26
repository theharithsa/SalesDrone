import { ScoreBadge } from './LeadScore';
import { Lead, displayDate } from '../lib/types';
import {
  defaultFieldOptions,
  FieldOptions,
  labelFor,
} from '../lib/field-options';
import { worksheetColumns } from '../lib/lead-fields';
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
  const columns: (readonly [string, string])[] = [
    ...worksheetColumns
      .filter(([key]) => !config.hiddenFields.includes(key))
      .map(([key, label]) => [key, labelFor(config, key, label)] as const),
    ...config.customFields
      .filter((f) => !f.deleted)
      .map((f) => [f.id, f.label] as const),
  ];
  columns.splice(columns.findIndex(([key]) => key === 'name') + 1, 0, [
    'leadScore',
    'Lead score',
  ]);
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
      <div className="worksheet-leads-scroll">
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
                tabIndex={config.hiddenFields.includes('name') ? 0 : undefined}
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
                    ) : field === 'name' ? (
                      <button
                        className="text-button worksheet-name-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(lead);
                        }}
                      >
                        {lead.name || 'Name not recorded'}
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
