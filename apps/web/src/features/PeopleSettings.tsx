import type { ApiClient } from '../lib/api';
import { errorMessage } from '../lib/error-message';
import { useCallback, useEffect, useState } from 'react';
import MembersPage from './MembersPage';
import { Entity } from '../lib/types';
import { ErrorMessage, Loading } from '../components/UI';
function memberPage(payload: unknown): { items: Entity[]; nextCursor: string | null } {
  if (!payload || typeof payload !== 'object' || !('items' in payload)
      || !Array.isArray(payload.items) || !('nextCursor' in payload)
      || (payload.nextCursor !== null && typeof payload.nextCursor !== 'string')
      || !payload.items.every((item: unknown) => item && typeof item === 'object'
        && 'id' in item && typeof item.id === 'string')) {
    throw new Error('The people list could not be loaded. Try again.');
  }
  return { items: payload.items, nextCursor: payload.nextCursor };
}

export default function PeopleSettings({
  request,
}: {
  request: ApiClient;
}) {
  const [members, setMembers] = useState<Entity[]>([]),
    [invitations, setInvitations] = useState<Entity[]>([]),
    [cursors, setCursors] = useState({
      members: null as string | null,
      invitations: null as string | null,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const [membersResult, invitationsResult] = await Promise.all([
        request('/members?limit=100'),
        request('/invitations?limit=100'),
      ]);
      const m = memberPage(membersResult);
      const i = memberPage(invitationsResult);
      setMembers(m.items);
      setInvitations(i.items);
      setCursors({ members: m.nextCursor, invitations: i.nextCursor });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [request]);
  useEffect(() => {
    void load();
  }, [load]);
  async function more(kind: 'members' | 'invitations') {
    const cursor = cursors[kind];
    if (!cursor) return;
    setBusy(true);
    setError('');
    try {
      const r = memberPage(await request(
        '/' + kind + '?limit=100&cursor=' + encodeURIComponent(cursor),
      ));
      if (kind === 'members') setMembers((old) => [...old, ...r.items]);
      else setInvitations((old) => [...old, ...r.items]);
      setCursors((old) => ({ ...old, [kind]: r.nextCursor }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="people-settings">
      <ErrorMessage error={error} />
      {busy && !members.length ? (
        <Loading />
      ) : (
        <MembersPage
          embedded
          members={members}
          invitations={invitations}
          request={request}
          onRefresh={() => void load()}
        />
      )}
      <div className="people-pagination">
        {cursors.members ? (
          <button
            className="button"
            disabled={busy}
            onClick={() => void more('members')}
          >
            Load more members
          </button>
        ) : null}
        {cursors.invitations ? (
          <button
            className="button"
            disabled={busy}
            onClick={() => void more('invitations')}
          >
            Load more invitations
          </button>
        ) : null}
      </div>
    </div>
  );
}
