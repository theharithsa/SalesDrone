import { useEffect, useState } from 'react';
import { FieldOptions, FieldKey, fieldLabels } from '../lib/field-options';
import { ErrorMessage } from '../components/UI';
export default function FieldOptionsEditor({
  config,
  request,
  onChanged,
}: {
  config: FieldOptions;
  request: (p: string, m?: string, b?: any) => Promise<any>;
  onChanged: (config: FieldOptions) => void;
}) {
  const [field, setField] = useState<FieldKey>('source'),
    [text, setText] = useState(config.values.source.join('\n')),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  useEffect(() => {
    setText(config.values[field].join('\n'));
  }, [field, config.version]);
  async function save() {
    setError('');
    setMessage('');
    const list = text
      .split('\n')
      .map((v) => v.trim())
      .filter(Boolean);
    if (list.length > 100 || list.some((v) => v.length > 100)) {
      setError('Use at most 100 values, each up to 100 characters.');
      return;
    }
    if (
      new Set(list.map((v) => v.normalize('NFKC').toLowerCase())).size !==
      list.length
    ) {
      setError('Remove repeated values before saving.');
      return;
    }
    const required: Partial<Record<FieldKey, string[]>> = {
      stage: ['New'],
      outcome: ['Connected', 'No answer'],
      disposition: ['None', 'Do not contact'],
    };
    const missing = required[field]?.filter((v) => !list.includes(v));
    if (missing?.length) {
      setError('Keep the system values: ' + missing.join(', '));
      return;
    }
    if (
      field === 'countryCode' &&
      (!list.length || list.some((v) => !/^\+\d{1,3}$/.test(v)))
    ) {
      setError('Use country codes such as +91. Keep at least one.');
      return;
    }
    setBusy(true);
    try {
      const updated = await request('/field-options', 'PATCH', {
        expectedVersion: config.version,
        values: { ...config.values, [field]: list },
      });
      onChanged(updated);
      setMessage('Field choices saved for your workspace.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel field-options-panel">
      <div className="section-heading">
        <div>
          <h2>Shared dropdown choices</h2>
          <p>Add, reorder or retire choices for your team.</p>
        </div>
        <span className="role-label">Admin</span>
      </div>
      <p className="field-hint">
        For a custom field’s dropdown choices, open Lead fields and edit that
        field.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label>
          Standard field
          <select
            value={field}
            onChange={(e) => {
              setField(e.target.value as FieldKey);
              setError('');
              setMessage('');
            }}
            disabled={busy}
          >
            {(Object.entries(fieldLabels) as [FieldKey, string][]).map(
              ([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          Choices — one per line
          <textarea
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
          />
        </label>
        <p className="field-hint">
          Sources, cities, sectors and enquiry statuses appear as suggestions.
          Stages, call outcomes, dispositions and country codes use these
          dropdown choices. Retiring a value preserves existing records.
        </p>
        <p className="field-hint">
          Keep New, Connected, No answer, None and Do not contact in their
          respective lists. Use Do not contact to block outreach; custom
          dispositions are labels.
        </p>
        <ErrorMessage error={error} />
        {message ? (
          <p role="status" className="success-message">
            {message}
          </p>
        ) : null}
        <button className="button primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save choices'}
        </button>
      </form>
    </section>
  );
}
