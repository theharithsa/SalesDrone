import DEFAULT_FIELD_LABELS from './lead-labels.json' with { type: 'json' };
export { DEFAULT_FIELD_LABELS };
import { z } from 'zod';
import { STAGES, OUTCOMES, AppError } from './contracts.js';
import { ROOT } from './policy.js';
export const FIELD_SETTINGS_PATH = ROOT + '/settings/fields';
export const DEFAULT_FIELD_OPTIONS = {
  source: [
    'Direct enquiry',
    'Website',
    'Referral',
    'Exhibition',
    'Social media',
    'Other',
  ],
  location: [],
  zone: [],
  legacyStatus: ['Call/WA done', 'Samples sent', 'Won/Order placed', 'Quoted'],
  stage: [...STAGES],
  outcome: [...OUTCOMES],
  disposition: [
    'None',
    'Interested',
    'Not interested',
    'Callback requested',
    'Do not contact',
  ],
  countryCode: ['+91', '+1', '+44', '+971', '+65', '+61'],
};
const values = z
  .array(z.string().trim().min(1).max(100))
  .max(100)
  .refine(
    (list) =>
      new Set(list.map((v) => v.normalize('NFKC').toLowerCase())).size ===
      list.length,
    'Remove duplicate values',
  );
export const OPTIONAL_LEAD_FIELDS = [
  ...Object.keys(DEFAULT_FIELD_LABELS).filter(
    (key) => !['name', 'enquiryDate'].includes(key),
  ),
  'followUp1',
  'followUp2',
  'followUp3',
  'followUp4',
];
export const CustomField = z
  .object({
    id: z.string().regex(/^cf_[a-z0-9_]{1,60}$/),
    label: z.string().trim().min(1).max(80),
    type: z.enum(['text', 'textarea', 'number', 'date', 'select', 'checkbox']),
    options: values.default([]),
    required: z.boolean().default(false),
    deleted: z.boolean().default(false),
  })
  .strict()
  .superRefine((f, ctx) => {
    if (f.type === 'select' && !f.deleted && !f.options.length)
      ctx.addIssue({
        code: 'custom',
        message: 'Add at least one dropdown choice',
        path: ['options'],
      });
    if (f.type !== 'select' && f.options.length)
      ctx.addIssue({
        code: 'custom',
        message: 'Only dropdown fields have choices',
        path: ['options'],
      });
  });
export const FieldOptionsPatch = z
  .object({
    expectedVersion: z.number().int().positive(),
    labels: z
      .object(
        Object.fromEntries(
          Object.keys(DEFAULT_FIELD_LABELS).map((key) => [
            key,
            z
              .string()
              .trim()
              .min(1)
              .max(80)
              // eslint-disable-next-line no-control-regex -- Reject control characters in untrusted text.
              .regex(/^[^\r\n\x00-\x1f]+$/),
          ]),
        ),
      )
      .partial()
      .strict()
      .optional(),
    customFields: z.array(CustomField).max(100).optional(),
    hiddenFields: z
      .array(z.enum(OPTIONAL_LEAD_FIELDS))
      .max(25)
      .refine(
        (fields) => !(fields.includes('phone') && fields.includes('email')),
        'Keep Phone number or Email available for contact details',
      )
      .describe('Remove standard fields from enquiry entry and configurable columns. Name and enquiryDate stay visible; at least one of phone or email must remain. Existing records and workflow controls are preserved.')
      .optional(),
    values: z
      .object(
        Object.fromEntries(
          Object.keys(DEFAULT_FIELD_OPTIONS).map((key) => [key, values]),
        ),
      )
      .strict(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const fields = v.customFields || [];
    if (fields.filter((f) => !f.deleted).length > 30)
      ctx.addIssue({
        code: 'custom',
        message: 'Use at most 30 active custom fields',
        path: ['customFields'],
      });
    if (
      new Set(fields.map((f) => f.id)).size !== fields.length ||
      new Set(
        fields
          .filter((f) => !f.deleted)
          .map((f) => f.label.normalize('NFKC').toLowerCase()),
      ).size !== fields.filter((f) => !f.deleted).length
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Field IDs and active labels must be unique',
        path: ['customFields'],
      });
    for (const [key, required] of [
      ['stage', ['New']],
      ['outcome', ['Connected', 'No answer']],
      ['disposition', ['None', 'Do not contact']],
    ])
      for (const value of required)
        if (!v.values[key].includes(value))
          ctx.addIssue({
            code: 'custom',
            message: `Keep the system value ${value}`,
            path: ['values', key],
          });
    if (
      !v.values.countryCode.length ||
      v.values.countryCode.some((v) => !/^\+\d{1,3}$/.test(v))
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Use country codes such as +91',
        path: ['values', 'countryCode'],
      });
  });
export async function readFieldOptions(store) {
  const doc = await store.get(FIELD_SETTINGS_PATH);
  return {
    version: doc?.version || 1,
    values: { ...DEFAULT_FIELD_OPTIONS, ...doc?.values },
    customFields: doc?.customFields || [],
    hiddenFields: doc?.hiddenFields || [],
    labels: { ...DEFAULT_FIELD_LABELS, ...doc?.labels },
  };
}
export function assertFieldOption(config, key, value, previous) {
  if (value === undefined || value === previous) return;
  if (!config.values[key]?.includes(value))
    throw new AppError(
      400,
      'FIELD_OPTION',
      `Choose a configured ${key} value. Ask an admin to add it in Settings.`,
    );
}

export function mergeFieldSettings(current, input) {
  const fields = input.customFields || current.customFields;
  for (const old of current.customFields) {
    const next = fields.find((f) => f.id === old.id);
    if (!next || next.type !== old.type || (old.deleted && !next.deleted))
      throw new AppError(
        400,
        'FIELD_DEFINITION',
        'Retire existing fields without changing their IDs or types. Retired IDs cannot be reused.',
      );
  }
  const labels = {
    ...DEFAULT_FIELD_LABELS,
    ...current.labels,
    ...input.labels,
  };
  const activeLabels = [
    ...Object.values(labels),
    ...fields.filter((f) => !f.deleted).map((f) => f.label),
  ];
  if (
    new Set(activeLabels.map((v) => v.normalize('NFKC').toLowerCase())).size !==
    activeLabels.length
  )
    throw new AppError(
      400,
      'FIELD_LABEL',
      'Use distinct names for built-in and custom fields',
    );
  return {
    labels,
    values: input.values,
    customFields: fields,
    hiddenFields: input.hiddenFields || current.hiddenFields,
  };
}
export function validateCustomValues(
  config,
  values,
  previous = {},
  requireAll = true,
) {
  const fields = config.customFields || [];
  for (const [id, value] of Object.entries(values || {})) {
    const field = fields.find((f) => f.id === id);
    if (!field || field.deleted) {
      if (!(id in previous) || previous[id] !== value)
        throw new AppError(
          400,
          'CUSTOM_FIELD',
          'This custom field is no longer available. Refresh the form.',
        );
      continue;
    }
    if (value === '' || value === null) continue;
    const valid =
      field.type === 'checkbox'
        ? typeof value === 'boolean'
        : field.type === 'number'
          ? typeof value === 'number' && Number.isFinite(value)
          : field.type === 'date'
            ? z.iso.date().safeParse(value).success
            : typeof value === 'string' &&
              value.length <= (field.type === 'textarea' ? 4000 : 500) &&
              (field.type !== 'select' ||
                field.options.includes(value) ||
                previous[id] === value);
    if (!valid)
      throw new AppError(
        400,
        'CUSTOM_FIELD',
        `Enter a valid value for ${field.label}`,
      );
  }
  if (requireAll)
    for (const f of fields.filter((f) => !f.deleted && f.required)) {
      const value = values?.[f.id];
      if (
        value === undefined ||
        value === null ||
        value === '' ||
        (f.type === 'checkbox' && value !== true)
      )
        throw new AppError(
          400,
          'CUSTOM_FIELD_REQUIRED',
          `${f.label} is required`,
        );
    }
}
