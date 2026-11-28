import { useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { withCurrent } from '../lib/field-options';

export default function LeadStagePicker({ label, stage, stages, busy, onChange }: {
  label: string;
  stage: string;
  stages: string[];
  busy: boolean;
  onChange: (stage: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Select.Root value={stage} open={open}
      onOpenChange={(next) => { if (!next || !busy) setOpen(next); }}
      onValueChange={(value) => { if (open && !busy) onChange(value); }}>
      <Select.Trigger className="lead-stage-trigger" aria-label={label}
        aria-disabled={busy} aria-busy={busy} title={stage}>
        <Select.Value />
        <Select.Icon asChild><ChevronDown size={16} aria-hidden="true" /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={6} collisionPadding={12}
          align="start" className="lead-stage-options" onClick={(event) => event.stopPropagation()}>
          <Select.Viewport className="lead-stage-options-viewport">
            {withCurrent(stages, stage).filter(Boolean).map((value) => (
              <Select.Item key={value} value={value} className="lead-stage-option">
                <Select.ItemText>{value}</Select.ItemText>
                <Select.ItemIndicator><Check size={18} aria-hidden="true" /></Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
