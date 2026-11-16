import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api';
import { appendUniqueRows } from './lead-pagination';
import type { Task } from './types';

type TaskPage = { items: Task[]; nextCursor: string | null };
type TaskPageState = TaskPage & { busy: boolean; error: string };
type LeadTaskOptions = {
  leadId: string | null;
  scope: string;
  refreshKey: number;
  request: (path: string) => Promise<TaskPage>;
  state?: string;
};

const emptyPage: TaskPageState = { items: [], nextCursor: null, busy: false, error: '' };

export function useLeadTasks({ leadId, scope, refreshKey, request, state }: LeadTaskOptions) {
  const key = JSON.stringify([leadId, scope, refreshKey, state]);
  const [page, setPage] = useState({ key: '', ...emptyPage });
  const lifecycle = useRef({ epoch: 0, loading: false });

  const load = useCallback(async (cursor?: string) => {
    const active = lifecycle.current;
    if (!leadId || active.loading) return;
    active.loading = true;
    const current = ++active.epoch;
    setPage((previous) => ({
      ...(previous.key === key && cursor ? previous : emptyPage),
      key, busy: true, error: '',
    }));

    try {
      const query = new URLSearchParams({ limit: '50' });
      if (state) query.set('state', state);
      if (cursor) query.set('cursor', cursor);
      const result = await request('/leads/' + encodeURIComponent(leadId) + '/tasks?' + query);
      if (current !== active.epoch) return;
      setPage((previous) => ({
        key,
        items: cursor ? appendUniqueRows(previous.items, result.items) : result.items,
        nextCursor: result.nextCursor, busy: false, error: '',
      }));
    } catch (error) {
      if (current !== active.epoch) return;
      const accessLost = error instanceof ApiError && [401, 403, 404].includes(error.status);
      setPage((previous) => ({
        ...(accessLost ? emptyPage : previous),
        key, busy: false, error: (error as Error).message,
      }));
    } finally {
      if (current === active.epoch) active.loading = false;
    }
  }, [key, leadId, request, state]);

  useEffect(() => {
    const active = lifecycle.current;
    void load();
    return () => {
      active.epoch++;
      active.loading = false;
    };
  }, [load]);

  const visible = page.key === key ? page : { ...emptyPage, busy: !!leadId };
  return { ...visible, load };
}

export type LeadTaskPages = ReturnType<typeof useLeadTasks>;
