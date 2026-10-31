import ImportStatusMapping from './ImportStatusMapping';
import { dashboardFields } from '../../../../functions/src/dashboard-grouping.js';
import ImportFieldSetup from './ImportFieldSetup';
import { unmatchedImportFields, resolveImportFields, fieldNameKey } from '../lib/import-fields';
import ImportReviewPanel from './ImportReviewPanel';
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
import { Entity } from '../lib/types';
import { ErrorMessage } from '../components/UI';
const columns: Record<string, string> = Object.fromEntries([
  ...worksheetColumns.map(([key, label]) => [label, key]),
  ['Email (optional)', 'email'],
  ['Country code', 'countryCode'],
  ['Sales stage', 'stage'],
  ['Job title', 'jobTitle'],
  ['Website', 'website'],
  ['SalesDrone lead ID (optional)', 'leadId'],
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
  canWrite = true,
  canDelete = false,
  canManageFields = false,
  onFieldOptions,
}: {
  canManageFields?: boolean;
  onFieldOptions?: (config: FieldOptions) => void;
  canWrite?: boolean;
  canDelete?: boolean;
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
  const fieldColumns = {
    ...columns,
    ...Object.fromEntries(
      config.customFields.filter((f) => !f.deleted).map((f) => [f.label, f.id]),
    ),
  };
  const [sheets, setSheets] = useState<Sheet[]>([]),
    [sheetIndex, setSheetIndex] = useState(0),
    [headerRow, setHeaderRow] = useState(0),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [commentColumns, setCommentColumns] = useState<number[]>([]),
    [filename, setFilename] = useState(''),
    [dateOrder, setDateOrder] = useState('DMY'),
    [importMode, setImportMode] = useState('skip'),
    [sourceImportId, setSourceImportId] = useState(''),
    [statusMap, setStatusMap] = useState<Record<string, string>>({}),
    [statusField, setStatusField] = useState('legacyStatus'),
    [job, setJob] = useState<Entity | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [excludedColumns, setExcludedColumns] = useState<number[]>([]),
    [fieldNames, setFieldNames] = useState<Record<number,string>>({});
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  const sheet = sheets[sheetIndex];
  const rawHeaders = sheet?.rows[headerRow] || [];
  const headers = Array.from({length:sheet?Math.max(rawHeaders.length,...sheet.rows.slice(headerRow+1).map(r=>r.length)):0},(_,i)=>rawHeaders[i]||'');
  useEffect(() => {
    setExcludedColumns([]);
    setFieldNames({});
    const claimed = new Set<number>();
    const nextMapping:Record<string,string>={};
    for(const [header,key] of Object.entries(fieldColumns)){
      const index=headers.findIndex((h,i)=>!claimed.has(i)&&(
        fieldNameKey(h)===fieldNameKey(labelFor(config,key,header)) ||
        fieldNameKey(h)===fieldNameKey(header) || fieldNameKey(h)===fieldNameKey(key) ||
        legacyImportColumns.some(([legacyKey,label])=>legacyKey===key&&fieldNameKey(h)===fieldNameKey(label)) ||
        (key==='zone'&&fieldNameKey(h)==='zone / sector')
      ));
      nextMapping[key]=String(index);if(index>=0)claimed.add(index);
    }
    setMapping(nextMapping);
    setCommentColumns(headers.flatMap((header,index)=>isCommentHeader(header)&&!claimed.has(index)?[index]:[]));
    setJob(null);
    setStatusMap({});
    setStatusField(config.hiddenFields.includes('legacyStatus')?'none':'legacyStatus');
  }, [sheetIndex, headerRow, sheets]);
  const populatedRows =
    sheet?.rows
      .slice(headerRow + 1)
      .map((row, index) => ({ row, sourceRow: headerRow + index + 2 }))
      .filter(({ row }) => row.some((v) => v.trim())) || [];
  const rows = populatedRows.map((r) => r.row);
  const mapped = mapImportRows(rows, headers, mapping, commentColumns);
  const proposals = unmatchedImportFields(headers, rows, mapping, commentColumns, config)
    .map(p=>({...p,label:fieldNames[p.index]??p.label}));
  const selectedFields=proposals.filter(p=>!excludedColumns.includes(p.index));
  const distinctStatuses = [
    ...new Set(mapped.map((r) => r.legacyStatus.trim()).filter(Boolean)),
  ];
  const statusTargets=dashboardFields(config).filter(f=>f.field==='legacyStatus'||Number(mapping[f.field]??'-1')<0);
  const invalidStatusTarget=statusField!=='none'&&!statusTargets.some(f=>f.field===statusField);
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
      if(invalidStatusTarget)throw Error('Choose an available status mapping field.');
      if (!mapped.length) throw Error('No populated data rows were found.');
      if (mapped.length > 5000) throw Error('Import at most 5,000 data rows.');
      if (invalidCells)
        throw Error(
          'Replace formulas and links with literal values before importing.',
        );
      let importRows=mapped;
      if(selectedFields.length){
        if(!canManageFields)throw Error('An Admin must set up these fields, or explicitly exclude the unmatched columns.');
        if(selectedFields.some(p=>rows.some(row=>unsafeCell(row[p.index]||''))))throw Error('Replace formulas and links with literal values before creating fields.');
        const current:FieldOptions=await request('/field-options');
        const resolved=resolveImportFields(current,selectedFields,()=> 'cf_'+crypto.randomUUID().replaceAll('-',''),mapping);
        const saved:FieldOptions=resolved.created?await request('/field-options','PATCH',{
          expectedVersion:current.version,values:current.values,customFields:resolved.fields,
        }):current;
        onFieldOptions?.(saved);
        const nextMapping={...mapping,...resolved.mapping};
        setMapping(nextMapping);
        importRows=mapImportRows(rows,headers,nextMapping,commentColumns);
      }
      const result = await request(
        '/imports/preview',
        'POST',
        {
          filename,
          sheet: sheet.name,
          rows: importRows.map((r, i) => ({
            ...r,
            sourceRow: populatedRows[i].sourceRow,
          })),
          reviewed: true,
          ...(sourceImportId ? { sourceImportId } : {}),
          statusMap,
          statusField,
          dateOrder,
          duplicateMode: importMode,
          blankRows: sheet.rows.length - headerRow - 1 - rows.length,
        },
        crypto.randomUUID(),
      );
      let current = result;
      setJob(current);
      while (current.status === 'Preparing') {
        current = await request('/imports/' + current.id + '/plan', 'POST', {
          expectedVersion: current.version,
        });
        setJob(current);
      }
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
          <h1>Imports &amp; history</h1>
          <p>
            Bring new enquiries in or review updates from a revised workbook.
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
            <strong>Imports require live workspace import access.</strong>
            <p>
              Demo mode uses fictional records. Your files are never uploaded
              here.
            </p>
          </div>
        </div>
      ) : null}
      {canWrite || demo ? (
        <>
          <div className="import-steps">
            {['Choose workbook', 'Review & map', 'Import enquiries'].map(
              (s, i) => (
                <div
                  key={s}
                  className={
                    i === (job ? 2 : sheets.length ? 1 : 0) ? 'current' : ''
                  }
                >
                  <span>{i + 1}</span>
                  {s}
                </div>
              ),
            )}
          </div>
          <section
            className={'panel' + (sheets.length ? ' import-file-summary' : '')}
          >
            <div className="upload-area">
              <FileSpreadsheet size={36} strokeWidth={1.4} />
              <h2>Your enquiries, ready to move.</h2>
              <p>
                Excel (.xlsx) or CSV · first worksheet only · up to 5,000
                records · 10 MB maximum
              </p>
              <label
                className={
                  'button primary ' +
                  (demo || busy || !canWrite ? 'disabled' : '')
                }
              >
                <Upload size={16} />{' '}
                {busy
                  ? 'Processing…'
                  : sheets.length
                    ? 'Choose another workbook'
                    : 'Choose a workbook'}
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  disabled={demo || busy || !canWrite}
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) read(f);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
              {!demo && readStored('sessionStorage', 'salesdrone.import') ? (
                <button
                  className="text-button"
                  onClick={resume}
                  disabled={busy}
                >
                  Resume previous import
                </button>
              ) : null}
            </div>
          </section>
        </>
      ) : null}
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
              disabled={busy || invalidCells || invalidStatusTarget || (!canManageFields && selectedFields.length>0)}
            >
              {selectedFields.length ? `Create / reuse ${selectedFields.length} fields & validate` : 'Validate records'} <ArrowRight size={16} />
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
          <label>
            When records already exist
            <select
              value={importMode}
              onChange={(e) => setImportMode(e.target.value)}
            >
              <option value="skip">Show matches and skip duplicates</option>
              <option value="update">Review updates to existing leads</option>
              <option value="keep">Keep separate enquiry rows</option>
            </select>
          </label>
          <p className="field-hint">
            Exact name and phone matches can identify updates. Partial matches
            require review. Blank cells leave saved values unchanged. Existing
            history and contact restrictions stay intact.
          </p>
          {sourceImportId ? (
            <p className="notice">
              Linked to the completed import selected in history.{' '}
              <button
                className="text-button"
                type="button"
                onClick={() => setSourceImportId('')}
              >
                Unlink previous import
              </button>
            </p>
          ) : null}
          <div className="mapping-grid">
            {Object.entries(fieldColumns).map(([label, key]) => (
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
          {proposals.length ? (
            <ImportFieldSetup
              proposals={proposals}
              headers={headers}
              excluded={excludedColumns}
              canManage={canManageFields}
              onToggle={(index,checked)=>setExcludedColumns(old=>checked?old.filter(i=>i!==index):[...old,index])}
              onLabel={(index,label)=>setFieldNames(old=>({...old,[index]:label}))}
            />
          ) : null}
          <fieldset className="comment-column-picker">
            <legend>Import columns as comments</legend>
            <p>
              Choose any number of comment or follow-up columns. Entries retain
              their column labels and follow the sheet’s left-to-right order.
              Blank cells are skipped.
            </p>
            <div className="comment-column-options">
              {headers.map((header, index) => (
                <label key={index} aria-label={`Import column ${index+1}: ${header||'Unnamed column'} as comments`} htmlFor={`import-comment-${index}`} className="checkbox-row">
                  <input
                    id={`import-comment-${index}`}
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
                    <strong>{header || 'Unnamed column'}</strong>
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
            <ImportStatusMapping
              targets={statusTargets}
              field={statusField}
              statuses={distinctStatuses}
              mapping={statusMap}
              onField={field=>{setStatusField(field);setStatusMap({});}}
              onValue={(status,value)=>setStatusMap(old=>{
                const next={...old};
                if(!value||value===status)delete next[status];else next[status]=value;
                return next;
              })}
            />
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
      {job && job.formatVersion !== 3 ? (
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
                disabled={busy || !canWrite}
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
      {!demo ? (
        <ImportReviewPanel
          request={request}
          job={job}
          onJob={setJob}
          canWrite={canWrite}
          canDelete={canDelete}
          externalBusy={busy}
          onImported={onImported}
          onSource={(id) => {
            setSourceImportId(id);
            setImportMode('update');
            setJob(null);
            setSheets([]);
            setFilename('');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      ) : null}
    </div>
  );
}
