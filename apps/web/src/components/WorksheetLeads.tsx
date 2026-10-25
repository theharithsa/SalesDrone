import { ScoreBadge } from './LeadScore';
import { Pencil } from 'lucide-react';
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
  onEdit,
  config = defaultFieldOptions,
  scores = {},
}: {
  scores?: Record<string, any>;
  leads: Lead[];
  selectedId: string | null;
  onSelect: (lead: Lead) => void;
  onEdit?: (lead: Lead) => void;
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
              {columns.map(([field, label]) => (
                <th key={field}>{label}</th>
              ))}
              {onEdit ? <th className="worksheet-actions">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                className={selectedId === lead.id ? 'selected' : ''}
                onClick={() => onSelect(lead)}
              >
                {columns.map(([field]) => (
                  <td key={field}>
                    {field === 'leadScore' ? (
                      <ScoreBadge score={scores[lead.id]} />
                    ) : field === 'name' ? (
                      <button
                        className="text-button"
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
                {onEdit ? (
                  <td className="worksheet-actions">
                    <button
                      className="text-button"
                      aria-label={'Edit ' + (lead.name || 'lead')}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(lead);
                      }}
                    >
                      <Pencil size={15} /> Edit
                    </button>
                  </td>
                ) : null}
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
            {onEdit ? (
              <button
                className="text-button worksheet-card-edit"
                aria-label={'Edit ' + (lead.name || 'lead')}
                onClick={() => onEdit(lead)}
              >
                <Pencil size={15} /> Edit lead
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </>
  );
}
