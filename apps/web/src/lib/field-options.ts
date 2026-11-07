import standardFieldLabels from '../../../../functions/src/lead-labels.json' with { type: 'json' };
export { standardFieldLabels };
import { stages, outcomes } from './types.ts';
export const defaultFieldValues = {
  source: [
    'Direct enquiry',
    'Website',
    'Referral',
    'Exhibition',
    'Social media',
    'Other',
  ],
  location: [] as string[],
  zone: [] as string[],
  legacyStatus: ['Call/WA done', 'Samples sent', 'Won/Order placed', 'Quoted'],
  stage: [...stages],
  outcome: [...outcomes],
  disposition: [
    'None',
    'Interested',
    'Not interested',
    'Callback requested',
    'Do not contact',
  ],
  countryCode: ['+91', '+1', '+44', '+971', '+65', '+61'],
};
export type FieldKey = keyof typeof defaultFieldValues;
export type CustomField = {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox';
  options: string[];
  required: boolean;
  deleted: boolean;
};
export function fieldRemovalReason(_config: FieldOptions, key: string) {
  if (key === 'phone' || key === 'enquiryDate')
    return 'Required to save an enquiry';
  return '';
}
export type FieldOptions = {
  labels?: Record<string, string>;
  fieldOrder?: string[];
  headerFields?: string[];
  customFields: CustomField[];
  hiddenFields: string[];
  version: number;
  values: Record<FieldKey, string[]>;
};
export const defaultFieldOptions: FieldOptions = {
  version: 1,
  labels: standardFieldLabels,
  customFields: [],
  hiddenFields: [],
  values: defaultFieldValues,
};
export const fieldLabels: Record<FieldKey, string> = {
  source: 'Enquiry sources',
  location: 'Cities / locations',
  zone: 'Sectors',
  legacyStatus: 'Enquiry statuses',
  stage: 'Sales stages',
  outcome: 'Call outcomes',
  disposition: 'Call dispositions',
  countryCode: 'Country codes',
};
export const withCurrent = (values: string[], current?: string) =>
  current && !values.includes(current) ? [current, ...values] : values;

export function labelFor(config: FieldOptions, key: string, fallback?: string) {
  return (
    config.labels?.[key] ||
    (standardFieldLabels as Record<string, string>)[key] ||
    fallback ||
    key
  );
}

export function orderedFields<T>(config: FieldOptions, fields: T[], key: (field: T) => string): T[] {
  const order = new Map((config.fieldOrder || []).map((id, i) => [id, i]));
  return fields.slice().sort((a, b) => (order.get(key(a)) ?? Infinity) - (order.get(key(b)) ?? Infinity));
}

export function leadFieldValue(lead: Record<string, any>, key: string): string {
  const value = key.startsWith('cf_') ? lead.customFields?.[key] : lead[key];
  return typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '');
}
