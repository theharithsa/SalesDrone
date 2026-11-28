import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import type { DateInputEntryError } from '@astryxdesign/core/DateInput';
import type { ISODateString } from '@astryxdesign/core/Calendar';
import './workspace-date-field.css';

const DateInput = lazy(() => import('./WorkspaceCalendarInput'));

type DateFieldProps = {
  label: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  min?: string;
  required?: boolean;
  disabled?: boolean;
};

export function WorkspaceDateField({
  label, name, value, defaultValue = '', onValueChange, min, required, disabled,
}: DateFieldProps) {
  const [draft, setDraft] = useState(defaultValue);
  const [entryError, setEntryError] = useState<DateInputEntryError | null>(null);
  const [validation, setValidation] = useState('');
  const dateLabelId = useId();
  const picker = useRef<HTMLInputElement>(null);
  const formField = useRef<HTMLInputElement>(null);
  const selected = value ?? draft;
  const inputError = entryError ? 'Enter a valid date.' : '';

  useEffect(() => {
    formField.current?.setCustomValidity(inputError);
  }, [inputError]);

  function update(next = '') {
    setDraft(next);
    setValidation('');
    onValueChange?.(next);
  }

  return <div className="workspace-date-field" role="group" aria-labelledby={dateLabelId}>
    <span className="field-label" id={dateLabelId}>{label}</span>
    <Suspense fallback={<div className="workspace-date-loading" role="status">Loading calendar…</div>}>
      <DateInput
        label={label}
        isLabelHidden
        ref={picker}
        value={selected ? selected as ISODateString : undefined}
        onChange={update}
        onEntryErrorChange={setEntryError}
        min={min ? min as ISODateString : undefined}
        isRequired={required}
        isDisabled={disabled}
        hasClear={!required}
        status={validation ? { type: 'error', message: validation } : undefined}
        presentation="adaptive-bottom-sheet"
        format="date"
        weekStartsOn="mon"
        width="100%"
        controlStyle={{ minHeight: 'var(--control-height)' }}
      />
    </Suspense>
    <input
      className="sr-only workspace-date-validation"
      ref={formField}
      type="date"
      name={name}
      tabIndex={-1}
      aria-hidden="true"
      value={selected}
      required={required}
      min={min}
      disabled={disabled}
      onChange={(event) => update(event.target.value)}
      onInvalid={(event) => {
        event.preventDefault();
        setValidation(event.currentTarget.validationMessage);
        picker.current?.focus();
      }}
    />
  </div>;
}

export function WorkspaceDateTimeField({
  label, name, defaultValue = '', onValueChange, required, disabled,
}: Omit<DateFieldProps, 'value' | 'min'>) {
  const [initialDate, initialTime = ''] = defaultValue.split('T');
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const labelId = useId();

  function update(nextDate: string, nextTime: string) {
    setDate(nextDate);
    setTime(nextTime);
    onValueChange?.(nextDate && nextTime ? nextDate + 'T' + nextTime : '');
  }

  return <div className="workspace-date-time" role="group" aria-labelledby={labelId}>
    <span className="field-label" id={labelId}>{label}</span>
    <div className="workspace-date-time-fields">
      <WorkspaceDateField
        label="Date"
        value={date}
        onValueChange={(next) => update(next, time)}
        required={required}
        disabled={disabled}
      />
      <label className="material-field">
        <span className="field-label">Time</span>
        <input type="time" value={time} onChange={(event) => update(date, event.target.value)} required={required} disabled={disabled} />
      </label>
    </div>
    <input type="hidden" name={name} value={date && time ? date + 'T' + time : ''} disabled={disabled} />
  </div>;
}
