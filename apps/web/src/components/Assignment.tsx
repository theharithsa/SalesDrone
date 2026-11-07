import { useEffect, useRef, useState } from 'react';
import { Lead, Entity } from '../lib/types';
import { ErrorMessage } from './UI';
export default function Assignment({
  compact = false,
  lead,
  request,
  onSaved,
}: {
  compact?: boolean;
  lead: Lead;
  request: (p: string, m?: string, b?: any, k?: string) => Promise<any>;
  onSaved: () => Promise<void>;
}) {
  const [members, setMembers] = useState<Entity[]>([]),
    [loadingMembers, setLoadingMembers] = useState(true),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [target, setTarget] = useState(lead.assignedToUid || '');
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setLoadingMembers(true);
    request('/members?limit=100')
      .then((r) => {
        if (active) {
          setMembers(r.items);
          setLoadingMembers(false);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [request]);
  return (
    <div className={compact ? 'assignment-control' : 'detail-section'}>
      <h3>Assigned to</h3>
      <select
        value={target}
        disabled={busy || loadingMembers}
        aria-label="Assign lead"
        onChange={(e) => setTarget(e.target.value)}
      >
        {loadingMembers && lead.assignedToUid ? (
          <option value={lead.assignedToUid}>Loading assignee…</option>
        ) : null}
        <option value="">Unassigned</option>
        {members
          .filter((m) => m.active && m.capabilities.includes('leads:read'))
          .map((m) => (
            <option key={m.id} value={m.uid}>
              {m.name || m.email}
            </option>
          ))}
      </select>
      <button type="button" className="button" disabled={busy || loadingMembers || target === (lead.assignedToUid || '')}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            await request('/leads/' + lead.id + '/assignment', 'PATCH', {
              assignedToUid: target || null,
              expectedVersion: lead.version,
            });
            if (mounted.current) await onSaved();
          } catch (e) {
            if (mounted.current) setError((e as Error).message);
          } finally {
            if (mounted.current) setBusy(false);
          }
        }}>Save assignment</button>
      <details className="assignment-help">
        <summary>About reassignment</summary>
        <p className="field-hint">
          Reassignment cancels pending outreach tasks. Set the next reminder for the
          new owner.
        </p>
      </details>
      <ErrorMessage error={error} />
    </div>
  );
}
