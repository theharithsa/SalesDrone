import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Modal, ErrorMessage } from '../components/UI';
import reportColumns from '../../../../functions/src/report-columns.json';
import { FieldOptions, labelFor } from '../lib/field-options';
import { ColumnFilter } from '../lib/lead-fields';
import { Lead } from '../lib/types';
type Criteria = {
  filters: ColumnFilter[];
  stage?: string;
  source?: string;
  search?: string;
  field?: string;
};
export default function LeadReportExport({
  request,
  config,
  criteria,
  demoLeads,
  demo = false,
}: {
  request: (p: string, m?: string, b?: any) => Promise<any>;
  config: FieldOptions;
  criteria: Criteria;
  demoLeads: Lead[];
  demo?: boolean;
}) {
  const choices = [
    ...Object.entries(reportColumns)
      .filter(([key]) => !config.hiddenFields.includes(key))
      .map(([key, label]) => ({ key, label: labelFor(config, key, label) })),
    ...config.customFields
      .filter((f) => !f.deleted)
      .map((f) => ({ key: f.id, label: f.label })),
  ];
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState<string[]>([
      'name',
      'phone',
      'company',
      'location',
      'zone',
      'stage',
      'latestComment',
    ]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [progress, setProgress] = useState('');
  const epoch = useRef(0),
    worker = useRef<Worker | null>(null);
  useEffect(
    () => () => {
      epoch.current++;
      worker.current?.terminate();
    },
    [],
  );
  function close() {
    epoch.current++;
    worker.current?.terminate();
    setBusy(false);
    setOpen(false);
  }
  async function download() {
    const run = ++epoch.current;
    setBusy(true);
    setError('');
    setProgress('Preparing matching leads…');
    try {
      const keys = selected.filter((k) => choices.some((c) => c.key === k));
      if (!keys.length) throw Error('Select at least one column.');
      let columns = choices.filter((c) => keys.includes(c.key));
      columns = keys.map((key) => columns.find((c) => c.key === key)!);
      const rows: { id: string; values: (string | number)[] }[] = [];
      let cursor: string | undefined;
      let policyVersion: number | undefined;
      const seen = new Set<string>();
      const cursors = new Set<string>();
      let pages = 0;
      do {
        if (++pages > 1000)
          throw Error('Report scan is too large. Narrow the filters.');
        if (demo) {
          for (const lead of demoLeads)
            rows.push({
              id: lead.id,
              values: keys.map((key) => {
                const v = key.startsWith('cf_')
                  ? lead.customFields?.[key]
                  : key === 'phone'
                    ? lead.phone || lead.originalPhone
                    : lead[key];
                return typeof v === 'boolean'
                  ? v
                    ? 'Yes'
                    : 'No'
                  : String(v ?? '');
              }),
            });
          cursor = undefined;
        } else {
          const page = await request('/leads/export', 'POST', {
            ...criteria,
            columns: keys,
            ...(cursor ? { cursor } : {}),
          });
          if (run !== epoch.current) return;
          if (
            policyVersion !== undefined &&
            page.policyVersion !== policyVersion
          )
            throw Error('Workspace policy changed. Start the report again.');
          policyVersion = page.policyVersion;
          columns = page.columns;
          for (const row of page.rows) {
            if (seen.has(row.id))
              throw Error('The lead list changed during export. Start again.');
            seen.add(row.id);
            rows.push(row);
          }
          cursor = page.nextCursor || undefined;
          if (cursor) {
            if (cursors.has(cursor))
              throw Error(
                'Report pagination stopped progressing. Start again.',
              );
            cursors.add(cursor);
          }
        }
        if (rows.length > 10000)
          throw Error('More than 10,000 leads match. Narrow the filters.');
        setProgress(`${rows.length.toLocaleString()} leads prepared…`);
      } while (cursor);
      if (run !== epoch.current) return;
      const w = new Worker(new URL('./report.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.current = w;
      const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        w.onmessage = (e) =>
          e.data.error ? reject(Error(e.data.error)) : resolve(e.data.buffer);
        w.onerror = () =>
          reject(Error('Could not build the workbook. Try fewer columns.'));
        w.postMessage({
          columns,
          rows,
          context: [
            'SalesDrone by AvinyaTech',
            demo ? 'Synthetic demo data' : 'Authorized filtered lead report',
            `Generated: ${new Date().toISOString()}`,
            `Rows: ${rows.length}`,
            `Applied filters: ${JSON.stringify(criteria)}`,
            'Rows reflect permissions and current values while pages were read; this is not a transactional snapshot.',
            'Conversation history is not included; comment columns contain stored lead summaries.',
          ],
        });
      });
      if (run !== epoch.current) return;
      w.terminate();
      worker.current = null;
      const url = URL.createObjectURL(
        new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = `SalesDrone-${demo ? 'demo-' : ''}leads-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setProgress(`${rows.length.toLocaleString()} leads exported to Excel.`);
    } catch (e) {
      if (run === epoch.current) setError((e as Error).message);
    } finally {
      if (run === epoch.current) {
        setBusy(false);
        worker.current?.terminate();
        worker.current = null;
      }
    }
  }
  return (
    <>
      <button
        className="button"
        onClick={() => {
          setError('');
          setProgress('');
          setOpen(true);
        }}
      >
        <Download size={16} />
        Export Excel
      </button>
      <Modal
        open={open}
        onClose={close}
        title="Export filtered leads"
        description="Choose the columns for your Excel report. All matching leads within your access are included, across every page."
      >
        <p className="field-hint">
          Current stage, source, search and applied column filters are included.
          Up to 10,000 matching leads per file.
        </p>
        <ErrorMessage error={error} />
        <fieldset className="report-columns" disabled={busy}>
          <legend>Columns to include</legend>
          <div className="report-column-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => setSelected(choices.map((c) => c.key))}
            >
              Select all
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setSelected([])}
            >
              Clear selection
            </button>
          </div>
          <div className="report-column-grid">
            {choices.map((c) => (
              <label key={c.key}>
                <input
                  type="checkbox"
                  checked={selected.includes(c.key)}
                  onChange={(e) =>
                    setSelected((v) =>
                      e.target.checked
                        ? [...v, c.key]
                        : v.filter((k) => k !== c.key),
                    )
                  }
                />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p role="status">{progress}</p>
        <div className="form-actions">
          <button className="button" onClick={close}>
            {busy ? 'Cancel export' : 'Close'}
          </button>
          <button
            className="button primary"
            disabled={
              busy || !selected.some((k) => choices.some((c) => c.key === k))
            }
            onClick={() => void download()}
          >
            {busy ? 'Preparing…' : 'Download Excel'}
          </button>
        </div>
      </Modal>
    </>
  );
}
