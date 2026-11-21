import { CustomField, withCurrent } from '../lib/field-options';
export default function CustomFieldInputs({
  fields,
  values = {},
}: {
  fields: CustomField[];
  values?: Record<string, any>;
}) {
  return (
    <>
      {fields
        .filter((f) => !f.deleted)
        .map((f) => {
          if (f.type === 'multiSelect') {
            const saved = values[f.id];
            const selected: string[] = Array.isArray(saved) ? saved : typeof saved === 'string' && saved ? [saved] : [];
            const choices = [...new Set([...f.options, ...selected])];
            return (
              <fieldset key={f.id} id={`custom-field-${f.id}`} className="custom-multi-field full" tabIndex={-1}>
                <legend>{f.label}{f.required ? ' *' : ''}</legend>
                <div className="custom-choice-list">
                  {choices.map((choice) => (
                    <label key={choice} className="checkbox-row">
                      <input type="checkbox" name={`custom:${f.id}`} value={choice} defaultChecked={selected.includes(choice)} />
                      <span>{choice}{f.options.includes(choice) ? '' : ' (retired)'}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          }
          return (
            <label
              key={f.id}
              className={
                f.type === 'textarea'
                  ? 'material-field full'
                  : f.type === 'checkbox'
                    ? 'checkbox-row'
                    : 'material-field'
              }
            >
              {f.type !== 'checkbox' ? (
                <span className="field-label">
                  {f.label}
                  {f.required ? ' *' : ''}
                </span>
              ) : null}
              {f.type === 'select' ? (
                <select
                  name={'custom:' + f.id}
                  defaultValue={values[f.id] ?? ''}
                  required={f.required}
                >
                  <option value="">{f.required ? "Select " + f.label.toLowerCase() : "N/A"}</option>
                  {withCurrent(f.options, values[f.id]).map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea
                  name={'custom:' + f.id}
                  rows={3}
                  placeholder="N/A"
                  maxLength={4000}
                  defaultValue={values[f.id] ?? ''}
                  required={f.required}
                />
              ) : f.type === 'checkbox' ? (
                <input
                  name={'custom:' + f.id}
                  type="checkbox"
                  defaultChecked={values[f.id] === true}
                  required={f.required}
                />
              ) : (
                <input
                  name={'custom:' + f.id}
                  type={f.type}
                  step={f.type === 'number' ? 'any' : undefined}
                  placeholder="N/A"
                  maxLength={500}
                  defaultValue={values[f.id] ?? ''}
                  required={f.required}
                />
              )}
              {f.type === 'checkbox' ? (
                <span>
                  {f.label}
                  {f.required ? ' *' : ''}
                </span>
              ) : null}
            </label>
          );
        })}
    </>
  );
}
