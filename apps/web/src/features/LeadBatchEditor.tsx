import { useEffect, useState } from 'react';
import WorksheetLeads from '../components/WorksheetLeads';
import { Modal, ErrorMessage } from '../components/UI';
import type { Lead } from '../lib/types';
import { labelFor, type FieldOptions } from '../lib/field-options';
export default function LeadBatchEditor({
  leads,
  config,
  scores,
  selectedId,
  onSelect,
  request,
  onDone,
  canEdit,
  canAssign,
}: {
  leads: Lead[];
  config: FieldOptions;
  scores: Record<string, any>;
  selectedId: string | null;
  onSelect: (l: Lead) => void;
  request: (p: string, m?: string, b?: any, k?: string) => Promise<any>;
  onDone: () => void;
  canEdit: boolean;
  canAssign: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set()),
    [open, setOpen] = useState(false),
    [edits, setEdits] = useState<{ key: string; value: string }[]>([
      { key: 'stage', value: '' },
    ]),
    [assign, setAssign] = useState('unchanged'),
    [members, setMembers] = useState<any[]>([]),
    [review, setReview] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const signature = leads.map((l) => l.id + ':' + l.version).join('|');
  useEffect(() => {
    setSelected(new Set());
    setReview(null);
  }, [signature]);
  useEffect(() => {
    if (open && canAssign)
      request('/members?limit=100')
        .then((r) => setMembers(r.items || []))
        .catch(() =>
          setError('Assignees could not be loaded. Retry opening batch edit.'),
        );
  }, [open, canAssign, request]);
  const fields = [
    ...[
      'stage',
      'source',
      'company',
      'jobTitle',
      'location',
      'zone',
      'legacyStatus',
      'tags',
    ]
      .filter((k) => !config.hiddenFields.includes(k))
      .map((k) => ({
        key: k,
        label: labelFor(
          config,
          k,
          k === 'stage'
            ? 'Sales stage'
            : k === 'tags'
              ? 'Tags'
              : k === 'jobTitle'
                ? 'Job title'
                : k,
        ),
        type: 'text',
        options: config.values[k as keyof typeof config.values] || [],
      })),
    ...config.customFields
      .filter((f) => !f.deleted)
      .map((f) => ({
        key: f.id,
        label: f.label,
        type: f.type,
        options: f.options,
      })),
  ];
  function toggle(id: string) {
    setError('');
    setNotice('');
    setSelected((old) => {
      const n = new Set(old);
      if (n.has(id)) n.delete(id);
      else if (n.size < 25) n.add(id);
      else setNotice('Select up to 25 leads per batch.');
      return n;
    });
    setReview(null);
  }
  function payload() {
    const changes: Record<string, any> = {};
    for (const e of edits) {
      if (!e.value) continue;
      const f = fields.find((f) => f.key === e.key);
      let value: any = e.value === '__clear__' ? null : e.value;
      if (f?.type === 'number' && value !== null) {
        value = Number(value);
        if (!Number.isFinite(value)) throw Error('Enter a valid number');
      }
      if (f?.type === 'checkbox' && value !== null) value = value === 'true';
      if (e.key === 'tags')
        value =
          e.value === '__clear__'
            ? []
            : e.value
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean);
      if (e.key.startsWith('cf_'))
        changes.customFields = {
          ...changes.customFields,
          [e.key]: value === '__clear__' ? null : value,
        };
      else changes[e.key] = value ?? '';
    }
    return {
      items: leads
        .filter((l) => selected.has(l.id))
        .map((l) => ({ id: l.id, expectedVersion: l.version })),
      changes,
      ...(assign !== 'unchanged'
        ? { assignedToUid: assign === 'unassigned' ? null : assign }
        : {}),
    };
  }
  async function preview() {
    setBusy(true);
    setError('');
    try {
      const input = payload();
      if (!input.items.length)
        throw Error('Select leads from the current list first');
      const result = await request('/leads/batch/preview', 'POST', input);
      setReview({ input, result, key: crypto.randomUUID() });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    setBusy(true);
    setError('');
    try {
      const r = await request('/leads/batch', 'POST', review.input, review.key);
      setNotice(`${r.changedCount} leads updated.`);
      setOpen(false);
      setSelected(new Set());
      setReview(null);
      onDone();
    } catch (e) {
      setError(
        (e as Error).message +
          ' If the connection failed, retry this reviewed request safely or refresh the list to check its result.',
      );
    } finally {
      setBusy(false);
    }
  }
  const show = (v: any) =>
    v === null || v === ''
      ? 'Not set'
      : Array.isArray(v)
        ? v.join(', ')
        : typeof v === 'object'
          ? Object.entries(v)
              .map(
                ([k, v]) =>
                  `${fields.find((f) => f.key === k)?.label || k}: ${v ?? 'Not set'}`,
              )
              .join('; ')
          : members.find((m) => m.uid === v)?.name || String(v);
  return (
    <>
      {canEdit && (
        <div className="batch-toolbar">
          <label>
            <input
              type="checkbox"
              checked={
                leads.length > 0 &&
                leads.slice(0, 25).every((l) => selected.has(l.id))
              }
              onChange={(e) => {
                setSelected(
                  e.target.checked
                    ? new Set(leads.slice(0, 25).map((l) => l.id))
                    : new Set(),
                );
                setReview(null);
              }}
            />
            Select {leads.length > 25 ? 'first 25' : 'loaded'} leads
          </label>
          <span>{selected.size} selected</span>
          <button
            className="button"
            disabled={!selected.size}
            onClick={() => {
              setOpen(true);
              setReview(null);
              setError('');
            }}
          >
            Batch edit
          </button>
          {selected.size > 0 && (
            <button
              className="text-button"
              onClick={() => setSelected(new Set())}
            >
              Clear selection
            </button>
          )}
        </div>
      )}
      {notice && (
        <p className="field-hint" role="status">
          {notice}
        </p>
      )}
      <WorksheetLeads
        leads={leads}
        config={config}
        scores={scores}
        selectedId={selectedId}
        onSelect={onSelect}
        checkedIds={canEdit ? selected : undefined}
        onToggle={toggle}
      />
      <Modal
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title={`Batch edit ${selected.size} leads`}
        description="Choose shared changes, review them, then apply one atomic batch. Selection covers loaded leads only and resets when the list changes."
        wide
      >
        <ErrorMessage error={error} />
        <div className="batch-edit-fields">
          {edits.map((edit, i) => {
            const f = fields.find((f) => f.key === edit.key);
            const update = (value: string) => {
              setEdits((es) =>
                es.map((e, n) => (n === i ? { ...e, value } : e)),
              );
              setReview(null);
            };
            return (
              <div className="batch-edit-row" key={i}>
                <label>
                  Field
                  <select
                    value={edit.key}
                    disabled={busy}
                    onChange={(e) => {
                      setEdits((es) =>
                        es.map((v, n) =>
                          n === i ? { key: e.target.value, value: '' } : v,
                        ),
                      );
                      setReview(null);
                    }}
                  >
                    {fields.map((f) => (
                      <option
                        key={f.key}
                        value={f.key}
                        disabled={edits.some(
                          (e, n) => n !== i && e.key === f.key,
                        )}
                      >
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  New value
                  {f?.type === 'checkbox' ? (
                    <select
                      value={edit.value}
                      disabled={busy}
                      aria-label={'New ' + (f?.label || 'value')}
                      onChange={(e) => update(e.target.value)}
                    >
                      <option value="">Leave unchanged</option>
                      <option value="__clear__">Clear value</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  ) : f?.options.length ? (
                    <select
                      value={edit.value}
                      disabled={busy}
                      aria-label={'New ' + (f?.label || 'value')}
                      onChange={(e) => update(e.target.value)}
                    >
                      <option value="">Leave unchanged</option>
                      {f.key !== 'stage' && (
                        <option value="__clear__">Clear value</option>
                      )}
                      {f.options.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={edit.value === '__clear__' ? '' : edit.value}
                      disabled={busy}
                      aria-label={'New ' + (f?.label || 'value')}
                      type={
                        f?.type === 'number'
                          ? 'number'
                          : f?.type === 'date'
                            ? 'date'
                            : 'text'
                      }
                      maxLength={4000}
                      placeholder={
                        edit.value === '__clear__'
                          ? 'This value will be cleared'
                          : f?.key === 'tags'
                            ? 'Comma-separated tags'
                            : 'Leave blank to keep unchanged'
                      }
                      onChange={(e) => update(e.target.value)}
                    />
                  )}
                  {edit.value === '__clear__' && (
                    <small className="field-hint">
                      This value will be cleared.
                    </small>
                  )}
                </label>
                {edit.key !== 'stage' && (
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => update('__clear__')}
                  >
                    Clear value
                  </button>
                )}
                {edits.length > 1 && (
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => {
                      setEdits((es) => es.filter((_, n) => n !== i));
                      setReview(null);
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })}
          <button
            className="button"
            disabled={busy || edits.length >= fields.length}
            onClick={() => {
              const next = fields.find(
                (f) => !edits.some((e) => e.key === f.key),
              );
              if (next) setEdits((es) => [...es, { key: next.key, value: '' }]);
              setReview(null);
            }}
          >
            Add another field
          </button>
          {canAssign && (
            <div className="batch-assignment">
              <label htmlFor="batch-assignee">Assigned to</label>
              <select
                id="batch-assignee"
                aria-describedby="batch-assignment-help"
                value={assign}
                disabled={busy}
                onChange={(e) => {
                  setAssign(e.target.value);
                  setReview(null);
                }}
              >
                <option value="unchanged">Keep current assignees</option>
                <option value="unassigned">Unassigned</option>
                {members
                  .filter(
                    (m) => m.active && m.capabilities?.includes('leads:read'),
                  )
                  .map((m) => (
                    <option key={m.uid} value={m.uid}>
                      {m.name || m.email || m.uid}
                    </option>
                  ))}
              </select>
              <span className="field-hint" id="batch-assignment-help">
                Reassignment cancels pending tasks and alerts the new assignee.
              </span>
            </div>
          )}
        </div>
        {review && (
          <section className="batch-preview" aria-label="Batch edit preview">
            <h3>
              {review.result.changedCount} of {review.result.count} leads will
              change
            </h3>
            {review.result.items.map((row: any, index: number) => (
              <details key={row.id} open={index === 0}>
                <summary>
                  {row.name || 'Name not recorded'}
                  {row.changed ? '' : ' — unchanged'}
                </summary>
                <dl>
                  {Object.keys(row.after).map((key) => (
                    <div key={key}>
                      <dt>
                        {key === 'assignedToUid'
                          ? 'Assigned to'
                          : fields.find((f) => f.key === key)?.label || key}
                      </dt>
                      <dd>
                        {show(row.before[key])} →{' '}
                        <strong>{show(row.after[key])}</strong>
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            ))}
          </section>
        )}
        <div className="form-actions">
          <button className="button" disabled={busy} onClick={preview}>
            {busy ? 'Working…' : 'Preview changes'}
          </button>
          <button
            className="button primary"
            disabled={busy || !review?.result.changedCount}
            onClick={apply}
          >
            Apply reviewed changes
          </button>
        </div>
      </Modal>
    </>
  );
}
