import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import LeadTaskTab from '../src/components/LeadTaskTab';

describe('Shared tasks on a lead', () => {
  const task = { id: 'task', leadId: 'lead', title: 'Fictional work',
    dueAt: '2026-11-10T10:00:00Z', state: 'Pending', version: 2,
    canManage: true, responsible: { name: 'Another member' } };
  it.each([['Pending', 'Complete task', 'complete'], ['Completed', 'Reopen task', 'reopen']])(
    'opens the comment flow for a %s task', async (state, button, action) => {
      const onChange = vi.fn();
      const request = vi.fn(async () => ({items: [{...task, state}], nextCursor: null}));
      render(<LeadTaskTab leadId="lead" request={request} timezone="Asia/Kolkata" refreshKey={0} onOpen={() => {}} onChange={onChange} />);
      await screen.findByText('Responsible: Another member');
      fireEvent.click(screen.getByRole('button', {name: button}));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({id: task.id, version: task.version}), action);
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
  it('offers read-only viewers the shared context without a change control', async () => {
    render(<LeadTaskTab leadId="lead" request={async () => ({items: [{...task, canManage: false}]})}
      timezone="Asia/Kolkata" refreshKey={0} onOpen={() => {}} onChange={vi.fn()} />);
    await screen.findByText('Responsible: Another member');
    expect(screen.queryByRole('button', {name: 'Complete task'})).not.toBeInTheDocument();
  });
});
