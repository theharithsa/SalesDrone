import { useEffect, useRef, useState } from 'react';
import { ErrorMessage, SaveButton } from './UI';
import { commentAttempt } from '../lib/comment-attempt';
export default function InlineCommentComposer({
  leadId,
  version,
  request,
  onSaved,
  disabled = false,
}: {
  leadId: string;
  version: number;
  request: (p: string, m: string, b: unknown, k: string) => Promise<any>;
  onSaved: () => Promise<void>;
  disabled?: boolean;
}) {
  const [notes, setNotes] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const alive = useRef(true),
    lock = useRef(false),
    attempt = useRef<ReturnType<typeof commentAttempt> | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current || disabled) return;
    setError('');
    setMessage('');
    let write;
    try {
      write = commentAttempt(attempt.current, notes, version);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    attempt.current = write;
    lock.current = true;
    setBusy(true);
    let saved = false;
    try {
      await request(
        '/leads/' + encodeURIComponent(leadId) + '/activities',
        'POST',
        {
          type: 'note',
          notes: write.notes,
          expectedVersion: write.expectedVersion,
        },
        write.key,
      );
      saved = true;
      if (!alive.current) return;
      attempt.current = null;
      setNotes('');
      setMessage(
        'Comment posted. Dated follow-ups will be checked in the background.',
      );
      await onSaved();
    } catch (e) {
      if (alive.current) {
        const code = (e as { code?: string }).code;
        if (
          !saved &&
          ['CONFLICT', 'VERSION_CONFLICT', 'STALE_VERSION'].includes(code || '')
        ) {
          attempt.current = null;
          try {
            await onSaved();
          } catch {}
        }
        if (!alive.current) return;
        setError(
          saved
            ? 'Comment posted, but the timeline could not refresh. Refresh the workspace to see it.'
            : (e as Error).message,
        );
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <form className="inline-comment-composer" onSubmit={post} aria-busy={busy}>
      <label htmlFor="lead-inline-comment">Write a comment</label>
      <textarea
        id="lead-inline-comment"
        name="notes"
        rows={4}
        maxLength={4000}
        value={notes}
        disabled={busy || disabled}
        onChange={(e) => {
          setNotes(e.target.value);
          setMessage('');
        }}
        placeholder="Add context or a next step, e.g. call next Tuesday at 10 am."
        aria-describedby="inline-comment-help"
      />
      <p className="field-hint" id="inline-comment-help">
        Each post becomes a timeline entry. Clear, dated follow-ups are checked
        for automatic reminders.
      </p>
      <ErrorMessage error={error} />
      <p className="composer-status" role="status">
        {message}
      </p>
      <div className="composer-footer">
        <span>{notes.length.toLocaleString()} / 4,000</span>
        <SaveButton
          busy={busy}
          disabled={disabled || !notes.trim()}
          label="Post comment"
        />
      </div>
    </form>
  );
}
