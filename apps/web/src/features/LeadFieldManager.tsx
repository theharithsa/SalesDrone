import { useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import {
  CustomField,
  FieldOptions,
  optionalLeadFields,
  standardFieldLabels,
  labelFor,
} from '../lib/field-options';
import { ErrorMessage } from '../components/UI';
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
}: {
  config: FieldOptions;
  request: (p: string, m?: string, b?: any) => Promise<any>;
  onChanged: (c: FieldOptions) => void;
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
            config.customFields.filter((f) => !f.deleted).length >= 30
          }
          onClick={() => open()}
        >
          <Plus size={17} /> Add field
        </button>
      </div>
      <div className="section-heading">
        <div>
          <h3>Custom fields</h3>
          <p>Collect details specific to your business.</p>
        </div>
        <span className="role-label">
          {config.customFields.filter((f) => !f.deleted).length} / 30
        </span>
      </div>
      {!config.customFields.some((f) => !f.deleted) && !editing ? (
        <div className="settings-empty">
          No custom fields yet. Add a field such as Product interest or
          Estimated budget.
        </div>
      ) : null}
      {config.customFields
        .filter((f) => !f.deleted && f.id !== editing?.id)
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
                disabled={busy || !!editing || !!standardEditing}
                onClick={() => open(f)}
              >
                <Pencil size={17} />
              </button>
              <button
                className="icon-button danger"
                aria-label={'Remove ' + f.label}
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
            <button className="button primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save field'}
            </button>
          </div>
        </form>
      ) : null}
      <div className="settings-notice">
        <strong>Essential fields stay available</strong>
        <p>
          Rename built-in fields to suit your team. Their data types and
          workflow roles stay the same. Essential fields remain available for
          contact validation and the sales workflow.
        </p>
      </div>
      <h3 className="settings-group-title">Standard fields</h3>
      <div className="standard-field-list">
        {Object.entries(standardFieldLabels).map(([key, originalLabel]) => (
          <div className="settings-field-row" key={key}>
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
                  <button className="button primary" disabled={busy}>
                    {busy ? 'Saving…' : 'Save name'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <span>
                  <strong>{labelFor(config, key)}</strong>
                  <small>
                    {labelFor(config, key) !== originalLabel
                      ? `Originally ${originalLabel} · `
                      : ''}
                    {config.hiddenFields.includes(key)
                      ? 'Hidden from entry and table'
                      : 'Built-in field'}
                  </small>
                </span>
                <div className="field-row-actions">
                  <button
                    className="icon-button"
                    aria-label={'Edit ' + labelFor(config, key)}
                    disabled={busy || !!editing || !!standardEditing}
                    onClick={() => {
                      setStandardEditing({ key, label: labelFor(config, key) });
                      setError('');
                      setMessage('');
                    }}
                  >
                    <Pencil size={17} />
                  </button>
                  {key in optionalLeadFields ? (
                    <button
                      className="button"
                      disabled={busy || !!editing || !!standardEditing}
                      onClick={() =>
                        void update({
                          hiddenFields: config.hiddenFields.includes(key)
                            ? config.hiddenFields.filter((k) => k !== key)
                            : [...config.hiddenFields, key],
                        })
                      }
                    >
                      {config.hiddenFields.includes(key)
                        ? 'Restore field'
                        : 'Remove field'}
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        ))}
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
