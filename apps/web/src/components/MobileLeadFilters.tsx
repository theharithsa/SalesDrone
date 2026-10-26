import { useRef, useState } from 'react';
import { Filter } from 'lucide-react';
import { Modal } from './UI';
import { ColumnFilterFields } from './LeadFilters';
import { type FieldOptions, labelFor, withCurrent } from '../lib/field-options';
import type { ColumnFilter } from '../lib/lead-fields';
export type LeadFilterValues = {
  searchField: string;
  stage: string;
  source: string;
  filters: ColumnFilter[];
};
export default function MobileLeadFilters({
  config,
  sources,
  applied,
  onApply,
}: {
  config: FieldOptions;
  sources: string[];
  applied: LeadFilterValues;
  onApply: (values: LeadFilterValues) => void;
}) {
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(applied);
  const trigger = useRef<HTMLButtonElement>(null);
  const count =
    applied.filters.length + Number(!!applied.stage) + Number(!!applied.source);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="button mobile-lead-filter-trigger"
        aria-haspopup="dialog"
        aria-label={count ? `Filter leads, ${count} active` : 'Filter leads'}
        title="Filter leads"
        onClick={() => {
          setDraft({
            ...applied,
            filters: applied.filters.map((f) => ({ ...f })),
          });
          setOpen(true);
        }}
      >
        <Filter size={18} />
        <span>Filters{count ? ` (${count})` : ''}</span>
        {count ? (
          <span className="mobile-filter-count" aria-hidden="true">
            {count}
          </span>
        ) : null}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        returnFocusRef={trigger}
        title="Filter leads"
        description="Choose your filters, then apply them to the lead list. Cancel keeps your current filters."
      >
        <form
          className="mobile-lead-filter-form"
          onSubmit={(e) => {
            e.preventDefault();
            onApply(draft);
            setOpen(false);
          }}
        >
          <div className="form-grid">
            <label className="full">
              Search in
              <select
                aria-label="Search field"
                value={draft.searchField}
                onChange={(e) =>
                  setDraft({ ...draft, searchField: e.target.value })
                }
              >
                {['name', 'company', 'phone', 'email', 'location', 'zone'].map(
                  (key) => (
                    <option key={key} value={key}>
                      {labelFor(config, key)}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              {labelFor(config, 'stage')}
              <select
                aria-label="Filter stage"
                value={draft.stage}
                onChange={(e) => setDraft({ ...draft, stage: e.target.value })}
              >
                <option value="">All stages</option>
                {withCurrent(config.values.stage, draft.stage).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              {labelFor(config, 'source')}
              <select
                aria-label="Filter source"
                value={draft.source}
                onChange={(e) => setDraft({ ...draft, source: e.target.value })}
              >
                <option value="">All sources</option>
                {withCurrent(sources, draft.source).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="mobile-column-filters">
            <legend>Column conditions</legend>
            <ColumnFilterFields
              config={config}
              value={draft.filters}
              onChange={(filters) => setDraft({ ...draft, filters })}
            />
          </fieldset>
          <div className="form-footer">
            <button
              className="text-button"
              type="button"
              onClick={() =>
                setDraft({
                  searchField: 'name',
                  stage: '',
                  source: '',
                  filters: [],
                })
              }
            >
              Reset
            </button>
            <div>
              <button
                className="button"
                type="button"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button className="button primary" type="submit">
                Apply filters
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
