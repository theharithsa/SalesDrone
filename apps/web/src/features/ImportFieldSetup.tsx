import type { ImportFieldProposal } from '../lib/import-fields';

export default function ImportFieldSetup({
  proposals, headers, excluded, canManage, onToggle, onLabel,
}: {
  proposals: ImportFieldProposal[];
  headers: string[];
  excluded: number[];
  canManage: boolean;
  onToggle: (index: number, checked: boolean) => void;
  onLabel: (index: number, label: string) => void;
}) {
  return (
    <fieldset className="import-new-fields">
      <legend>Additional workbook fields</legend>
      <p>New columns are selected as text fields. Existing matching fields are reused, preserving codes and leading zeros.</p>
      <p className="field-hint">Admin setup is saved when you validate, even if you cancel the import. Exclude columns you do not need. Recheck positional names after reordering blank or repeated headers.</p>
      {!canManage ? <p role="status">Ask an Admin to set up these fields, map them above, or explicitly exclude them.</p> : null}
      <div className="import-new-field-list">
        {proposals.map(({ index, label }) => (
          <div key={index}>
            <label
              className="checkbox-row"
              htmlFor={`import-field-${index}`}
              aria-label={`Import column ${index + 1}: ${headers[index] || 'Unnamed column'} as a field`}
            >
              <input
                id={`import-field-${index}`}
                type="checkbox"
                checked={!excluded.includes(index)}
                onChange={e => onToggle(index, e.target.checked)}
              />
              <span><strong>{headers[index] || 'Unnamed column'}</strong><small>Column {index + 1} · text field</small></span>
            </label>
            <label>
              Field name
              <input
                aria-label={`New field name for column ${index + 1}`}
                value={label}
                maxLength={80}
                disabled={!canManage || excluded.includes(index)}
                onChange={e => onLabel(index, e.target.value)}
              />
            </label>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
