import { useState } from 'react';
import { Task, displayDate } from '../lib/types';
import { type LeadTaskPages, useLeadTasks } from '../lib/use-lead-tasks';
import { ErrorMessage, Loading } from './UI';

export default function LeadTaskTab({
  leadId,
  scope,
  request,
  timezone,
  onOpen,
  onChange,
  refreshKey,
  allTasks,
}: {
  leadId: string;
  scope: string;
  refreshKey: number;
  request: (path: string) => Promise<any>;
  timezone: string;
  onOpen: (t: Task) => void;
  onChange: (task: Task, action: 'complete' | 'reopen') => void;
  allTasks: LeadTaskPages;
}) {
  const [state, setState] = useState('');
  const filtered = useLeadTasks({ leadId: state ? leadId : null, scope, refreshKey, request, state });
  const { items, nextCursor, busy, error, load } = state ? filtered : allTasks;
  return (
    <div className="lead-task-workspace">
      <div className="lead-task-toolbar">
        <div>
          <h3>Tasks for this lead</h3>
          <p>Shared with everyone who can access this lead.</p>
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
      {busy && !items.length ? <Loading label="Loading lead tasks…" /> : null}
      {!busy && !error && !items.length ? (
        <p>No tasks match this status. Use Remind me to add a follow-up.</p>
      ) : null}
      {items.map((t) => (
        <div className="lead-task-shared-row" key={t.id}>
          <button className="lead-task task-work-card" onClick={()=>onOpen(t)}>
            <span><strong>{t.title}</strong><small>{displayDate(t.dueAt,timezone)}</small><small>Responsible: {t.responsible?.name || 'Member unavailable'}</small></span>
            <span className="task-state">{t.state}</span>
          </button>
          {t.canManage && (t.state === 'Pending' || t.state === 'Completed') ? <button className="button" disabled={busy} onClick={() => onChange(t, t.state === 'Pending' ? 'complete' : 'reopen')}>{t.state === 'Pending' ? 'Complete task' : 'Reopen task'}</button> : null}
        </div>
      ))}
      {nextCursor ? (
        <button
          className="button"
          disabled={busy}
          onClick={() => void load(nextCursor)}
        >
          Load more tasks
        </button>
      ) : null}
    </div>
  );
}
