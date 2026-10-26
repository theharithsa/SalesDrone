import {
  defaultFieldOptions,
  FieldOptions,
  labelFor,
} from '../lib/field-options';
import { useState } from 'react';
import { Filter, Plus, X } from 'lucide-react';
import { ColumnFilter, filterColumns } from '../lib/lead-fields';

/** Controlled conditions shared by the desktop disclosure and mobile dialog. */
export function ColumnFilterFields({
  config = defaultFieldOptions,
  value,
  onChange,
}: {
  config?: FieldOptions;
  value: ColumnFilter[];
  onChange: (filters: ColumnFilter[]) => void;
}) {
  const columns = [
    ...filterColumns
      .filter(([key]) => !config.hiddenFields.includes(key))
      .map(([key, label]) => [key, labelFor(config, key, label)] as const),
    ...config.customFields
      .filter((f) => !f.deleted)
      .map((f) => [f.id, f.label]),
  ];
  const change = (i: number, patch: Partial<ColumnFilter>) =>
    onChange(value.map((f, n) => (n === i ? { ...f, ...patch } : f)));
  return (
    <>
      <p className="field-hint">
        Match all conditions across the full permitted lead list, not just the
        loaded page.
      </p>
      {value.map((f, i) => (
        <div className="lead-filter-row" key={i}>
          <select
            aria-label={`Filter ${i + 1} column`}
            value={f.field}
            onChange={(e) =>
              change(i, { field: e.target.value, op: 'contains', value: '' })
            }
          >
            {columns.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label={`Filter ${i + 1} comparison`}
            value={f.op}
            onChange={(e) => change(i, { op: e.target.value })}
          >
            <option value="contains">Contains</option>
            <option value="equals">Equals</option>
            <option value="startsWith">Starts with</option>
            <option value="empty">Is empty</option>
            <option value="notEmpty">Is not empty</option>
            {['enquiryDate', 'lastContactAt'].includes(f.field) ||
            config.customFields.some(
              (v) => v.id === f.field && v.type === 'date',
            ) ? (
              <>
                <option value="before">Before</option>
                <option value="after">After</option>
              </>
            ) : null}
          </select>
          {!['empty', 'notEmpty'].includes(f.op) ? (
            <input
              aria-label={`Filter ${i + 1} value`}
              required
              maxLength={400}
              type={['before', 'after'].includes(f.op) ? 'date' : 'text'}
              placeholder={
                ['doNotContact', 'needsReview'].includes(f.field)
                  ? 'true or false'
                  : 'Value'
              }
              value={f.value}
              onChange={(e) => change(i, { value: e.target.value })}
            />
          ) : (
            <span />
          )}
          <button
            className="icon-button"
            type="button"
            aria-label={`Remove filter ${i + 1}`}
            onClick={() => onChange(value.filter((_, n) => n !== i))}
          >
            <X size={16} />
          </button>
        </div>
      ))}
      <button
        className="text-button"
        type="button"
        disabled={value.length >= 16}
        onClick={() =>
          onChange([
            ...value,
            { field: columns[0]?.[0] || 'name', op: 'contains', value: '' },
          ])
        }
      >
        <Plus size={14} /> Add condition
      </button>
    </>
  );
}
export default function LeadFilters({
  config = defaultFieldOptions,
  applied,
  onApply,
}: {
  config?: FieldOptions;
  applied: ColumnFilter[];
  onApply: (filters: ColumnFilter[]) => void;
}) {
  const [draft, setDraft] = useState<ColumnFilter[]>(applied),
    [open, setOpen] = useState(false);
  return (
    <div className="lead-column-filters">
      <button
        className="button"
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open) setDraft(applied);
        }}
      >
        <Filter size={16} />
        Filter any column {applied.length ? `(${applied.length})` : ''}
      </button>
      {open ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onApply(draft);
            setOpen(false);
          }}
        >
          <ColumnFilterFields
            config={config}
            value={draft}
            onChange={setDraft}
          />
          <div className="lead-filter-actions">
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setDraft([]);
                onApply([]);
                setOpen(false);
              }}
            >
              Clear column filters
            </button>
            <button className="button primary" type="submit">
              Apply filters
            </button>
          </div>
        </form>
      ) : null}
      {applied.length ? (
        <p className="field-hint">
          {applied.length} column {applied.length === 1 ? 'filter' : 'filters'}{' '}
          active ·{' '}
          <button
            className="text-button"
            onClick={() => {
              onApply([]);
              setDraft([]);
            }}
          >
            Clear
          </button>
        </p>
      ) : null}
    </div>
  );
}
