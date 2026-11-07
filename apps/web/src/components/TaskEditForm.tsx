import { useState } from 'react';
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
  const [dueAt, setDueAt] = useState(localTime(task.dueAt));
  const dateChanged = dueAt !== localTime(task.dueAt);
  const submit = useSubmit(async (data, _key, isCurrent) => {
    const { localDueAt, ...fields } = data;
    await onSave({ ...fields, ...(dateChanged ? { dueAt: localInstant(localDueAt) } : {}) });
    if (isCurrent()) onCancel();
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
          ...(dateChanged ? { comment: String(d.get('comment')) } : {}),
        });
      }}
    >
      <label className="material-field">
        <span className="field-label">Task title</span>
        <input
          name="title"
          defaultValue={task.title}
          required
          maxLength={250}
          autoFocus
        />
      </label>
      <div className="form-grid">
        <label className="material-field">
          <span className="field-label">Due date and time</span>
          <input
            name="dueAt"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            disabled={task.state !== 'Pending'}
            required
          />
        </label>
        <label className="material-field">
          <span className="field-label">Task type</span>
          <select name="kind" defaultValue={task.kind || 'outreach'}>
            <option value="outreach">Outreach</option>
            <option value="administrative">Administrative</option>
          </select>
        </label>
      </div>
      {dateChanged ? <label className="material-field">
        <span className="field-label">Reschedule comment</span>
        <textarea name="comment" required maxLength={500} rows={3} />
      </label> : null}
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
