import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Trash2, RefreshCw } from 'lucide-react';
import { ErrorMessage, Modal } from '../components/UI';

type Request = (
  path: string,
  method?: string,
  body?: any,
  key?: string,
) => Promise<any>;
type Job = {
  id: string;
  status: 'Waiting' | 'Running' | 'Blocked' | 'Completed';
  phase: string;
  version: number;
  deletedRecords: number;
  deletedFiles: number;
  lastError: string | null;
};
type Status = { active: boolean; job: Job | null };
type Preview = {
  previewId: string;
  expiresAt: string;
  counts: { leads: number; archived: number };
};
export default function LeadDataSettings({
  request,
  onChanged,
}: {
  request: Request;
  onChanged: () => void;
}) {
  const [status, setStatus] = useState<Status | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [confirmation, setConfirmation] = useState(''),
    [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const key = useRef(crypto.randomUUID()),
    trigger = useRef<HTMLButtonElement>(null),
    alive = useRef(true),
    lock = useRef(false),
    seenActive = useRef(false);
  const load = useCallback(async () => {
    try {
      const result: Status = await request('/lead-data-reset');
      if (!alive.current) return;
      setStatus(result);
      if (result.active) seenActive.current = true;
      else if (seenActive.current) {
        seenActive.current = false;
        onChanged();
      }
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    }
  }, [request, onChanged]);
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);
  useEffect(() => {
    if (!status?.active) return;
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [status?.active, load]);
  async function review() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const p: Preview = await request('/lead-data-reset/preview', 'POST', {});
      if (!alive.current) return;
      key.current = crypto.randomUUID();
      setConfirmation('');
      setAck(false);
      setPreview(p);
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function confirm() {
    if (!preview || confirmation !== 'DELETE ALL LEADS' || !ack || lock.current)
      return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const job: Job = await request(
        '/lead-data-reset',
        'POST',
        { previewId: preview.previewId, confirmation },
        key.current,
      );
      if (!alive.current) return;
      setPreview(null);
      setStatus({ active: job.status !== 'Completed', job });
      seenActive.current = job.status !== 'Completed';
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function resume() {
    if (!status?.job || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await request(`/lead-data-reset/${status.job.id}/resume`, 'POST', {
        expectedVersion: status.job.version,
      });
      await load();
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section className="panel lead-data-settings">
      <div className="section-heading">
        <div>
          <h3>
            <Trash2 size={20} /> Clear lead data
          </h3>
          <p>
            Permanently remove every active and archived lead from this
            workspace.
          </p>
        </div>
      </div>
      <div className="notice lead-data-warning">
        <AlertTriangle size={22} />
        <div>
          <strong>This cannot be undone in SalesDrone.</strong>
          <p>
            Deletes related conversations, history, scores, tasks, files, import
            data and lead notifications for all members. Export anything you
            need before continuing.
          </p>
        </div>
      </div>
      <p className="field-hint">
        Users, permissions, workspace settings, personal preferences and
        reminders without a lead are retained. Security audit and telemetry
        delivery evidence stay intact. Existing API retries from before the
        reset expire.
      </p>
      <ErrorMessage error={!preview ? error : ''} />
      {!status ? (
        <>
          <p role="status">Loading data-management status…</p>
          <button className="button" type="button" onClick={() => void load()}>
            Reload status
          </button>
        </>
      ) : null}
      {status?.active ? (
        <div className="lead-reset-progress" role="status" aria-live="polite">
          <h4>
            {status.job?.status === 'Blocked'
              ? 'Cleanup paused'
              : status.job?.status === 'Waiting'
                ? 'Preparing cleanup'
                : 'Clearing lead data'}
          </h4>
          <p>
            {status.job?.status === 'Waiting'
              ? 'Waiting five minutes for in-flight operations to finish. Lead changes and background processing are paused.'
              : status.job?.status === 'Blocked'
                ? status.job.lastError
                : 'Cleanup runs in batches in the background. Lead changes remain paused until it finishes.'}
          </p>
          <p>
            {status.job?.deletedRecords || 0} records removed ·{' '}
            {status.job?.deletedFiles || 0} files removed
          </p>
          <p>
            You can leave this page and return to check progress. An accepted
            cleanup cannot be cancelled.
          </p>
          {status.job?.status === 'Blocked' ? (
            <button
              className="button"
              disabled={busy}
              onClick={() => void resume()}
            >
              Retry cleanup
            </button>
          ) : null}
          <button type="button" className="button" onClick={() => void load()}>
            <RefreshCw size={16} /> Refresh status
          </button>
        </div>
      ) : null}
      {status && !status.active ? (
        <>
          {status.job?.status === 'Completed' ? (
            <p role="status" className="success-message">
              Lead cleanup completed. You can import or create leads again.
            </p>
          ) : null}
          <button
            type="button"
            className="button danger"
            ref={trigger}
            disabled={busy}
            onClick={() => void review()}
          >
            {busy ? 'Preparing review…' : 'Review clearing all leads'}
          </button>
        </>
      ) : null}
      <Modal
        open={!!preview}
        onClose={() => {
          if (!busy) setPreview(null);
        }}
        title="Permanently clear all lead data?"
        description="This affects every member and includes archived leads. It cannot be undone in SalesDrone."
        returnFocusRef={trigger}
      >
        <form
          className="lead-reset-review"
          onSubmit={(e) => {
            e.preventDefault();
            void confirm();
          }}
        >
          <p>
            <strong>{preview?.counts.leads || 0} leads</strong> currently
            counted, including{' '}
            <strong>{preview?.counts.archived || 0} archived</strong>. Counts
            are a preview; leads added before confirmation are included too.
          </p>
          <p>
            Related notes, calls, tasks, files, scores, history, imports and
            lead notifications will be permanently deleted. Users, permissions
            and configuration are retained.
          </p>
          <label>
            Type DELETE ALL LEADS to confirm
            <input
              autoComplete="off"
              spellCheck={false}
              value={confirmation}
              disabled={busy}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={ack}
              disabled={busy}
              onChange={(e) => setAck(e.target.checked)}
            />{' '}
            I understand this permanently deletes lead data for everyone.
          </label>
          <ErrorMessage error={error} />
          <div className="form-actions">
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => setPreview(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button danger"
              disabled={busy || confirmation !== 'DELETE ALL LEADS' || !ack}
            >
              {busy ? 'Starting cleanup…' : 'Permanently clear lead data'}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
