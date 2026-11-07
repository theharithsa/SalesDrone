import { useState } from 'react';
import { Plus, Pencil, Trash2, RotateCcw, X, ChevronRight, ListFilter, UserRound } from 'lucide-react';
import {
  CustomField,
  FieldOptions,
  fieldRemovalReason,
  standardFieldLabels,
  labelFor,
} from '../lib/field-options';
import { ErrorMessage, SaveButton } from '../components/UI';
const types = {
  text: 'Short text',
  textarea: 'Long text',
  number: 'Number',
  date: 'Date',
  select: 'Dropdown',
  checkbox: 'Checkbox',
};
export default function LeadFieldManager({
  config,
  request,
  onChanged,
  onOpenLayout,
}: {
  config: FieldOptions;
  request: (p: string, m?: string, b?: any) => Promise<any>;
  onChanged: (c: FieldOptions) => void;
  onOpenLayout?: (section: 'field-order' | 'lead-header') => void;
}) {
  const [standardEditing, setStandardEditing] = useState<{
    key: string;
    label: string;
  } | null>(null);
  const [editing, setEditing] = useState<CustomField | null>(null),
    [options, setOptions] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();
  const activeFields = config.customFields.filter((field) => !field.deleted);
  const matchingCustom = activeFields.filter((field) => field.label.toLowerCase().includes(term));
  const matchingStandard = Object.entries(standardFieldLabels).filter(([key, originalLabel]) =>
    standardEditing?.key === key || [labelFor(config, key), originalLabel].some((label) => label.toLowerCase().includes(term)));
  async function update(change: Partial<FieldOptions>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const next = await request('/field-options', 'PATCH', {
        expectedVersion: config.version,
        values: config.values,
        customFields: config.customFields,
        hiddenFields: config.hiddenFields,
        ...change,
      });
      onChanged(next);
      setMessage('Lead fields saved.');
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function open(field?: CustomField) {
    setEditing(
      field
        ? { ...field }
        : {
            id: 'cf_' + crypto.randomUUID().replaceAll('-', ''),
            label: '',
            type: 'text',
            options: [],
            required: false,
            deleted: false,
          },
    );
    setOptions(field?.options.join('\n') || '');
    setError('');
    setMessage('');
  }
  return (
    <section className="panel lead-field-manager">
      <div className="section-heading">
        <div>
          <h2>Enquiry form</h2>
          <p>Choose what your enquiry form collects.</p>
        </div>
        <button
          className="button primary"
          disabled={
            busy ||
            !!editing ||
            !!standardEditing ||
            activeFields.length >= 30
          }
          onClick={() => open()}
        >
          <Plus size={17} /> Add field
        </button>
      </div>
      {onOpenLayout && <div className="field-settings-shortcuts">
        <button type="button" onClick={() => onOpenLayout('field-order')}>
          <ListFilter size={20} aria-hidden="true" />
          <span><strong>Arrange fields</strong><small>Forms, lead columns and Excel</small></span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onOpenLayout('lead-header')}>
          <UserRound size={20} aria-hidden="true" />
          <span><strong>Choose lead header fields</strong><small>What appears under the lead name</small></span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>}
      <label className="material-field field-settings-search">
        <span className="field-label">Find a field</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="section-heading">
        <div>
          <h3>Custom fields</h3>
          <p>Collect details specific to your business.</p>
        </div>
        <span className="role-label">
          {activeFields.length} / 30
        </span>
      </div>
      {!matchingCustom.length && !editing ? (
        <div className="settings-empty">
          {term ? 'No custom fields match your search.' : 'No custom fields yet. Add a field such as Product interest or Estimated budget.'}
        </div>
      ) : null}
      {matchingCustom
        .filter((f) => f.id !== editing?.id)
        .map((f) => (
          <div className="settings-field-row" key={f.id}>
            <span>
              <strong>{f.label}</strong>
              <small>
                {types[f.type]}
                {f.required ? ' · Required' : ' · Optional'}
                {f.type === 'select' ? ` · ${f.options.length} choices` : ''}
              </small>
            </span>
            <div className="field-row-actions">
              <button
                className="icon-button"
                aria-label={'Edit ' + f.label}
                title={'Edit ' + f.label}
                disabled={busy || !!editing || !!standardEditing}
                onClick={() => open(f)}
              >
                <Pencil size={17} />
              </button>
              <button
                className="icon-button danger"
                aria-label={'Delete ' + f.label + ' from form'}
                title={'Delete ' + f.label + ' from form'}
                disabled={busy || !!editing || !!standardEditing}
                onClick={() =>
                  void update({
                    customFields: config.customFields.map((v) =>
                      v.id === f.id ? { ...v, deleted: true } : v,
                    ),
                  })
                }
              >
                <Trash2 size={17} />
              </button>
            </div>
          </div>
        ))}
      {editing ? (
        <form
          className="custom-field-editor"
          onSubmit={async (e) => {
            e.preventDefault();
            const field = {
              ...editing,
              label: editing.label.trim(),
              options:
                editing.type === 'select'
                  ? options
                      .split('\n')
                      .map((v) => v.trim())
                      .filter(Boolean)
                  : [],
            };
            const fields = config.customFields.some((f) => f.id === field.id)
              ? config.customFields.map((f) => (f.id === field.id ? field : f))
              : [...config.customFields, field];
            if (await update({ customFields: fields })) setEditing(null);
          }}
        >
          <div className="section-heading">
            <h3>
              {config.customFields.some((f) => f.id === editing.id)
                ? 'Edit field'
                : 'New field'}
            </h3>
            <button
              type="button"
              className="icon-button"
              aria-label="Cancel field editing"
              onClick={() => setEditing(null)}
              disabled={busy}
            >
              <X size={18} />
            </button>
          </div>
          <div className="form-grid">
            <label>
              Field name
              <input
                autoFocus
                disabled={busy}
                value={editing.label}
                maxLength={80}
                required
                onChange={(e) =>
                  setEditing({ ...editing, label: e.target.value })
                }
              />
            </label>
            <label>
              Field type
              <select
                value={editing.type}
                disabled={
                  busy || config.customFields.some((f) => f.id === editing.id)
                }
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    type: e.target.value as CustomField['type'],
                  })
                }
              >
                {Object.entries(types).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {editing.type === 'select' ? (
            <label>
              Dropdown choices — one per line
              <textarea
                rows={5}
                required
                disabled={busy}
                value={options}
                onChange={(e) => setOptions(e.target.value)}
              />
            </label>
          ) : null}
          <label className="checkbox-row">
            <input
              type="checkbox"
              disabled={busy}
              checked={editing.required}
              onChange={(e) =>
                setEditing({ ...editing, required: e.target.checked })
              }
            />
            Required when saving an enquiry
          </label>
          <p className="field-hint">
            Existing records keep their values. A field’s type stays fixed after
            creation; add a new field to use a different type.
          </p>
          <div className="form-actions">
            <button
              className="button"
              type="button"
              onClick={() => setEditing(null)}
              disabled={busy}
            >
              Cancel
            </button>
            <SaveButton busy={busy} label="Save field" />
          </div>
        </form>
      ) : null}
      <div className="settings-notice">
        <strong>Your form, your fields</strong>
        <p>
          New enquiries need a phone number and enquiry date. Removed fields
          keep their saved data; workflow controls stay available.
        </p>
      </div>
      <h3 className="settings-group-title">Standard fields</h3>
      <div className="standard-field-list">
        {!matchingStandard.length && <p className="field-hint">No standard fields match your search.</p>}
        {matchingStandard.map(([key, originalLabel]) => {
          const hidden = config.hiddenFields.includes(key);
          const reason = fieldRemovalReason(config, key);
          const action = hidden
            ? 'Restore ' + labelFor(config, key) + ' to form'
            : 'Delete ' + labelFor(config, key) + ' from form';
          return (
            <div className="settings-field-row" data-removed={hidden || undefined} key={key}>
              {standardEditing?.key === key ? (
                <form
                  className="standard-label-editor"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (
                      await update({
                        labels: {
                          ...config.labels,
                          [key]: standardEditing.label,
                        },
                      })
                    )
                      setStandardEditing(null);
                  }}
                >
                  <label>
                    Field name
                    <input
                      autoFocus
                      required
                      maxLength={80}
                      value={standardEditing.label}
                      disabled={busy}
                      onChange={(e) =>
                        setStandardEditing({ key, label: e.target.value })
                      }
                    />
                  </label>
                  <div className="form-actions">
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        setStandardEditing({ key, label: originalLabel })
                      }
                    >
                      Original name
                    </button>
                    <button
                      type="button"
                      className="button"
                      disabled={busy}
                      onClick={() => setStandardEditing(null)}
                    >
                      Cancel
                    </button>
                    <SaveButton busy={busy} label="Save name" />
                  </div>
                </form>
              ) : (
                <>
                  <span>
                    <strong>{labelFor(config, key)}</strong>
                    <small id={'field-description-' + key}>
                      {labelFor(config, key) !== originalLabel
                        ? `Originally ${originalLabel} · `
                        : ''}
                      {hidden
                        ? 'Removed from form and table'
                        : reason || 'Built-in field'}
                    </small>
                  </span>
                  <div className="field-row-actions">
                    <button
                      className="icon-button"
                      aria-label={'Edit ' + labelFor(config, key)}
                      title={'Edit ' + labelFor(config, key)}
                      disabled={busy || !!editing || !!standardEditing}
                      onClick={() => {
                        setStandardEditing({ key, label: labelFor(config, key) });
                        setError('');
                        setMessage('');
                      }}
                    >
                      <Pencil size={17} />
                    </button>
                    <span title={reason || undefined}>
                      <button
                        className={
                          hidden
                            ? 'icon-button'
                            : 'icon-button danger'
                        }
                        aria-describedby={'field-description-' + key}
                        aria-label={action}
                        title={action}
                        disabled={
                          busy || !!editing || !!standardEditing ||
                          !!reason
                        }
                        onClick={() =>
                          void update({
                            hiddenFields: hidden
                              ? config.hiddenFields.filter((k) => k !== key)
                              : [...config.hiddenFields, key],
                          })
                        }
                      >
                        {hidden ? (
                          <RotateCcw size={17} />
                        ) : (
                          <Trash2 size={17} />
                        )}
                      </button>
                    </span>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      <p className="field-hint">
        Removing a field preserves its existing values and history. Standard
        fields can be restored here; removed custom fields remain visible on
        leads that already contain a value.
      </p>
      <ErrorMessage error={error} />
      {message ? (
        <p className="success-message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
