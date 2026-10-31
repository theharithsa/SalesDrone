type Target = { field: string; label: string; order?: string[] };
export default function ImportStatusMapping({
  targets, field, statuses, mapping, onField, onValue,
}: {
  targets: Target[];
  field: string;
  statuses: string[];
  mapping: Record<string,string>;
  onField: (field: string) => void;
  onValue: (status: string, value: string) => void;
}) {
  const target=targets.find(t=>t.field===field);
  const keepOriginal=field==='legacyStatus'||!target?.order?.length;
  return (
    <section className="import-status-mapping">
      <h3>Map existing statuses</h3>
      <p className="field-hint">Choose where workbook statuses belong. Enquiry status keeps the original text by default. Original workbook text remains in import history.</p>
      <label>
        Map statuses to
        <select aria-label="Status mapping field" value={field} onChange={e=>onField(e.target.value)}>
          <option value="none">Keep original text only</option>
          {field!=='none'&&!target?<option value={field} disabled>Unavailable — choose a field</option>:null}
          {targets.map(t=><option key={t.field} value={t.field}>{t.label}</option>)}
        </select>
      </label>
      {field==='none'?<p className="field-hint">Original Enquiry status text is retained; no additional status mapping is applied.</p>:target?<div className="mapping-grid">
        {statuses.map(status=>{
          const value=Object.hasOwn(mapping,status)?mapping[status]:keepOriginal||(target.order||[]).includes(status)?status:'';
          return <label key={status}>
            <span className="import-status-source" title={status}>{status}</span>
            <select aria-label={`Map status ${status}`} value={value} onChange={e=>onValue(status,e.target.value)}>
              {!keepOriginal?<option value="">Choose {target.label}</option>:<option value={status}>Keep original: {status}</option>}
              {(target.order||[]).filter(v=>!keepOriginal||v!==status).map(v=><option key={v} value={v}>{v}</option>)}
            </select>
          </label>;
        })}
      </div>:<p role="status">The selected field is unavailable. Choose another target before validating.</p>}
    </section>
  );
}
