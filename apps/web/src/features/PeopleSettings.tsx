import { useCallback, useEffect, useState } from 'react';
import MembersPage from './MembersPage';
import { Entity } from '../lib/types';
import { ErrorMessage, Loading } from '../components/UI';
export default function PeopleSettings({
  request,
}: {
  request: (p: string, m?: string, b?: any, k?: string) => Promise<any>;
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
      const [m, i] = await Promise.all([
        request('/members?limit=100'),
        request('/invitations?limit=100'),
      ]);
      setMembers(m.items);
      setInvitations(i.items);
      setCursors({ members: m.nextCursor, invitations: i.nextCursor });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [request]);
  useEffect(() => {
    void load();
  }, [load]);
  async function more(kind: 'members' | 'invitations') {
    setBusy(true);
    setError('');
    try {
      const r = await request(
        '/' + kind + '?limit=100&cursor=' + encodeURIComponent(cursors[kind]!),
      );
      if (kind === 'members') setMembers((old) => [...old, ...r.items]);
      else setInvitations((old) => [...old, ...r.items]);
      setCursors((old) => ({ ...old, [kind]: r.nextCursor }));
    } catch (e) {
      setError((e as Error).message);
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
