import { Phone } from 'lucide-react';

type HeaderField = { id: string; label: string; value: string; phone?: boolean; date?: boolean };

export function dialNumber(value: string) {
  const trimmed = value.trim();
  if (!/^\+?[0-9\s().-]+$/.test(trimmed)) return null;
  const dial = trimmed.replace(/[\s().-]/g, '');
  return /^\+?[0-9]{7,15}$/.test(dial) ? dial : null;
}

function formatHeaderDate(value: string, timezone?: string) {
  const calendarDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!calendarDate && !/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  const date = new Date(calendarDate ? value + 'T00:00:00Z' : value);
  if (!Number.isFinite(date.getTime()) || (calendarDate && date.toISOString().slice(0, 10) !== value)) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: '2-digit', timeZone: calendarDate ? 'UTC' : timezone,
  }).format(date);
}

function HeaderValue({ value, label, phone }: {
  value: string;
  label?: string;
  phone?: boolean;
}) {
  const dial = phone ? dialNumber(value) : null;
  return (
    <span className="lead-header-value" data-dtrum-mask="" data-dt-mask="">
      {dial ? (
        <a className="phone-number" href={'tel:' + dial} aria-label={label ? label + ', ' + value : undefined}>
          <Phone size={14} aria-hidden="true" />
          {value}
        </a>
      ) : (
        <>
          {label && <span className="sr-only">{label}{': '}</span>}
          <span className={phone ? 'phone-number' : undefined}>{value}</span>
        </>
      )}
    </span>
  );
}

export default function LeadHeaderContext({ company, phone, fields = [], allowDial = true, timezone }: {
  company?: string;
  phone?: string;
  fields?: HeaderField[];
  allowDial?: boolean;
  timezone?: string;
}) {
  return (
    <p className="lead-header-context">
      <span>{company || 'Individual Customer'}</span>
      {phone && <HeaderValue value={phone} phone={allowDial} />}
      {fields.map(({ id, label, value, phone: phoneField, date }) => (
        <HeaderValue
          key={id}
          label={label}
          value={date ? formatHeaderDate(value, timezone) : value}
          phone={!date && allowDial && (phoneField || /\b(?:phone|mobile|telephone|tel|whatsapp)\b/i.test(label) || value.trim().startsWith('+') && !!dialNumber(value))}
        />
      ))}
    </p>
  );
}
