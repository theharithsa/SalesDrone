import { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { labelFor, orderedFields, standardFieldLabels, type FieldOptions } from '../lib/field-options';

export default function LeadFieldLayoutSettings({ config, busy, onSave }: {
  config: FieldOptions;
  busy: boolean;
  onSave: (change: Partial<FieldOptions>) => Promise<boolean>;
}) {
  const custom = config.customFields.filter((field) => !field.deleted);
  const visible = (key: string) => !config.hiddenFields.includes(key);
  const initial = orderedFields(config, [
    ...Object.keys(standardFieldLabels).filter(visible),
    'createdAt',
    ...custom.map((field) => field.id),
  ], (key) => key);
  const [order, setOrder] = useState(initial);
  const [header, setHeader] = useState(config.headerFields || []);
  function move(index: number, direction: number) {
    setOrder((current) => {
      const next = current.slice();
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });
  }
  return (
    <details className="field-layout-settings">
      <summary>Field order and lead header</summary>
      <p className="field-hint">Set the workspace order for enquiry fields, lead columns and exports. Show up to six extra fields in the lead header.</p>
      <ol>
        {order.map((key, index) => {
          const label = custom.find((field) => field.id === key)?.label || labelFor(config, key, key === 'createdAt' ? 'Created at' : undefined);
          const headerEligible = !['company', 'phone', 'name', 'stage', 'assignedToUid', 'outcome', 'disposition'].includes(key);
          return <li key={key}>
            <span>{label}</span>
            <button className="icon-button" type="button" aria-label={'Move ' + label + ' up'} disabled={!index || busy} onClick={() => move(index, -1)}><ArrowUp size={17} /></button>
            <button className="icon-button" type="button" aria-label={'Move ' + label + ' down'} disabled={index === order.length - 1 || busy} onClick={() => move(index, 1)}><ArrowDown size={17} /></button>
            {headerEligible ? <label className="check">
              <input type="checkbox" checked={header.includes(key)} disabled={busy || (!header.includes(key) && header.length >= 6)} onChange={(e) => setHeader((current) => e.target.checked ? [...current, key] : current.filter((id) => id !== key))} />
              In lead header
            </label> : null}
          </li>;
        })}
      </ol>
      <button type="button" className="button primary" disabled={busy} onClick={() => void onSave({ fieldOrder: order, headerFields: order.filter((key) => header.includes(key)) })}>Save field layout</button>
    </details>
  );
}
