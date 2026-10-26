import { worksheetColumns } from './lead-fields.ts';
import { labelFor, type FieldOptions } from './field-options.ts';
/** Presentation order only. Import/export mapping and stored field IDs stay stable. */
export function leadTableColumns(
  config: FieldOptions,
): (readonly [string, string])[] {
  const labels = new Map<string, string>(worksheetColumns);
  const order = [
    'name',
    ...(config.hiddenFields.includes('name') ? ['company'] : []),
    'stage',
    'leadScore',
    'phone',
    'location',
    'zone',
    'source',
    'enquiryDate',
    'legacyStatus',
  ];
  return [
    ...order
      .filter((key) => !config.hiddenFields.includes(key))
      .map(
        (key) =>
          [
            key,
            key === 'leadScore'
              ? 'Lead score'
              : labelFor(
                  config,
                  key,
                  key === 'stage' ? 'Sales stage' : labels.get(key) || key,
                ),
          ] as const,
      ),
    ...config.customFields
      .filter((f) => !f.deleted)
      .map((f) => [f.id, f.label] as const),
  ];
}
