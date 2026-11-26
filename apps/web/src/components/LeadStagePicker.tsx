import { useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { withCurrent } from '../lib/field-options';
import { Modal } from './UI';

export default function LeadStagePicker({ label, stage, stages, busy, onChange }: {
  label: string;
  stage: string;
  stages: string[];
  busy: boolean;
  onChange: (stage: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="lead-stage-trigger"
        aria-label={label + ', ' + stage}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-busy={busy}
        aria-disabled={busy}
        onClick={() => { if (!busy) setOpen(true); }}
      >
        <span>{stage}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {open && <Modal
        open
        onClose={() => setOpen(false)}
        title={label}
        description="Choose the lead’s current stage."
        returnFocusRef={trigger}
        initialFocusRef={current}
      >
        <ul className="lead-stage-options">
          {withCurrent(stages, stage).map((value) => (
            <li key={value}>
              <button
                ref={value === stage ? current : undefined}
                type="button"
                aria-pressed={value === stage}
                onClick={() => {
                  setOpen(false);
                  if (value !== stage) onChange(value);
                }}
              >
                <span>{value}</span>
                {value === stage && <Check size={20} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      </Modal>}
    </>
  );
}
