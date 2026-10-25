import { z } from 'zod';
import columns from './report-columns.json' with { type: 'json' };
import { LeadFilters } from './lead-filters.js';
import { AppError } from './contracts.js';
export const LeadExportInput = z
  .object({
    columns: z
      .array(z.string().max(80))
      .min(1)
      .max(80)
      .refine((v) => new Set(v).size === v.length, 'Choose each column once'),
    filters: LeadFilters.default([]),
    stage: z.string().max(100).optional(),
    source: z.string().max(100).optional(),
    search: z.string().max(200).optional(),
    field: z
      .enum(['name', 'company', 'phone', 'email', 'location', 'zone'])
      .optional(),
    cursor: z.string().max(4000).optional(),
    limit: z.number().int().min(1).max(100).default(100),
  })
  .strict();
export function exportColumns(keys, config) {
  return keys.map((key) => {
    const custom = config.customFields.find((f) => f.id === key && !f.deleted);
    if (
      (!Object.hasOwn(columns, key) && !custom) ||
      config.hiddenFields.includes(key)
    )
      throw new AppError(
        400,
        'EXPORT_COLUMN',
        'Choose an available report column',
      );
    return { key, label: custom?.label || config.labels[key] || columns[key] };
  });
}
export function exportRows(leads, selected) {
  return leads.map((lead) => ({
    id: lead.id,
    values: selected.map(({ key }) => {
      const value = key.startsWith('cf_')
        ? lead.customFields?.[key]
        : key === 'phone'
          ? lead.phone || lead.originalPhone
          : lead[key];
      return typeof value === 'boolean'
        ? value
          ? 'Yes'
          : 'No'
        : typeof value === 'number'
          ? value
          : String(value ?? '');
    }),
  }));
}
