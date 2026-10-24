import { Task } from '../lib/types';
import { localInstant } from '../lib/dates';
import { ErrorMessage, SaveButton, useSubmit } from './UI';
const localTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
export default function TaskEditForm({
  task,
  onSave,
  onCancel,
}: {
  task: Task;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const submit = useSubmit(async (data) => {
    const { localDueAt, ...fields } = data;
    await onSave({ ...fields, dueAt: localInstant(localDueAt) });
    onCancel();
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        submit.run({
          expectedVersion: task.version,
          title: String(d.get('title')),
          localDueAt: String(d.get('dueAt')),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          kind: String(d.get('kind')),
          state:String(d.get('state')),
        });
      }}
    >
      <label>
        Task title
        <input
          name="title"
          defaultValue={task.title}
          required
          maxLength={250}
          autoFocus
        />
      </label>
      <div className="form-grid">
        <label>
          Due date and time
          <input
            name="dueAt"
            type="datetime-local"
            defaultValue={localTime(task.dueAt)}
            required
          />
        </label>
        <label>
          Task type
          <select name="kind" defaultValue={task.kind || 'outreach'}>
            <option value="outreach">Outreach</option>
            <option value="administrative">Administrative</option>
          </select>
        </label>
        <label>Status<select name="state" defaultValue={task.state}>{['Pending','Completed','Cancelled'].map(value=><option key={value}>{value}</option>)}</select></label>
      </div>
      <p className="field-hint">
        Entered in {Intl.DateTimeFormat().resolvedOptions().timeZone}. Your lead
        link and reminder history stay with the task.
      </p>
      <ErrorMessage error={submit.error} />
      <div className="form-footer">
        <button
          className="button"
          type="button"
          onClick={onCancel}
          disabled={submit.busy}
        >
          Cancel
        </button>
        <SaveButton busy={submit.busy} label="Save task" />
      </div>
    </form>
  );
}
