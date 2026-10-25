import { readStored, writeStored, removeStored } from '../lib/browser-storage';
import { isCommentHeader, mapImportRows } from '../lib/import-mapping';
import {
  defaultFieldOptions,
  FieldOptions,
  labelFor,
} from '../lib/field-options';
import {
  worksheetColumns,
  legacyImportColumns,
  detectHeaderRow,
} from '../lib/lead-fields';
import { useEffect, useRef, useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Check,
  ArrowRight,
  Download,
  AlertCircle,
} from 'lucide-react';
import { Entity, stages } from '../lib/types';
import { ErrorMessage } from '../components/UI';
const columns: Record<string, string> = Object.fromEntries([
  ...worksheetColumns.map(([key, label]) => [label, key]),
  ['Email (optional)', 'email'],
]);

type Sheet = { name: string; rows: string[][] };
function csvParse(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if ((c === ',' || c === '\n' || c === '\r') && !quoted) {
      row.push(cell);
      cell = '';
      if (c !== ',') {
        rows.push(row);
        row = [];
        if (c === '\r' && text[i + 1] === '\n') i++;
      }
    } else cell += c;
  }
  if (quoted) throw Error('CSV has an unclosed quote.');
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  if (rows.length > 5025 || rows.some((r) => r.length > 40))
    throw Error('Use at most 5,000 data rows and 40 columns.');
  return rows;
}
export function downloadTemplate() {
  const headers = [
    ...Object.keys(columns),
    'Initial discussion',
    'First follow-up',
    'Second follow-up',
    'Third follow-up',
    'Fourth follow-up',
  ].join(',');
  const blob = new Blob([headers + '\n'], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'SalesDrone-enquiry-template.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export default function ImportPage({
  demo,
  request,
  onImported,
  choices = defaultFieldOptions.values,
  config = defaultFieldOptions,
}: {
  config?: FieldOptions;
  demo: boolean;
  choices?: FieldOptions['values'];
  request: (
    path: string,
    method?: string,
    body?: any,
    key?: string,
  ) => Promise<any>;
  onImported: () => void;
}) {
  const [sheets, setSheets] = useState<Sheet[]>([]),
    [sheetIndex, setSheetIndex] = useState(0),
    [headerRow, setHeaderRow] = useState(0),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [commentColumns, setCommentColumns] = useState<number[]>([]),
    [filename, setFilename] = useState(''),
    [dateOrder, setDateOrder] = useState('DMY'),
    [keepDuplicates, setKeepDuplicates] = useState(false),
    [statusMap, setStatusMap] = useState<Record<string, string>>({}),
    [job, setJob] = useState<Entity | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  const sheet = sheets[sheetIndex];
  const headers = sheet?.rows[headerRow] || [];
  useEffect(() => {
    setCommentColumns(
      headers
        .map((header, index) => (isCommentHeader(header) ? index : -1))
        .filter((index) => index >= 0),
    );
    setMapping(
      Object.fromEntries(
        Object.entries(columns).map(([header, key]) => [
          key,
          String(
            headers.findIndex(
              (h) =>
                h.trim().toLowerCase() ===
                  labelFor(config, key, header).toLowerCase() ||
                h.trim().toLowerCase() === header.toLowerCase() ||
                legacyImportColumns.some(
                  ([legacyKey, label]) =>
                    legacyKey === key &&
                    h.trim().toLowerCase() === label.toLowerCase(),
                ) ||
                (key === 'name' &&
                  h.trim().toLowerCase() === 'customer name') ||
                (key === 'zone' &&
                  h.trim().toLowerCase() === 'zone / sector') ||
                (key === 'comments' && h.trim().toLowerCase() === 'comments'),
            ),
          ),
        ]),
      ),
    );
    setJob(null);
    setStatusMap(
      Object.fromEntries(
        Object.entries({
          'Call/WA done': 'Working',
          'Samples sent': 'Qualified',
          Quoted: 'Qualified',
          'Won/Order placed': 'Won',
        }).filter(([, stage]) => choices.stage.includes(stage)),
      ),
    );
  }, [sheetIndex, headerRow, sheets]);
  const rows =
    sheet?.rows.slice(headerRow + 1).filter((r) => r.some((v) => v.trim())) ||
    [];
  const mapped = mapImportRows(rows, headers, mapping, commentColumns);
  const distinctStatuses = [
    ...new Set(mapped.map((r) => r.legacyStatus).filter(Boolean)),
  ];
  const unsafeCell = (value: string) =>
    value.startsWith('[FORMULA') || value.startsWith('[LINK');
  const invalidCells = mapped.some((row) =>
    Object.values(row).some((value) =>
      typeof value === 'string'
        ? unsafeCell(value)
        : Array.isArray(value) &&
          value.some((comment) => unsafeCell(comment.notes)),
    ),
  );
  async function read(file: File) {
    setError('');
    setJob(null);
    setSheets([]);
    setBusy(true);
    setFilename(file.name);
    try {
      if (file.size > 10 * 1024 * 1024)
        throw Error('Choose a file smaller than 10 MB.');
      if (file.name.toLowerCase().endsWith('.csv')) {
        const rows = csvParse(await file.text());
        setSheets([{ name: 'CSV', rows }]);
        setHeaderRow(detectHeaderRow(rows, Object.values(config.labels || {})));
        setBusy(false);
      } else if (file.name.toLowerCase().endsWith('.xlsx')) {
        worker.current?.terminate();
        const w = new Worker(new URL('./import.worker.ts', import.meta.url), {
          type: 'module',
        });
        worker.current = w;
        const timeout = setTimeout(() => {
          w.terminate();
          setBusy(false);
          setError(
            'Workbook processing timed out. Simplify the workbook and try again.',
          );
        }, 20000);
        w.onmessage = (e) => {
          clearTimeout(timeout);
          setBusy(false);
          if (e.data.error) setError(e.data.error);
          else {
            setSheets(e.data.sheets);
            setSheetIndex(0);
            setHeaderRow(
              detectHeaderRow(
                e.data.sheets[0]?.rows || [],
                Object.values(config.labels || {}),
              ),
            );
          }
          w.terminate();
        };
        w.onerror = () => {
          clearTimeout(timeout);
          setError(
            'Workbook could not be read. Try a simpler .xlsx or CSV file.',
          );
          setBusy(false);
          w.terminate();
        };
        w.postMessage(await file.arrayBuffer());
      } else
        throw Error(
          'Use an .xlsx or .csv file. Convert older .xls files to .xlsx first.',
        );
    } catch (e) {
      setBusy(false);
      setError((e as Error).message);
    }
  }
  async function preview() {
    setBusy(true);
    setError('');
    try {
      if (!mapped.length) throw Error('No populated data rows were found.');
      if (mapped.length > 5000) throw Error('Import at most 5,000 data rows.');
      if (invalidCells)
        throw Error(
          'Replace formulas and links with literal values before importing.',
        );
      const result = await request(
        '/imports/preview',
        'POST',
        {
          filename,
          sheet: sheet.name,
          rows: mapped,
          statusMap,
          dateOrder,
          duplicateMode: keepDuplicates ? 'keep' : 'skip',
          blankRows: sheet.rows.length - headerRow - 1 - rows.length,
        },
        crypto.randomUUID(),
      );
      setJob(result);
      if (!writeStored('sessionStorage', 'salesdrone.import', result.id))
        setError(
          'Preview is ready. Browser storage is unavailable; keep this page open to finish the import.',
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (!job) return;
    setBusy(true);
    setError('');
    try {
      let current = job;
      while (current.status !== 'Completed') {
        current = await request(
          '/imports/' + current.id + '/commit',
          'POST',
          {},
          crypto.randomUUID(),
        );
        setJob(current);
      }
      removeStored('sessionStorage', 'salesdrone.import');
      onImported();
    } catch (e) {
      setError(
        (e as Error).message +
          (readStored('sessionStorage', 'salesdrone.import')
            ? ' Your progress is saved. Choose Resume import to continue.'
            : ' Keep this page open and retry this import to continue; automatic resume after reload requires browser storage.'),
      );
    } finally {
      setBusy(false);
    }
  }
  async function resume() {
    setBusy(true);
    setError('');
    try {
      const id = readStored('sessionStorage', 'salesdrone.import');
      if (id) setJob(await request('/imports/' + id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-body import-page">
      <div className="page-title">
        <div>
          <span className="eyebrow">BRING YOUR PIPELINE WITH YOU</span>
          <h1>One sheet. A fresh start.</h1>
          <p>
            Import existing enquiries, then let the form handle every new one.
          </p>
        </div>
        <button className="button" onClick={downloadTemplate}>
          <Download size={16} /> Get template
        </button>
      </div>
      {demo ? (
        <div className="notice">
          <AlertCircle size={18} />
          <div>
            <strong>Imports are available to live administrators.</strong>
            <p>
              Demo mode uses fictional records. Your files are never uploaded
              here.
            </p>
          </div>
        </div>
      ) : null}
      <div className="import-steps">
        {['Choose workbook', 'Review & map', 'Import enquiries'].map((s, i) => (
          <div
            key={s}
            className={i === (job ? 2 : sheets.length ? 1 : 0) ? 'current' : ''}
          >
            <span>{i + 1}</span>
            {s}
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="upload-area">
          <FileSpreadsheet size={36} strokeWidth={1.4} />
          <h2>Your enquiries, ready to move.</h2>
          <p>
            Excel (.xlsx) or CSV · first worksheet only · up to 5,000 records ·
            10 MB maximum
          </p>
          <label
            className={'button primary ' + (demo || busy ? 'disabled' : '')}
          >
            <Upload size={16} /> {busy ? 'Processing…' : 'Choose a workbook'}
            <input
              type="file"
              accept=".xlsx,.csv"
              disabled={demo || busy}
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) read(f);
                e.currentTarget.value = '';
              }}
            />
          </label>
          {!demo && readStored('sessionStorage', 'salesdrone.import') ? (
            <button className="text-button" onClick={resume} disabled={busy}>
              Resume previous import
            </button>
          ) : null}
        </div>
      </section>
      <ErrorMessage error={error} />
      {sheet && !job ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Match your columns</h2>
              <p>
                {filename} · {rows.length} populated rows
              </p>
            </div>
            <button
              className="button primary"
              onClick={preview}
              disabled={busy || invalidCells}
            >
              Validate records <ArrowRight size={16} />
            </button>
          </div>
          <p className="import-profile-note">
            Select the columns to import as comments below. Each nonempty cell
            becomes a separate comment inside its lead. Missing legacy names,
            dates or contact details are retained for review. Imported history
            does not create automatic reminders.
          </p>
          <div className="form-grid">
            <label>
              Worksheet
              <select
                value={sheetIndex}
                onChange={(e) => setSheetIndex(Number(e.target.value))}
              >
                {sheets.map((s, i) => (
                  <option key={i} value={i}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Header row
              <select
                value={headerRow}
                onChange={(e) => setHeaderRow(Number(e.target.value))}
              >
                {sheet.rows.slice(0, 20).map((_, i) => (
                  <option key={i} value={i}>
                    Row {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date order
              <select
                value={dateOrder}
                onChange={(e) => setDateOrder(e.target.value)}
              >
                <option value="DMY">Day / Month / Year</option>
                <option value="MDY">Month / Day / Year</option>
              </select>
            </label>
          </div>
          <label className="check import-profile-note">
            <input
              type="checkbox"
              checked={keepDuplicates}
              onChange={(e) => setKeepDuplicates(e.target.checked)}
            />
            Keep separate enquiry rows when a contact repeats. Each row retains
            its own discussions. Leave off to skip duplicate contacts.
          </label>
          <div className="mapping-grid">
            {Object.entries(columns).map(([label, key]) => (
              <label key={key}>
                {labelFor(config, key, label)}
                <select
                  value={mapping[key] ?? '-1'}
                  onChange={(e) =>
                    setMapping({ ...mapping, [key]: e.target.value })
                  }
                >
                  <option value="-1">Not mapped</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || 'Column ' + (i + 1)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <fieldset className="comment-column-picker">
            <legend>Import columns as comments</legend>
            <p>
              Choose any number of comment or follow-up columns. Entries retain
              their column labels and follow the sheet’s left-to-right order.
              Blank cells are skipped.
            </p>
            <div className="comment-column-options">
              {headers.map((header, index) => (
                <label key={index} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={commentColumns.includes(index)}
                    onChange={(e) => {
                      setCommentColumns((old) =>
                        e.target.checked
                          ? [...old, index]
                          : old.filter((i) => i !== index),
                      );
                      setJob(null);
                    }}
                  />
                  <span>
                    {header || `Column ${index + 1}`}
                    <small>Column {index + 1}</small>
                  </span>
                </label>
              ))}
            </div>
            <p className="field-hint" role="status">
              {commentColumns.length} columns selected ·{' '}
              {mapped.reduce(
                (count, row) => count + row.importComments.length,
                0,
              )}{' '}
              nonempty comment cells
            </p>
          </fieldset>
          {distinctStatuses.length ? (
            <>
              <h3>Map existing statuses</h3>
              <p className="field-hint">
                Original status text is retained. Choose its current sales
                stage; no call history is inferred.
              </p>
              <div className="mapping-grid">
                {distinctStatuses.map((s) => (
                  <label key={s}>
                    {s}
                    <select
                      value={statusMap[s] || (stages.includes(s) ? s : '')}
                      onChange={(e) =>
                        setStatusMap({ ...statusMap, [s]: e.target.value })
                      }
                    >
                      <option value="">Choose stage</option>
                      {choices.stage.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </>
          ) : null}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    'Customer',
                    'Phone',
                    'Company',
                    'Date',
                    'Original status',
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mapped.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    <td>{r.name || '—'}</td>
                    <td>{r.phone || '—'}</td>
                    <td>{r.company || '—'}</td>
                    <td>{r.enquiryDate || '—'}</td>
                    <td>{r.legacyStatus || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {job?.needsReview ? (
        <p className="notice">
          {job.needsReview} records have missing or unconfirmed fields and will
          be kept for review. Blank source values are preserved; outreach
          remains disabled until reviewed.
        </p>
      ) : null}
      {job ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>
                {job.status === 'Completed'
                  ? 'Your enquiries are in.'
                  : 'Review before importing'}
              </h2>
              <p>
                {job.filename} · {job.total} populated records · {job.blank}{' '}
                blank rows ignored
              </p>
            </div>
            {job.status === 'Completed' ? (
              <span className="success-tag">
                <Check size={16} /> Complete
              </span>
            ) : (
              <button
                className="button primary"
                onClick={commit}
                disabled={busy}
              >
                {busy
                  ? 'Importing…'
                  : job.offset
                    ? 'Resume import'
                    : 'Import valid records'}
                <ArrowRight size={16} />
              </button>
            )}
          </div>
          <div className="import-counts">
            {[
              ['Valid', job.valid],
              ['Invalid', job.invalid],
              ['Imported', job.imported],
              ['Duplicates skipped', job.duplicates],
            ].map(([l, v]) => (
              <div key={l}>
                <strong>{v}</strong>
                <span>{l}</span>
              </div>
            ))}
          </div>
          <progress
            value={job.offset}
            max={Math.max(1, job.total)}
            aria-label="Import progress"
          />
          <p className="field-hint">
            Invalid records are skipped. Existing contacts are never
            overwritten.{' '}
            {job.invalid
              ? 'Correct errors and upload the corrected rows in a new import.'
              : ''}
          </p>
          {job.errors?.length ? (
            <>
              <h3>Validation errors</h3>
              <ul className="error-list">
                {job.errors.map((r: any) => (
                  <li key={r.index}>
                    Data row {r.index + 1}: {r.error}
                  </li>
                ))}
              </ul>
              <button
                className="button"
                onClick={() => {
                  void (async () => {
                    try {
                      const errors: any[] = [];
                      let cursor: string | null = null;
                      do {
                        const page = await request(
                          '/imports/' +
                            job.id +
                            '/errors?limit=100' +
                            (cursor
                              ? '&cursor=' + encodeURIComponent(cursor)
                              : ''),
                        );
                        errors.push(...page.items);
                        cursor = page.nextCursor;
                      } while (cursor);
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(
                        new Blob([JSON.stringify(errors, null, 2)], {
                          type: 'application/json',
                        }),
                      );
                      a.download = 'SalesDrone-import-errors.json';
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  })();
                }}
              >
                Download error report
              </button>
              <p className="field-hint">Preview displays at most 100 errors.</p>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
