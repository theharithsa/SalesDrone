import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,renderHook,act,waitFor} from '@testing-library/react';
import LeadTaskTab from '../src/components/LeadTaskTab';
import { useLeadTasks } from '../src/lib/use-lead-tasks';
import type { ComponentProps } from 'react';

type Props = Omit<ComponentProps<typeof LeadTaskTab>, 'allTasks' | 'scope'>;
function Workspace(props: Props) {
  const scope = 'test-member';
  const allTasks = useLeadTasks({ ...props, scope });
  return <LeadTaskTab {...props} scope={scope} allTasks={allTasks} />;
}

describe('Shared tasks on a lead', () => {
  const task = { id: 'task', leadId: 'lead', title: 'Fictional work',
    dueAt: '2026-11-10T10:00:00Z', timezone: 'UTC', state: 'Pending', version: 2,
    canManage: true, responsible: { name: 'Another member' } };
  it.each([['Pending', 'Complete task', 'complete'], ['Completed', 'Reopen task', 'reopen']])(
    'opens the comment flow for a %s task', async (state, button, action) => {
      const onChange = vi.fn();
      const request = vi.fn(async () => ({items: [{...task, state}], nextCursor: null}));
      render(<Workspace leadId="lead" request={request} timezone="Asia/Kolkata" refreshKey={0} onOpen={() => {}} onChange={onChange} />);
      await screen.findByText('Responsible: Another member');
      fireEvent.click(screen.getByRole('button', {name: button}));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({id: task.id, version: task.version}), action);
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
  it('offers read-only viewers the shared context without a change control', async () => {
    render(<Workspace leadId="lead" request={async () => ({items: [{...task, canManage: false}], nextCursor: null})}
      timezone="Asia/Kolkata" refreshKey={0} onOpen={() => {}} onChange={vi.fn()} />);
    await screen.findByText('Responsible: Another member');
    expect(screen.queryByRole('button', {name: 'Complete task'})).not.toBeInTheDocument();
  });

  it('keeps sparse pagination available and merges overlapping tasks once', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ items: [], nextCursor: 'first' })
      .mockResolvedValueOnce({ items: [task], nextCursor: 'second' })
      .mockResolvedValueOnce({ items: [{ ...task, version: 3 }], nextCursor: null });
    const { result } = renderHook(() => useLeadTasks({ leadId: 'lead', scope: 'viewer', refreshKey: 0, request }));
    await waitFor(() => expect(result.current.nextCursor).toBe('first'));
    await act(() => result.current.load('first'));
    await act(() => result.current.load('second'));
    expect(request).toHaveBeenNthCalledWith(2, '/leads/lead/tasks?limit=50&cursor=first');
    expect(result.current.items).toEqual([{ ...task, version: 3 }]);
    expect(result.current.nextCursor).toBeNull();
  });

  it('discards in-flight pages after the lead or access scope changes', async () => {
    let settleOldPage!: (page: { items: (typeof task)[]; nextCursor: string | null }) => void;
    const oldPage = new Promise<{ items: (typeof task)[]; nextCursor: string | null }>((resolve) => {
      settleOldPage = resolve;
    });
    const request = vi.fn()
      .mockReturnValueOnce(oldPage)
      .mockResolvedValueOnce({ items: [{ ...task, id: 'new-task', leadId: 'new-lead' }], nextCursor: null });
    const { result, rerender } = renderHook(
      (props) => useLeadTasks({ ...props, refreshKey: 0, request }),
      { initialProps: { leadId: 'lead', scope: 'first-member' } },
    );
    rerender({ leadId: 'new-lead', scope: 'second-member' });
    await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual(['new-task']));
    await act(() => settleOldPage({ items: [task], nextCursor: 'old-cursor' }));
    expect(result.current.items.map((item) => item.id)).toEqual(['new-task']);
    expect(result.current.nextCursor).toBeNull();
  });

});
