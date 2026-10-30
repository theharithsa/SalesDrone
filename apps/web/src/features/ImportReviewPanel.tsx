import { useCallback, useEffect, useRef, useState } from 'react';
import { Trash2, RefreshCw, Download, ChevronRight } from 'lucide-react';
import { ErrorMessage } from '../components/UI';
type Request = (
  path: string,
  method?: string,
  body?: any,
  key?: string,
) => Promise<any>;
type Job = Record<string, any>;
function RowReview({
  row,
  job,
  disabled,
  decide,
}: {
  row: any;
  job: Job;
  disabled: boolean;
  decide: (index: number, body: any) => void;
}) {
  const changes = [
    ...(row.changes || []),
    ...(row.commentChanges || []).map((c: any) => ({
      ...c,
      key: 'comment:' + c.key,
      label: c.sourceColumn,
    })),
  ];
  const [incoming, setIncoming] = useState<string[]>(
    row.incomingFields ||
      changes.filter((c: any) => !c.conflict).map((c: any) => c.key),
  );
  const [clear, setClear] = useState<string[]>(row.clearFields || []),
    [target, setTarget] = useState(row.leadId || '');
  const finished = !!row.outcome || job.status === 'DetailsDeleted';
  const text = (v: any) =>
    v === null || v === undefined || v === ''
      ? 'Empty'
      : typeof v === 'object'
        ? JSON.stringify(v)
        : String(v);
  return (
    <article className="import-result-card">
      <header>
        <div>
          <strong>{row.row?.name || 'Worksheet row ' + row.sourceRow}</strong>
          <small>
            Row {row.sourceRow} ·{' '}
            {row.row?.phone || row.row?.email || 'No contact supplied'}
          </small>
        </div>
        <span className="role-label">
          {row.outcome || row.classification || 'Preparing'}
        </span>
      </header>
      <p className="field-hint">
        {row.error || row.reason}{' '}
        {row.decision === 'accept'
          ? 'Approved'
          : row.decision === 'skip'
            ? 'Skipped'
            : ''}
      </p>
      {row.relatedRows?.length > 1 ? (
        <p className="field-hint">
          Overlapping worksheet rows:{' '}
          {(
            row.relatedSourceRows || row.relatedRows.map((n: number) => n + 1)
          ).join(', ')}
          . Review each row explicitly.
        </p>
      ) : null}
      {row.candidates?.length ? (
        <div className="import-candidates">
          <h4>Existing matches</h4>
          {row.candidates.map((c: any) => (
            <div key={c.id}>
              <strong>{c.name || 'Unnamed enquiry'}</strong>
              <span>
                {c.phone || c.email || 'No contact'} ·{' '}
                {c.company || 'No company'}
              </span>
              <a
                href={'/leads/' + encodeURIComponent(c.id)}
                target="_blank"
                rel="noreferrer"
              >
                View lead
              </a>
            </div>
          ))}
        </div>
      ) : null}
      {changes.length ? (
        <fieldset disabled={disabled || finished}>
          <legend>Changes to review</legend>
          <p className="field-hint">
            Checked values use the workbook. Unchecked values keep the database
            value. Conflicts start unchecked.
          </p>
          {changes.map((c: any) => (
            <label className="import-field-diff" key={c.key}>
              <input
                type="checkbox"
                checked={incoming.includes(c.key)}
                onChange={(e) =>
                  setIncoming((old) =>
                    e.target.checked
                      ? [...old, c.key]
                      : old.filter((k) => k !== c.key),
                  )
                }
              />
              <span>
                <strong>
                  {c.label || c.key}
                  {c.conflict ? ' · Needs your decision' : ''}
                </strong>
                {Object.hasOwn(c, 'previous') ? (
                  <small>Previously imported: {text(c.previous)}</small>
                ) : null}
                <small>Current: {text(c.current)}</small>
                <small>Workbook: {text(c.incoming)}</small>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {!finished && disabled === false && row.classification !== 'Invalid' ? (
        <div className="import-row-decisions">
          {job.duplicateMode === 'update' &&
          row.classification === 'Conflict' ? (
            <div className="import-match-choice">
              <label>
                Match to an accessible lead
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  <option value="">Choose a candidate</option>
                  {row.candidates?.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.phone || c.email}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Or paste a known SalesDrone lead ID
                <input
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  maxLength={150}
                />
              </label>
              <button
                className="button"
                disabled={!target}
                onClick={() =>
                  decide(row.index, { action: 'match', leadId: target })
                }
              >
                Compare selected lead
              </button>
            </div>
          ) : null}
          {row.mapped?.length &&
          ['Update', 'Unchanged'].includes(row.classification) ? (
            <details>
              <summary>Explicitly clear optional values</summary>
              <p className="field-hint">
                Blank cells otherwise leave saved values unchanged. Clearing is
                deliberate.
              </p>
              {row.mapped
                .filter(
                  (k: string) =>
                    !['name', 'enquiryDate', 'stage', 'countryCode'].includes(
                      k,
                    ),
                )
                .map((key: string) => (
                  <label className="check" key={key}>
                    <input
                      type="checkbox"
                      checked={clear.includes(key)}
                      onChange={(e) =>
                        setClear((old) =>
                          e.target.checked
                            ? [...old, key]
                            : old.filter((k) => k !== key),
                        )
                      }
                    />
                    Clear {key}
                  </label>
                ))}
            </details>
          ) : null}
          <div className="form-actions">
            {['New', 'Update', 'Unchanged', 'Duplicate'].includes(
              row.classification,
            ) ? (
              <button
                className="button"
                onClick={() =>
                  decide(row.index, {
                    action: 'accept',
                    incomingFields: incoming,
                    clearFields: clear,
                  })
                }
              >
                {row.classification === 'Duplicate'
                  ? 'Confirm skip'
                  : 'Accept selected changes'}
              </button>
            ) : null}
            {row.classification === 'Conflict' ? (
              <button
                className="button"
                onClick={() => decide(row.index, { action: 'create' })}
              >
                Create a separate lead
              </button>
            ) : null}
            <button
              className="text-button"
              onClick={() => decide(row.index, { action: 'skip' })}
            >
              Skip this row
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
export default function ImportReviewPanel({
  request,
  job,
  onJob,
  onSource,
  canWrite,
  canDelete,
  onImported,
  externalBusy = false,
}: {
  request: Request;
  job: Job | null;
  onJob: (j: any) => void;
  onSource: (id: string) => void;
  canWrite: boolean;
  canDelete: boolean;
  onImported: () => void;
  externalBusy?: boolean;
}) {
  const [history, setHistory] = useState<Job[]>([]),
    [historyCursor, setHistoryCursor] = useState<string | null>(null),
    [rows, setRows] = useState<any[]>([]),
    [rowCursor, setRowCursor] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [status, setStatus] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const [filters, setFilters] = useState('');
  const rowPage = useRef<string | null>(null);
  const historyGeneration = useRef(0),
    rowGeneration = useRef(0);
  const loadHistory = useCallback(
    async (cursor?: string | null) => {
      const generation = ++historyGeneration.current;
      const page = await request(
        '/imports?limit=20' +
          filters +
          (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
      );
      if (generation !== historyGeneration.current) return;
      setHistory((old) => (cursor ? [...old, ...page.items] : page.items));
      setHistoryCursor(page.nextCursor);
    },
    [request, filters],
  );
  const loadRows = useCallback(
    async (cursor?: string | null) => {
      const generation = ++rowGeneration.current;
      if (!job || job.formatVersion !== 3 || job.status === 'DetailsDeleted') {
        setRows([]);
        setRowCursor(null);
        return;
      }
      rowPage.current = cursor || null;
      const page = await request(
        '/imports/' +
          job.id +
          '/rows?limit=1' +
          (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
      );
      if (generation !== rowGeneration.current) return;
      setRows(page.items);
      setRowCursor(page.nextCursor);
    },
    [request, job?.id, job?.status],
  );
  useEffect(() => {
    let active = true;
    loadHistory().catch((e) => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
      historyGeneration.current++;
    };
  }, [loadHistory, job?.id, job?.status]);
  useEffect(() => {
    let active = true;
    loadRows().catch((e) => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
      rowGeneration.current++;
    };
  }, [loadRows]);
  async function operate(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const progress = async (
    j: Job,
    route: string,
    condition: (j: Job) => boolean,
  ) => {
    let current = j;
    while (condition(current)) {
      const previous = current.version;
      current = await request(
        '/imports/' + current.id + '/' + route,
        'POST',
        { expectedVersion: current.version },
        crypto.randomUUID(),
      );
      onJob(current);
      if (current.version === previous)
        throw Error('Import stopped progressing. Reload its status.');
    }
    return current;
  };
  async function decide(index: number, body: any) {
    await operate(async () => {
      const next = await request(
        '/imports/' + job!.id + '/rows/' + index,
        'PATCH',
        { expectedVersion: job!.version, ...body },
      );
      onJob(next);
      await loadRows(rowPage.current);
    });
  }
  const disabled =
    busy || externalBusy || !canWrite || !job || job.status !== 'Preview';
  return (
    <>
      <ErrorMessage error={error} />
      {job?.formatVersion === 3 ? (
        <section className="panel import-review-panel">
          <div className="section-heading">
            <div>
              <h2>{job.filename}</h2>
              <p>
                {job.status} · Uploaded by {job.createdByName || 'Member'}
              </p>
            </div>
            <button
              className="icon-button"
              title="Reload import"
              aria-label="Reload import"
              disabled={busy}
              onClick={() =>
                operate(async () => {
                  onJob(await request('/imports/' + job.id));
                  await loadRows();
                })
              }
            >
              <RefreshCw size={18} />
            </button>
          </div>
          {job.planCounts ? (
            <div className="import-counts" aria-label="Review proposals">
              {Object.entries(job.planCounts).map(([label, n]) => (
                <div key={label}>
                  <strong>{Number(n)}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          ) : null}
          <div className="import-counts">
            {[
              ['Created', job.imported],
              ['Updated', job.updated],
              ['Unchanged', job.unchanged],
              ['Skipped', job.skipped],
              ['Invalid', job.invalid],
              ['Needs decision', job.pending],
            ].map(([label, n]) => (
              <div key={String(label)}>
                <strong>{n || 0}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <progress
            value={job.offset}
            max={Math.max(1, job.total)}
            aria-label="Reviewed import progress"
          />
          <p className="field-hint">
            {job.offset} / {job.total} processed. Details remain until an
            administrator deletes them. No original workbook file is stored.
          </p>
          {job.lastError ? (
            <p className="error-message" role="alert">
              Import paused: {job.lastError}. Refresh remaining matches, then
              review again.
            </p>
          ) : null}
          <div className="form-actions">
            {canWrite && job.status === 'Preparing' ? (
              <button
                className="button primary"
                disabled={busy || externalBusy}
                onClick={() =>
                  operate(async () => {
                    await progress(
                      job,
                      'plan',
                      (j) => j.status === 'Preparing',
                    );
                    await loadRows();
                  })
                }
              >
                Continue comparison
              </button>
            ) : null}
            {canWrite &&
            job.status === 'Preview' &&
            job.reviewOffset < job.total ? (
              <button
                className="button"
                disabled={busy || externalBusy}
                onClick={() =>
                  operate(async () => {
                    await progress(
                      job,
                      'review',
                      (j) => j.reviewOffset < j.total,
                    );
                    await loadRows();
                  })
                }
              >
                Approve clear proposals
              </button>
            ) : null}
            {canWrite && ['Preview', 'Importing'].includes(job.status) ? (
              <button
                className="button primary"
                disabled={
                  busy ||
                  externalBusy ||
                  job.pending > 0 ||
                  job.reviewOffset < job.total
                }
                onClick={() =>
                  operate(async () => {
                    let current = await request('/imports/' + job.id);
                    current = await progress(
                      current,
                      'commit',
                      (j) => !['Completed', 'Blocked'].includes(j.status),
                    );
                    await loadRows();
                    if (current.status === 'Completed') onImported();
                  })
                }
              >
                {job.offset ? 'Resume import' : 'Apply reviewed changes'}
              </button>
            ) : null}
            {canWrite &&
            ['Preview', 'Blocked', 'Importing'].includes(job.status) ? (
              <button
                className="button"
                disabled={busy || externalBusy}
                onClick={() =>
                  operate(async () => {
                    let current = await request(
                      '/imports/' + job.id + '/refresh',
                      'POST',
                      { expectedVersion: job.version },
                    );
                    onJob(current);
                    await progress(
                      current,
                      'plan',
                      (j) => j.status === 'Preparing',
                    );
                    await loadRows();
                  })
                }
              >
                Refresh remaining matches
              </button>
            ) : null}
            {job.status !== 'DetailsDeleted' ? (
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  operate(async () => {
                    const records = [];
                    let cursor = null;
                    do {
                      const page = await request(
                        '/imports/' +
                          job.id +
                          '/report?limit=10' +
                          (cursor
                            ? '&cursor=' + encodeURIComponent(cursor)
                            : ''),
                      );
                      records.push(...page.items);
                      cursor = page.nextCursor;
                      if (records.length > 5000)
                        throw Error('Report exceeds the row limit');
                    } while (cursor);
                    const href = URL.createObjectURL(
                        new Blob([JSON.stringify(records, null, 2)], {
                          type: 'application/json',
                        }),
                      ),
                      a = document.createElement('a');
                    a.href = href;
                    a.download = 'SalesDrone-import-results.json';
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(href), 1000);
                  })
                }
              >
                <Download size={16} />
                Download results
              </button>
            ) : null}
            {canDelete && job.status !== 'DetailsDeleted' ? (
              <button
                className="icon-button danger"
                title="Delete retained import details"
                aria-label="Delete retained import details"
                disabled={busy}
                onClick={() => {
                  if (
                    !window.confirm(
                      'Stop unfinished work and delete retained rows and source comparison values for this import dataset? Already saved leads and their history stay. Future updates may need a new manual comparison.',
                    )
                  )
                    return;
                  void operate(async () => {
                    let current = job;
                    do {
                      current = await request('/imports/' + job.id, 'DELETE', {
                        expectedVersion: current.version,
                        confirmation: 'DELETE IMPORT DETAILS',
                      });
                      onJob(current);
                    } while (current.status === 'Deleting');
                    setRows([]);
                    await loadHistory();
                  });
                }}
              >
                <Trash2 size={18} />
              </button>
            ) : null}
          </div>
          {job.pending > 0 ? (
            <p className="notice">
              Resolve pending matches or skip those rows before applying
              changes. “Approve clear proposals” leaves conflicts and
              comparisons without a prior baseline for explicit review.
            </p>
          ) : null}
          <div className="import-review-rows">
            {rows.map((row) => (
              <RowReview
                key={job.id + ':' + row.index + ':' + job.version}
                row={row}
                job={job}
                disabled={!!disabled}
                decide={decide}
              />
            ))}
          </div>
          <div className="form-actions">
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                operate(async () => {
                  await loadRows();
                })
              }
            >
              First rows
            </button>
            {rowCursor ? (
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  operate(async () => {
                    await loadRows(rowCursor);
                  })
                }
              >
                Next rows
                <ChevronRight size={16} />
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
      <section className="panel import-history">
        <div className="section-heading">
          <div>
            <h2>Import history</h2>
            <p>Your jobs and shared jobs you have permission to access.</p>
          </div>
          <button
            className="icon-button"
            aria-label="Refresh import history"
            title="Refresh import history"
            disabled={busy}
            onClick={() =>
              operate(async () => {
                await loadHistory();
              })
            }
          >
            <RefreshCw size={18} />
          </button>
        </div>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            setFilters(
              (status ? '&status=' + encodeURIComponent(status) : '') +
                (from
                  ? '&from=' +
                    encodeURIComponent(
                      new Date(from + 'T00:00:00').toISOString(),
                    )
                  : '') +
                (to
                  ? '&to=' +
                    encodeURIComponent(
                      new Date(to + 'T23:59:59.999').toISOString(),
                    )
                  : ''),
            );
          }}
        >
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {[
                'Preparing',
                'Preview',
                'Importing',
                'Blocked',
                'Completed',
                'Deleting',
                'DetailsDeleted',
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            Through
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button className="button">Filter history</button>
        </form>
        {!history.length ? (
          <p className="settings-empty">No imports found.</p>
        ) : null}
        <div className="import-history-list">
          {history.map((j) => (
            <article key={j.id}>
              <div>
                <strong>{j.filename}</strong>
                <small>
                  {j.createdByName || 'Member'} ·{' '}
                  {new Date(j.createdAt).toLocaleString()} · {j.status}
                </small>
                <small>
                  {j.imported || 0} created · {j.updated || 0} updated ·{' '}
                  {j.unchanged || 0} unchanged · {j.duplicates || 0} duplicate
                  skips
                </small>
              </div>
              <div className="form-actions">
                <button
                  className="button"
                  disabled={busy}
                  onClick={() =>
                    operate(async () => {
                      onJob(await request('/imports/' + j.id));
                    })
                  }
                >
                  View import
                </button>
                {canWrite && j.status === 'Completed' ? (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => onSource(j.id)}
                  >
                    Update this workbook
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
        {historyCursor ? (
          <button
            className="button"
            disabled={busy}
            onClick={() =>
              operate(async () => {
                await loadHistory(historyCursor);
              })
            }
          >
            Load older imports
          </button>
        ) : null}
      </section>
    </>
  );
}
