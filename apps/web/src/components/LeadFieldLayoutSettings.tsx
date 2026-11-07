import { useEffect, useLayoutEffect, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { labelFor, orderedFields, standardFieldLabels, type FieldOptions } from '../lib/field-options';
import LeadHeaderContext from './LeadHeaderContext';
import { ErrorMessage, SaveButton, useSubmit } from './UI';

const fixedHeaderFields = new Set(['company', 'phone', 'name', 'stage', 'assignedToUid', 'outcome', 'disposition']);
const headerLimit = 6;
const examples: Record<string, string> = {
  source: 'Referral', location: 'North district', zone: 'Commercial',
  email: 'asha@example.com', enquiryDate: '7 Nov', legacyStatus: 'Samples sent',
};

export default function LeadFieldLayoutSettings({ config, mode, request, onChanged, onEditingChange }: {
  config: FieldOptions;
  mode: 'order' | 'header';
  request: (path: string, method: string, body: Record<string, unknown>) => Promise<FieldOptions>;
  onChanged: (options: FieldOptions) => void;
  onEditingChange?: (state: { dirty: boolean; busy: boolean }) => void;
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
  const [baseline, setBaseline] = useState(() => ({ order, header }));
  const isOrder = mode === 'order';
  const draft = isOrder ? order : headerFields.filter((key) => header.includes(key));
  const dirty = JSON.stringify(draft) !== JSON.stringify(isOrder ? baseline.order : baseline.header);
  const getLabel = (key: string) => custom.find((field) => field.id === key)?.label
    || labelFor(config, key, key === 'createdAt' ? 'Created at' : undefined);
  const [saved, setSaved] = useState(false);
  const [expectedVersion, setExpectedVersion] = useState(config.version);
  const submit = useSubmit(async (change, _key, isCurrent) => {
    const result = await request('/field-options', 'PATCH', {
      expectedVersion,
      values: config.values,
      ...change,
    });
    if (isCurrent()) {
      setExpectedVersion(result.version);
      setBaseline({ order, header: isOrder ? header : draft });
      onChanged(result);
      setSaved(true);
    }
  });

  useLayoutEffect(() => { onEditingChange?.({ dirty, busy: submit.busy }); }, [dirty, submit.busy, onEditingChange]);
  useEffect(() => () => onEditingChange?.({ dirty: false, busy: false }), [onEditingChange]);

  function discard() {
    const selected = headerFields.filter((key) => config.headerFields?.includes(key));
    setBaseline({ order: available, header: selected });
    setExpectedVersion(config.version);
    setOrder(available);
    setHeader(selected);
    setSaved(false);
  }

  useEffect(() => {
    if (!dirty && !submit.busy && config.version > expectedVersion) discard();
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
      if (!dirty) return;
      setSaved(false);
      void submit.run(isOrder ? { fieldOrder: draft } : { headerFields: draft });
    }}>
      <p className="field-hint">{isOrder
        ? 'Arrange fields for enquiry forms, the Leads table and Excel exports.'
        : 'Choose up to six fields to show under the lead name and contact details. Fields appear when they have a value.'}</p>
      {!isOrder && <>
        <div className="settings-header-example">
          <small>Live preview · fictional lead</small>
          <h3>Asha Raman</h3>
          <LeadHeaderContext company="Northstar Buildworks" phone="+1 202 555 0100" fields={draft.map((id) => {
            return { id, label: getLabel(id), value: examples[id] || 'Sample ' + getLabel(id).toLowerCase() };
          })} />
        </div>
        <p className="field-hint" role="status">{header.length} of {headerLimit} selected</p>
      </>}
      <ol>
        {(isOrder ? order : headerFields).map((key, index) => {
          const label = getLabel(key);
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
      <div className="form-footer field-layout-actions settings-save-actions">
        <span role="status">{submit.busy ? '' : dirty ? 'Unsaved changes' : saved ? 'Saved.' : ''}</span>
        <div>
          <button className="button" type="button" disabled={!dirty || submit.busy} onClick={discard}>Discard changes</button>
          <SaveButton busy={submit.busy} disabled={!dirty} label={isOrder ? 'Save field order' : 'Save lead header'} />
        </div>
      </div>
    </form>
  );
}
