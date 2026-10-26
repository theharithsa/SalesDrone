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
        .map((f) => (
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
                <option value="">Select {f.label.toLowerCase()}</option>
                {withCurrent(f.options, values[f.id]).map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea
                name={'custom:' + f.id}
                rows={3}
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
        ))}
    </>
  );
}
