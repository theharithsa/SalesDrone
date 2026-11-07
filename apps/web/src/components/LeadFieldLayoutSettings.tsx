import { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { labelFor, orderedFields, standardFieldLabels, type FieldOptions } from '../lib/field-options';
import { ErrorMessage, SaveButton, useSubmit } from './UI';

const fixedHeaderFields = new Set(['company', 'phone', 'name', 'stage', 'assignedToUid', 'outcome', 'disposition']);
const headerLimit = 6;

export default function LeadFieldLayoutSettings({ config, mode, request, onChanged }: {
  config: FieldOptions;
  mode: 'order' | 'header';
  request: (path: string, method: string, body: Record<string, unknown>) => Promise<FieldOptions>;
  onChanged: (options: FieldOptions) => void;
}) {
  const custom = config.customFields.filter((field) => !field.deleted);
  const available = orderedFields(config, [
    ...Object.keys(standardFieldLabels).filter((key) => !config.hiddenFields.includes(key)),
    'createdAt',
    ...custom.map((field) => field.id),
  ], (key) => key);
  const headerFields = available.filter((key) => !fixedHeaderFields.has(key));
  const [order, setOrder] = useState(available);
  const [header, setHeader] = useState(() => headerFields.filter((key) => config.headerFields?.includes(key)));
  const [saved, setSaved] = useState(false);
  const [expectedVersion, setExpectedVersion] = useState(config.version);
  const isOrder = mode === 'order';
  const submit = useSubmit(async (change, _key, isCurrent) => {
    const result = await request('/field-options', 'PATCH', {
      expectedVersion,
      values: config.values,
      ...change,
    });
    if (isCurrent()) {
      setExpectedVersion(result.version);
      onChanged(result);
      setSaved(true);
    }
  });

  function move(index: number, direction: number) {
    setSaved(false);
    setOrder((current) => {
      const next = current.slice();
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });
  }

  return (
    <form className="panel field-layout-settings" data-mode={mode} onSubmit={(event) => {
      event.preventDefault();
      setSaved(false);
      void submit.run(isOrder ? { fieldOrder: order } : { headerFields: header });
    }}>
      <p className="field-hint">{isOrder
        ? 'Arrange fields for enquiry forms, the Leads table and Excel exports.'
        : 'Choose up to six fields to show under the lead name and contact details. Fields appear when they have a value.'}</p>
      {!isOrder && <p className="field-hint" role="status">{header.length} of {headerLimit} selected</p>}
      <ol>
        {(isOrder ? order : headerFields).map((key, index) => {
          const label = custom.find((field) => field.id === key)?.label || labelFor(config, key, key === 'createdAt' ? 'Created at' : undefined);
          return (
            <li key={key} data-selected={!isOrder && header.includes(key) || undefined}>
              {isOrder ? <>
                <span className="field-position" aria-hidden="true">{index + 1}</span>
                <span className="field-order-name">{label}</span>
                <button className="icon-button" type="button" aria-label={'Move ' + label + ' up'} disabled={!index || submit.busy} onClick={() => move(index, -1)}><ArrowUp size={17} /></button>
                <button className="icon-button" type="button" aria-label={'Move ' + label + ' down'} disabled={index === order.length - 1 || submit.busy} onClick={() => move(index, 1)}><ArrowDown size={17} /></button>
              </> : (
                <label className="check">
                  <input type="checkbox" checked={header.includes(key)}
                    disabled={submit.busy || (!header.includes(key) && header.length >= headerLimit)}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setSaved(false);
                      setHeader((current) => checked ? [...current, key] : current.filter((id) => id !== key));
                    }} />
                  {label}
                </label>
              )}
            </li>
          );
        })}
      </ol>
      <ErrorMessage error={submit.error} />
      <div className="form-footer field-layout-actions">
        {saved && <span role="status">Saved.</span>}
        <SaveButton busy={submit.busy} label={isOrder ? 'Save field order' : 'Save lead header'} />
      </div>
    </form>
  );
}
