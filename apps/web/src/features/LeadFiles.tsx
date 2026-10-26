import { useEffect, useRef, useState } from 'react';
import { FileUp, FileText, Download, Trash2 } from 'lucide-react';
import { ErrorMessage } from '../components/UI';
import { downloadFileBytes, uploadFileBytes } from '../lib/api';
import FILE_TYPES from '../../../../functions/src/attachment-types.json';
const MAX = 8 * 1024 * 1024;
type Attachment = {
  id: string;
  name: string;
  size: number;
  contentType: string;
  version: number;
  createdAt: string;
  state: string;
};
const size = (n: number) =>
  n < 1024 * 1024
    ? `${Math.ceil(n / 1024)} KB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;
export default function LeadFiles({
  leadId,
  request,
  demo,
  canEdit,
}: {
  leadId: string;
  request: (p: string, m?: string, b?: any, k?: string) => Promise<any>;
  demo: boolean;
  canEdit: boolean;
}) {
  const [items, setItems] = useState<Attachment[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [confirm, setConfirm] = useState<string | null>(null),
    [pending, setPending] = useState<{ file: File; record: Attachment } | null>(
      null,
    ),
    [status, setStatus] = useState('');
  const controller = useRef<AbortController | null>(null),
    alive = useRef(true),
    demoFiles = useRef(new Map<string, File>()),
    input = useRef<HTMLInputElement>(null);
  const base = '/leads/' + leadId + '/attachments';
  async function load(more = false) {
    if (demo) return;
    setError('');
    try {
      const r = await request(
        base +
          '?limit=30' +
          (more && cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
      );
      if (alive.current) {
        setItems((old) => (more ? [...old, ...r.items] : r.items));
        setCursor(r.nextCursor);
        setPending((current) =>
          current &&
          r.items.some((item: Attachment) => item.id === current.record.id)
            ? null
            : current,
        );
      }
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    }
  }
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
      controller.current?.abort();
      demoFiles.current.clear();
    };
  }, [leadId, request, demo]);
  async function upload(file: File, existing?: Attachment) {
    setError('');
    const ext = file.name.split('.').pop()?.toLowerCase() || '',
      contentType = FILE_TYPES[ext as keyof typeof FILE_TYPES];
    if (!contentType || !file.size || file.size > MAX) {
      setError('Choose a supported photo or document up to 8 MB.');
      return;
    }
    setBusy(true);
    setProgress(0);
    setStatus('Preparing upload…');
    let record = existing;
    try {
      if (!record)
        record = demo
          ? {
              id: crypto.randomUUID(),
              name: file.name,
              size: file.size,
              contentType,
              version: 1,
              state: 'Pending',
              createdAt: new Date().toISOString(),
            }
          : await request(
              base,
              'POST',
              { name: file.name, size: file.size, contentType },
              crypto.randomUUID(),
            );
      if (!alive.current) return;
      setPending({ file, record: record! });
      setStatus('Uploading file…');
      controller.current = new AbortController();
      let ready: Attachment;
      if (demo) {
        demoFiles.current.set(record!.id, file);
        ready = { ...record!, state: 'Ready', version: 2 };
        setProgress(100);
      } else
        ready = await uploadFileBytes(
          base + '/' + record!.id + '/content',
          file,
          (value) => {
            if (alive.current) setProgress(value);
          },
          controller.current.signal,
        );
      if (!alive.current) return;
      setItems((old) => [ready, ...old.filter((x) => x.id !== ready.id)]);
      setPending(null);
      setStatus('File uploaded.');
    } catch (e) {
      if (alive.current) {
        setError(
          (e as Error).name === 'AbortError'
            ? 'Upload cancelled. You can retry or discard this pending upload.'
            : (e as Error).message,
        );
        setStatus('Upload not completed.');
      }
    } finally {
      if (alive.current) setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
  async function download(item: Attachment) {
    setError('');
    setBusy(true);
    try {
      const blob = demo
        ? demoFiles.current.get(item.id)
        : await downloadFileBytes(base + '/' + item.id + '/content');
      if (!blob)
        throw Error('Demo file is unavailable after leaving this page.');
      if (!alive.current) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('Download started.');
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function remove(item: Attachment) {
    setBusy(true);
    setError('');
    try {
      if (!demo)
        await request(base + '/' + item.id, 'DELETE', {
          expectedVersion: item.version,
        });
      if (!alive.current) return;
      demoFiles.current.delete(item.id);
      setItems((old) => old.filter((x) => x.id !== item.id));
      if (pending?.record.id === item.id) setPending(null);
      setConfirm(null);
      setStatus('File removed.');
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section className="lead-files">
      <div className="lead-files-heading">
        <div>
          <h3>Files for this lead</h3>
          <p className="field-hint">
            Photos, PDFs, Office documents, text and CSV. Up to 8 MB per file
            and 50 files per lead.
          </p>
        </div>
        {!demo && (
          <button className="button" disabled={busy} onClick={() => load()}>
            Refresh files
          </button>
        )}
        {canEdit && (
          <label className={'button ' + (busy ? 'disabled' : '')}>
            <FileUp size={16} />
            Upload file
            <input
              ref={input}
              type="file"
              aria-label="Upload lead attachment"
              accept={Object.keys(FILE_TYPES)
                .map((x) => '.' + x)
                .join(',')}
              disabled={busy || !!pending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
            />
          </label>
        )}
      </div>
      {demo && (
        <p className="field-hint">
          Demo files stay in this page’s memory and are never sent to Firebase.
          Leaving this page clears them.
        </p>
      )}
      <ErrorMessage error={error} />
      <p role="status" className="field-hint">
        {status}
      </p>
      {busy && pending && (
        <div className="file-progress">
          <progress
            max={100}
            value={progress}
            aria-label="File upload progress"
          />
          <span>{progress === 100 ? 'Finishing…' : progress + '%'}</span>
          <button
            className="button"
            onClick={() => controller.current?.abort()}
          >
            Cancel upload
          </button>
        </div>
      )}
      {!busy && pending && (
        <div className="pending-file">
          <span>Unfinished upload: {pending.file.name}</span>
          <button
            className="button"
            onClick={() => upload(pending.file, pending.record)}
          >
            Retry upload
          </button>
          <button className="button" onClick={() => remove(pending.record)}>
            Discard pending upload
          </button>
        </div>
      )}
      {!items.length && !busy && <p>No files have been added to this lead.</p>}
      <ul className="lead-file-list">
        {items.map((item) => (
          <li key={item.id}>
            <FileText size={20} aria-hidden="true" />
            <div className="file-description">
              <strong>{item.name}</strong>
              <span>
                {size(item.size)} ·{' '}
                {new Date(item.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="file-actions">
              <button
                className="button"
                disabled={busy}
                onClick={() => download(item)}
              >
                <Download size={16} />
                Download
              </button>
              {canEdit && (
                <button
                  className="button danger-button"
                  disabled={busy}
                  onClick={() => setConfirm(item.id)}
                >
                  <Trash2 size={16} />
                  Remove
                </button>
              )}
            </div>
            {confirm === item.id && (
              <div
                className="file-remove-confirm"
                role="group"
                aria-label="Confirm file removal"
              >
                <p>
                  Remove this file from the lead? It will no longer be available
                  in SalesDrone.
                </p>
                <button
                  className="button danger-button"
                  disabled={busy}
                  onClick={() => remove(item)}
                >
                  Confirm removal
                </button>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => setConfirm(null)}
                >
                  Keep file
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {cursor && (
        <button className="button" disabled={busy} onClick={() => load(true)}>
          Load more files
        </button>
      )}
    </section>
  );
}
