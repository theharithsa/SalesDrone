import { Task } from '../lib/types';
import { ErrorMessage, useSubmit } from './UI';
export default function TaskDeleteForm({
  task,
  onDelete,
  onCancel,
}: {
  task: Task;
  onDelete: () => Promise<void>;
  onCancel: () => void;
}) {
  const submit = useSubmit(async () => {
    await onDelete();
    onCancel();
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit.run({});
      }}
    >
      <p>
        Delete “{task.title}” from your task list? Its pending reminder will be
        cancelled.
      </p>
      <ErrorMessage error={submit.error} />
      <div className="form-footer">
        <button
          className="button"
          type="button"
          onClick={onCancel}
          disabled={submit.busy}
        >
          Keep task
        </button>
        <button className="button danger" disabled={submit.busy}>
          {submit.busy ? 'Deleting…' : 'Delete task'}
        </button>
      </div>
    </form>
  );
}
