import { z } from 'zod';
export const STAGES = [
  'New',
  'Working',
  'Qualified',
  'Meeting booked',
  'Nurture',
  'Disqualified',
  'Won',
];
export const OUTCOMES = [
  'Connected',
  'No answer',
  'Busy',
  'Voicemail',
  'Wrong number',
  'Failed',
];
export const CAPABILITIES = [
  'leads:read',
  'leads:create',
  'leads:edit',
  'activities:write',
  'tasks:write',
  'imports:write',
  'members:write',
  'assignments:write',
];
export const PRESETS = {
  Viewer: ['leads:read'],
  SDR: [
    'leads:read',
    'leads:create',
    'leads:edit',
    'activities:write',
    'tasks:write',
  ],
  Admin: CAPABILITIES,
};
const text = (max = 200) => z.string().trim().max(max);
const date = z.iso.date();
const instant = z.iso.datetime({ offset: true });
export const LeadInput = z
  .object({
    name: text().default(''),
    phone: text(40).default(''),
    email: z.union([z.email().max(254), z.literal('')]).default(''),
    company: text().default(''),
    jobTitle: text().default(''),
    source: text().default('Direct enquiry'),
    location: text().default(''),
    zone: text().default(''),
    enquiryDate: z.union([date, z.literal('')]).default(''),
    stage: text(100).min(1).default('New'),
    comments: text(4000).default(''),
    initialDiscussion: text(4000).default(''),
    followUp1: text(4000).default(''),
    followUp2: text(4000).default(''),
    followUp3: text(4000).default(''),
    followUp4: text(4000).default(''),
    originalPhone: text(200).default(''),
    originalEnquiryDate: text(100).default(''),
    legacyStatus: text().default(''),
    serial: text(80).default(''),
    customFields: z
      .record(
        z.string().regex(/^cf_[a-z0-9_]{1,60}$/),
        z.union([
          z.string().max(4000),
          z.number().finite(),
          z.boolean(),
          z.null(),
        ]),
      )
      .refine((v) => Object.keys(v).length <= 100, 'Too many custom fields')
      .default({}),
    tags: z.array(text(40)).max(20).default([]),
    website: text(300).default(''),
    countryCode: z
      .string()
      .regex(/^\+\d{1,3}$/)
      .default('+91'),
    allowDuplicate: z.boolean().default(false),
    needsReview: z.boolean().default(false),
  })
  .strict();
export const LeadPatch = z
  .object(
    Object.fromEntries(
      Object.entries(LeadInput.shape)
        .filter(([key]) => key !== 'allowDuplicate')
        .map(([key, schema]) => [
          key,
          (schema instanceof z.ZodDefault
            ? schema.removeDefault()
            : schema
          ).optional(),
        ]),
    ),
  )
  .extend({
    expectedVersion: z.number().int().positive(),
    doNotContact: z.boolean().optional(),
    suppressionReason: text(500).optional(),
  })
  .strict();
export const AssignmentPatch = z
  .object({
    expectedVersion: z.number().int().positive(),
    assignedToUid: z.union([text(100).min(1), z.null()]),
  })
  .strict();
export const NotificationPatch = z
  .object({ read: z.boolean().default(true) })
  .strict();
export const TaskInput = z
  .object({
    title: text(250).min(1),
    leadId: text(100).optional(),
    dueAt: instant,
    timezone: text(100).default('Asia/Kolkata'),
    kind: z.enum(['outreach', 'administrative']).default('outreach'),
  })
  .strict();
export const TaskPatch = z
  .object({
    expectedVersion: z.number().int().positive(),
    title: text(250).min(1).optional(),
    kind: z.enum(['outreach', 'administrative']).optional(),
    dueAt: instant.optional(),
    timezone: text(100).optional(),
    state: z.enum(['Pending', 'Completed', 'Cancelled']).optional(),
  })
  .strict();
export const TaskDelete = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();
export const ActivityInput = z
  .object({
    type: z.enum(['call', 'note']),
    outcome: text(100).min(1).optional(),
    disposition: text(100).min(1).default('None'),
    notes: text(4000).default(''),
    durationSeconds: z.number().int().min(0).max(86400).optional(),
    stage: text(100).min(1).optional(),
    followUp: TaskInput.omit({ leadId: true }).optional(),
    expectedVersion: z.number().int().positive(),
  })
  .strict();
export const GrantInput = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    role: z.enum(['Viewer', 'SDR']),
    scope: z.enum(['assigned', 'all']).default('assigned'),
    capabilities: z
      .array(z.enum(CAPABILITIES))
      .max(CAPABILITIES.length)
      .optional(),
  })
  .strict()
  .refine(
    (x) =>
      !x.capabilities?.some((v) =>
        ['members:write', 'assignments:write', 'imports:write'].includes(v),
      ),
    { message: 'Administrative capabilities are reserved for administrators' },
  )
  .refine((x) => !x.capabilities || x.capabilities.includes('leads:read'), {
    message: 'Workspace access requires view permission',
  });
export const MemberPatch = z
  .object({
    active: z.boolean(),
    role: z.enum(['Viewer', 'SDR']),
    scope: z.enum(['assigned', 'all']),
    capabilities: z
      .array(z.enum(CAPABILITIES))
      .max(CAPABILITIES.length)
      .optional(),
    expectedVersion: z.number().int().positive(),
  })
  .strict()
  .refine(
    (x) =>
      !x.capabilities?.some((v) =>
        ['members:write', 'assignments:write', 'imports:write'].includes(v),
      ),
    { message: 'Administrative capabilities are reserved for administrators' },
  )
  .refine((x) => !x.capabilities || x.capabilities.includes('leads:read'), {
    message: 'Workspace access requires view permission',
  });
export const Preferences = z
  .object({
    timezone: text(100),
    appearance: z.enum(['system', 'light', 'dark']),
    bookMode: z.boolean().optional(),
    fontStyle: z.enum(['standard', 'inter', 'source-sans', 'lora']).optional(),
    automaticReminders: z.boolean().optional(),
    reminderTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    nextWeekRule: z.enum(['seven_days', 'next_monday']).optional(),
    moveWeekends: z.boolean().optional(),
  })
  .strict();
export const AutomaticReminderAction = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('retry'),
      expectedRevision: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      action: z.literal('dismiss'),
      expectedRevision: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      action: z.literal('schedule'),
      expectedRevision: z.number().int().positive(),
      task: TaskInput.omit({ leadId: true }),
    })
    .strict(),
]);
export const DeviceInput = z
  .object({
    id: z.uuid(),
    token: z.string().min(20).max(4096),
    label: text(100),
  })
  .strict();
export const ImportComment = z
  .object({
    sourceColumn: text(100).min(1),
    sourceIndex: z.number().int().min(0).max(39),
    notes: text(4000),
  })
  .strict();
export const ImportInput = z
  .object({
    filename: text(250),
    sheet: text(100),
    rows: z.array(z.record(z.string(), z.unknown())).max(5000),
    statusMap: z.record(z.string(), text(100).min(1)).default({}),
    dateOrder: z.enum(['DMY', 'MDY']).default('DMY'),
    blankRows: z.number().int().min(0).default(0),
    duplicateMode: z.enum(['skip', 'keep']).default('skip'),
  })
  .strict();
export function parse(schema, value) {
  const r = schema.safeParse(value);
  if (!r.success)
    throw new AppError(
      400,
      'VALIDATION',
      r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  return r.data;
}
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
