import { useEffect, useRef, useState } from 'react';
import { Task, displayDate } from '../lib/types';
import { ErrorMessage, Loading } from './UI';
export default function LeadTaskTab({
  leadId,
  request,
  timezone,
  onOpen,
  refreshKey,
}: {
  leadId: string;
  refreshKey: number;
  request: (p: string) => Promise<any>;
  timezone: string;
  onOpen: (t: Task) => void;
}) {
  const [items, setItems] = useState<Task[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [state, setState] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const epoch = useRef(0);
  async function load(next?: string) {
    const current = ++epoch.current;
    setBusy(true);
    setError('');
    try {
      const q = new URLSearchParams({ leadId, limit: '50' });
      if (state) q.set('state', state);
      if (next) q.set('cursor', next);
      const r = await request('/tasks?' + q);
      if (current === epoch.current) {
        setItems((old) => (next ? [...old, ...r.items] : r.items));
        setCursor(r.nextCursor);
      }
    } catch (e) {
      if (current === epoch.current) setError((e as Error).message);
    } finally {
      if (current === epoch.current) setBusy(false);
    }
  }
  useEffect(() => {
    setItems([]);
    setCursor(null);
    void load();
    return () => {
      epoch.current++;
    };
  }, [leadId, state, request, refreshKey]);
  return (
    <div className="lead-task-workspace">
      <div className="lead-task-toolbar">
        <div>
          <h3>Your tasks for this lead</h3>
          <p>Private to you, including completed and cancelled work.</p>
        </div>
        <label>
          Task status
          <select value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">All statuses</option>
            {['Pending', 'Completed', 'Cancelled'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <button className="button" disabled={busy} onClick={() => void load()}>
          Refresh tasks
        </button>
      </div>
      <ErrorMessage error={error} />
      {busy && !items.length ? <Loading /> : null}
      {!busy && !error && !items.length ? (
        <p>No tasks match this status. Use Remind me to add a follow-up.</p>
      ) : null}
      {items.map((t) => (
        <button
          className="lead-task task-work-card"
          key={t.id}
          onClick={() => onOpen(t)}
        >
          <span>
            <strong>{t.title}</strong>
            <small>{displayDate(t.dueAt, timezone)}</small>
          </span>
          <span className="task-state">{t.state}</span>
        </button>
      ))}
      {cursor ? (
        <button
          className="button"
          disabled={busy}
          onClick={() => void load(cursor)}
        >
          Load more tasks
        </button>
      ) : null}
    </div>
  );
}
