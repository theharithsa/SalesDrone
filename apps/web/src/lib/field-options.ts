import standardFieldLabels from '../../../../functions/src/lead-labels.json';
export { standardFieldLabels };
import { stages, outcomes } from './types';
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
export const optionalLeadFields = {
  source: 'Enquiry source',
  company: 'Company name',
  location: 'City / location',
  zone: 'Sector',
  legacyStatus: 'Enquiry status',
  initialDiscussion: 'Initial discussion',
};
export type FieldOptions = {
  labels?: Record<string, string>;
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
