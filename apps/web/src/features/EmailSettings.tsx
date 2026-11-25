import { useCallback, useEffect, useState } from 'react';
import { ErrorMessage, Loading, SaveButton, useSubmit } from '../components/UI';
import type { ApiClient } from '../lib/api';
import { errorMessage } from '../lib/error-message';

const events = {
  invitation: 'Workspace invitation', access_ready: 'Access approved',
  lead_assigned: 'Lead assigned', lead_converted: 'Lead converted', lead_failed: 'Lead reached a failed stage',
  task_assigned: 'Task assigned or reassigned', task_completed: 'Task completed',
  task_rescheduled: 'Task rescheduled', task_reopened: 'Task reopened',
  daily: 'Daily task reminder', weekly: 'Weekly task recap',
} as const;
const templates = { ...events, test: 'Delivery check' };
type EmailEvent = keyof typeof events;
type Template = keyof typeof templates;
type Policy = {
  version: number;
  enabled: boolean;
  events: Record<EmailEvent, boolean>;
  outcomeRecipientUid: string | null;
  deliveryReady: boolean;
};
type Preferences = {
  version: number;
  leadUpdates: boolean;
  taskUpdates: boolean;
  dailyEnabled: boolean;
  dailyTime: string;
  weeklyEnabled: boolean;
  weeklyTime: string;
  weeklyDay: number;
  timezone: string;
  digestInsights: boolean;
};
type Member = { uid?: string; id: string; name?: string; active: boolean; scope: string; capabilities: string[] };
type Delivery = { id: string; event: Template; createdAt: string; state: string; attempts: number; reason: string | null };
type DraftStatus = { dirty: boolean; busy: boolean };
const labels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const meanings: Record<string, string> = {
  no_longer_eligible: 'Recipient or email settings changed',
  suppressed_recipient: 'Address suppressed',
  retry_window_ended: 'Retry window ended',
  daily_limit: 'Daily sending limit reached',
  provider_rejected: 'Provider rejected the message',
  provider_unavailable: 'Provider unavailable',
  provider_rate_limit: 'Provider rate limit',
  provider_suppression: 'Bounce or complaint',
  sender_configuration: 'Sender setup needs attention',
  invalid_receipt: 'Provider receipt unavailable',
};

function Toggle({ label, detail, checked, onChange }: {
  label: string;
  detail?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return <label className="report-setting-option">
    <input type="checkbox" checked={checked} onChange={event => onChange(event.currentTarget.checked)} />
    <span>{label}{detail ? <small>{detail}</small> : null}</span>
  </label>;
}

function useEmailEditor<T extends { version: number }>(
  request: ApiClient, path: string, onEditingChange: (value: DraftStatus) => void,
) {
  const [draft, setDraft] = useState<T | null>(null);
  const [current, setCurrent] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async (signal?: AbortSignal) => {
    setError('');
    try {
      const result = await request(path, 'GET', undefined, undefined, signal) as T;
      if (!signal?.aborted) { setCurrent(result); setDraft(result); }
    } catch (cause) {
      if (!signal?.aborted) setError(errorMessage(cause));
    }
  }, [path, request]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  const submit = useSubmit(async (body, _key, isCurrent) => {
    const result = await request(path, 'PATCH', body) as T;
    if (isCurrent()) { setCurrent(result); setDraft(result); setMessage('Changes saved.'); }
  });
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(current);
  useEffect(() => { onEditingChange({ dirty, busy: submit.busy }); }, [dirty, submit.busy, onEditingChange]);
  useEffect(() => () => onEditingChange({ dirty: false, busy: false }), [onEditingChange]);
  function update(patch: Partial<T>) {
    setMessage('');
    setDraft(value => value ? { ...value, ...patch } : value);
  }
  return { draft, update, dirty, submit, message, error, reload: () => void load() };
}

export function EmailPreferences({ request, onEditingChange, canUseIntelligence }: {
  request: ApiClient;
  onEditingChange: (value: DraftStatus) => void;
  canUseIntelligence: boolean;
}) {
  const { draft, update, dirty, submit, error, message, reload } =
    useEmailEditor<Preferences>(request, '/email/preferences', onEditingChange);
  if (!draft) return <section className="panel email-settings">
    {error ? <><ErrorMessage error={error} /><button className="button" onClick={reload}>Try again</button></> : <Loading />}
  </section>;
  const { version, ...values } = draft;
  return <section className="panel email-settings">
    <form onSubmit={event => { event.preventDefault(); submit.run({ ...values, expectedVersion: version }); }}>
      <fieldset disabled={submit.busy} className="email-settings-group">
        <legend>Lead and task updates</legend>
        <Toggle label="Email me lead updates" detail="Assignments and configured outcomes for leads I can view."
          checked={draft.leadUpdates} onChange={leadUpdates => update({ leadUpdates })} />
        <Toggle label="Email me shared task updates" detail="Changes made by teammates to tasks I’m responsible for."
          checked={draft.taskUpdates} onChange={taskUpdates => update({ taskUpdates })} />
      </fieldset>
      <fieldset disabled={submit.busy} className="email-settings-group">
        <legend>Task digests</legend>
        <label className="material-field email-timezone">
          <span className="field-label">Digest time zone</span>
          <input value={draft.timezone} onChange={event => update({ timezone: event.currentTarget.value })}
            maxLength={100} required placeholder="Asia/Kolkata" list="email-timezone-list" />
        </label>
        <datalist id="email-timezone-list">
          {['Asia/Kolkata', 'Etc/UTC', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Singapore', 'Australia/Sydney']
            .map(zone => <option key={zone} value={zone} />)}
        </datalist>
        <div className="email-schedule">
          <Toggle label="Daily task reminder" detail="Due and overdue shared lead tasks."
            checked={draft.dailyEnabled} onChange={dailyEnabled => update({ dailyEnabled })} />
          <label className="material-field">
            <span className="field-label">Daily send time</span>
            <input type="time" required value={draft.dailyTime} disabled={!draft.dailyEnabled}
              onChange={event => update({ dailyTime: event.currentTarget.value })} />
          </label>
        </div>
        <div className="email-schedule">
          <Toggle label="Weekly task recap" detail="Recorded completions from the previous Monday through Sunday."
            checked={draft.weeklyEnabled} onChange={weeklyEnabled => update({ weeklyEnabled })} />
          <label className="material-field">
            <span className="field-label">Send on</span>
            <select value={draft.weeklyDay} disabled={!draft.weeklyEnabled}
              onChange={event => update({ weeklyDay: Number(event.currentTarget.value) })}>
              {labels.map((label, day) => <option key={label} value={day}>{label}</option>)}
            </select>
          </label>
          <label className="material-field">
            <span className="field-label">Weekly send time</span>
            <input type="time" required value={draft.weeklyTime} disabled={!draft.weeklyEnabled}
              onChange={event => update({ weeklyTime: event.currentTarget.value })} />
          </label>
        </div>
        {canUseIntelligence ? <Toggle label="Choose takeaways with AvinyaIntelligence"
          detail="Uses task totals and deadlines to highlight a priority inside each digest."
          checked={draft.digestInsights} onChange={digestInsights => update({ digestInsights })} /> : null}
      </fieldset>
      <ErrorMessage error={submit.error} />
      {message ? <p role="status">{message}</p> : null}
      <SaveButton label="Save preferences" busy={submit.busy} disabled={!dirty} />
    </form>
  </section>;
}

export function WorkspaceEmail({ request, onEditingChange, timezone }: {
  request: ApiClient;
  onEditingChange: (value: DraftStatus) => void;
  timezone: string;
}) {
  const { draft, update, dirty, submit, message, error, reload } =
    useEmailEditor<Policy>(request, '/email/settings', onEditingChange);
  const [view, setView] = useState<'controls' | 'preview' | 'deliveries'>('controls');
  const [members, setMembers] = useState<Member[]>([]);
  const [directoryError, setDirectoryError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      request('/members?limit=100', 'GET', undefined, undefined, controller.signal),
      request('/workspace-settings', 'GET', undefined, undefined, controller.signal),
    ]).then(([data, scope]) => {
      if (controller.signal.aborted) return;
      const { items } = data as { items: Member[] };
      const { assignedOnly } = scope as { assignedOnly: boolean };
      setMembers(items.filter(member =>
        member.active && member.scope === 'all' && member.capabilities.includes('leads:read') &&
        (!assignedOnly || ('role' in member && member.role === 'Admin'))));
    }).catch(cause => {
      if (!controller.signal.aborted) setDirectoryError(errorMessage(cause));
    });
    return () => controller.abort();
  }, [request]);
  if (!draft) return <section className="panel email-settings">
    {error ? <><ErrorMessage error={error} /><button className="button" onClick={reload}>Try again</button></> : <Loading />}
  </section>;
  return <>
    <div className="stage-tabs email-settings-tabs" role="group" aria-label="Workspace email">
      {(['controls', 'preview', 'deliveries'] as const).map(tab =>
        <button key={tab} type="button" className={view === tab ? 'active' : undefined} aria-pressed={view === tab}
          onClick={() => setView(tab)}>{tab === 'controls' ? 'Controls' : tab === 'preview' ? 'Template preview' : 'Delivery history'}</button>)}
    </div>
    {view === 'controls' ? <section className="panel email-settings">
      <form onSubmit={event => {
        event.preventDefault();
        submit.run({ expectedVersion: draft.version, enabled: draft.enabled, events: draft.events,
          outcomeRecipientUid: draft.outcomeRecipientUid });
      }}>
        <fieldset disabled={submit.busy} className="email-settings-group">
          <legend>Workspace delivery</legend>
          {!draft.deliveryReady ? <p className="field-hint">Sender setup is pending for this environment. You can configure email and preview the templates.</p> : null}
          <Toggle label="Enable workspace email" detail="Pause here to stop queued workspace email. Member opt-ins still apply."
            checked={draft.enabled} onChange={enabled => update({ enabled })} />
          <label className="material-field">
            <span className="field-label">Outcomes for unassigned leads</span>
            <select disabled={!!directoryError} value={draft.outcomeRecipientUid ?? ''}
              onChange={event => update({ outcomeRecipientUid: event.currentTarget.value || null })}>
              <option value="">Skip outcome email for unassigned leads</option>
              {draft.outcomeRecipientUid && !members.some(member => (member.uid || member.id) === draft.outcomeRecipientUid) ?
                <option value={draft.outcomeRecipientUid}>Previously selected member</option> : null}
              {members.map(member => <option key={member.id} value={member.uid || member.id}>
                {member.name?.includes('@') ? 'Workspace member' : member.name || 'Workspace member'}</option>)}
            </select>
          </label>
          <ErrorMessage error={directoryError} />
        </fieldset>
        <fieldset disabled={submit.busy} className="email-settings-group email-event-grid">
          <legend>Send email for</legend>
          {(Object.keys(events) as EmailEvent[]).map(key => <Toggle key={key} label={events[key]} checked={draft.events[key]}
            onChange={on => update({ events: { ...draft.events, [key]: on } })} />)}
        </fieldset>
        <ErrorMessage error={submit.error} />
        {message ? <p role="status">{message}</p> : null}
        <SaveButton label="Save email controls" busy={submit.busy} disabled={!dirty} />
      </form>
    </section> : view === 'preview' ? <TemplatePreview request={request} ready={draft.deliveryReady} /> :
      <DeliveryHistory request={request} timezone={timezone} />}
  </>;
}

function TemplatePreview({ request, ready }: { request: ApiClient; ready: boolean }) {
  const [template, setTemplate] = useState<Template>('weekly');
  const [preview, setPreview] = useState<{ subject: string; html: string; text: string } | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void request('/email/preview', 'POST', { template }, undefined, controller.signal).then(value => {
      if (!controller.signal.aborted) setPreview(value as typeof preview);
    }).catch(cause => {
      if (!controller.signal.aborted) setError(errorMessage(cause));
    });
    return () => controller.abort();
  }, [request, template]);
  const send = useSubmit(async (payload, key, isCurrent) => {
    await request('/email/test', 'POST', payload, key);
    if (isCurrent()) setMessage('Test queued. Check Delivery history for its status.');
  });
  return <section className="panel email-settings">
    <div className="email-preview-controls">
      <label className="material-field"><span className="field-label">Email template</span>
        <select value={template} onChange={event => {
          setPreview(null); setError(''); setMessage('');
          setTemplate(event.currentTarget.value as Template);
        }}>
          {(Object.keys(templates) as Template[]).map(key => <option key={key} value={key}>{templates[key]}</option>)}
        </select>
      </label>
      <button type="button" className="button" disabled={!ready || send.busy}
        onClick={() => send.run({ template, scenario: 'delivery' })}>{send.busy ? 'Queuing…' : 'Send test email'}</button>
    </div>
    <ErrorMessage error={error || send.error} />
    {message ? <p role="status">{message}</p> : null}
    {preview ? <>
      <p className="email-subject"><strong>Subject</strong> {preview.subject}</p>
      <iframe className="email-preview" title="Synthetic email preview" sandbox="" srcDoc={preview.html} />
      <details className="email-plain"><summary>Plain text</summary><pre>{preview.text}</pre></details>
    </> : !error ? <Loading /> : null}
  </section>;
}

function DeliveryHistory({ request, timezone }: { request: ApiClient; timezone: string }) {
  const [items, setItems] = useState<Delivery[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async (next?: string, signal?: AbortSignal) => {
    setBusy(true);
    setError('');
    try {
      const response = await request('/email/deliveries?limit=12' + (next ? '&cursor=' + encodeURIComponent(next) : ''), 'GET',
        undefined, undefined, signal) as { items: Delivery[]; nextCursor: string | null };
      if (!signal?.aborted) {
        setItems(current => next ? [...current, ...response.items] : response.items);
        setCursor(response.nextCursor);
      }
    } catch (cause) {
      if (!signal?.aborted) setError(errorMessage(cause));
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }, [request]);
  useEffect(() => {
    const controller = new AbortController();
    void load(undefined, controller.signal);
    return () => controller.abort();
  }, [load]);
  return <section className="panel email-settings" aria-busy={busy}>
    <div className="email-preview-controls">
      <p>Recent workspace email attempts and provider receipts.</p>
      <button type="button" className="button" disabled={busy} onClick={() => void load()}>Refresh</button>
    </div>
    <ErrorMessage error={error} />
    {items.length ? <ul className="email-delivery-list">{items.map(item => <li key={item.id}>
      <div><strong>{templates[item.event]}</strong>
        <small>{new Date(item.createdAt).toLocaleString('en-IN', { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' })}</small>
        {item.reason ? <small>{meanings[item.reason] || 'Delivery needs review'}</small> : null}
      </div>
      <span className="email-state">{item.state}</span>
    </li>)}</ul> : busy ? <Loading /> : !error ? <p>No email attempts yet.</p> : null}
    {cursor ? <button className="button" disabled={busy} onClick={() => void load(cursor)}>Load more</button> : null}
  </section>;
}
