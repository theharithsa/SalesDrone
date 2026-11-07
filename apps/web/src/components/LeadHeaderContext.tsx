import { Phone } from 'lucide-react';

type HeaderField = { id: string; label: string; value: string };

function dialNumber(value: string) {
  const trimmed = value.trim();
  if (!/^\+?[0-9\s().-]+$/.test(trimmed)) return null;
  const dial = trimmed.replace(/[\s().-]/g, '');
  return /^\+?[0-9]{7,15}$/.test(dial) ? dial : null;
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

export default function LeadHeaderContext({ company, phone, fields = [] }: {
  company?: string;
  phone?: string;
  fields?: HeaderField[];
}) {
  return (
    <p className="lead-header-context">
      <span>{company || 'Individual Customer'}</span>
      {phone && <HeaderValue value={phone} phone />}
      {fields.map(({ id, label, value }) => (
        <HeaderValue
          key={id}
          label={label}
          value={value}
          phone={/\b(?:phone|mobile|telephone|tel|whatsapp)\b/i.test(label) || value.trim().startsWith('+') && !!dialNumber(value)}
        />
      ))}
    </p>
  );
}
