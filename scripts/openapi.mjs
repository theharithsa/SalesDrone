import { WorkspaceSettingsPatch } from '../functions/src/workspace-settings.js';
import { LeadExportInput } from '../functions/src/lead-reports.js';
import { AISettingsPatch } from '../functions/src/ai-settings.js';
import {
  TokenInput,
  TOKEN_SCOPES,
  PAT_ROUTES,
} from '../functions/src/personal-access-tokens.js';
import { ScoringPatch } from '../functions/src/scoring.js';
import { FieldOptionsPatch } from '../functions/src/field-options.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { z } from 'zod';
import { LeadFilters } from '../functions/src/lead-filters.js';
import * as contracts from '../functions/src/contracts.js';
const names = [
  'LeadInput',
  'LeadPatch',
  'AssignmentPatch',
  'NotificationPatch',
  'TaskInput',
  'TaskPatch',
  'TaskDelete',
  'ActivityInput',
  'AutomaticReminderAction',
  'GrantInput',
  'MemberPatch',
  'Preferences',
  'DeviceInput',
  'ImportInput',
  'ImportComment',
];
const schemas = Object.fromEntries(
  names.map((n) => [
    n,
    z.toJSONSchema(contracts[n], { target: 'draft-2020-12', io: 'input' }),
  ]),
);
schemas.Preferences.properties.bookMode.description =
  'Personal reading style, default false. Omission preserves the stored value; does not alter theme, timezone or permissions.';
schemas.Preferences.properties.fontStyle.description =
  'Personal interface font: standard (default), inter, source-sans or lora. Omission preserves the saved value. Book mode keeps its own serif family; no authorization change. Google sign-in/App Check only; PAT writes denied.';
schemas.ImportInput.properties.rows.items.properties = {
  importComments: {
    type: 'array',
    maxItems: 40,
    items: { $ref: '#/components/schemas/ImportComment' },
    description:
      'Each nonempty selected spreadsheet cell becomes a separate historical note. Other keys are standard lead fields.',
  },
};
schemas.ScoringPatch = z.toJSONSchema(ScoringPatch, { io: 'input' });
schemas.TokenInput = z.toJSONSchema(TokenInput, { io: 'input' });
schemas.TokenInput.properties.scopes.uniqueItems = true;
schemas.TokenInput.description =
  'Google-authenticated administrators only. Choose at least one unique permission scope. The raw token is returned once and is never stored in an idempotency response.';
schemas.EmptyInput = { type: 'object', additionalProperties: false };
schemas.ScoringConfig = {
  type: 'object',
  required: ['version', 'enabled', 'factors'],
  properties: {
    version: { type: 'integer' },
    enabled: { type: 'boolean' },
    factors: schemas.ScoringPatch.properties.factors,
  },
};
schemas.LeadScore = {
  type: 'object',
  required: ['status', 'score'],
  properties: {
    leadId: { type: 'string' },
    status: {
      type: 'string',
      enum: ['Ready', 'Pending', 'Processing', 'Stale', 'Failed', 'Disabled'],
    },
    score: { type: ['integer', 'null'], minimum: 0, maximum: 100 },
    factors: { type: 'array', items: { type: 'object' } },
    coverage: { type: 'integer' },
    knownFactors: { type: 'integer' },
    totalFactors: { type: 'integer' },
    scoredAt: { type: 'string' },
    band: { type: 'string' },
  },
};
schemas.Dashboard = {
  type: 'object',
  required: [
    'asOf',
    'facts',
    'coverage',
    'trend',
    'stages',
    'tasks',
    'priority',
  ],
  properties: {
    asOf: { type: 'string' },
    insightMode: {
      type: 'string',
      enum: ['manual', 'automatic'],
      description:
        'Workspace dashboard mode only; custom AI instructions are not exposed.',
    },
    timezone: { type: 'string' },
    facts: { type: 'object', additionalProperties: { type: 'number' } },
    coverage: { type: 'object' },
    trend: { type: 'array', items: { type: 'object' } },
    stages: { type: 'array', items: { type: 'object' } },
    tasks: { type: 'array', items: { type: 'object' } },
    priority: { type: 'array', items: { type: 'object' } },
  },
};
schemas.DashboardBrief = {
  type: 'object',
  required: ['status'],
  properties: {
    status: { type: 'string', enum: ['Ready', 'Processing', 'Unavailable'] },
    brief: {
      type: 'object',
      properties: {
        headline: { type: 'string' },
        summary: { type: 'string' },
        insights: { type: 'array', items: { type: 'object' } },
      },
    },
    generatedAt: { type: 'string' },
    expiresAt: { type: 'string' },
  },
};
schemas.LeadFilters = z.toJSONSchema(LeadFilters, { io: 'input' });
schemas.WorkspaceSettingsPatch = z.toJSONSchema(WorkspaceSettingsPatch, {
  io: 'input',
});
schemas.LeadExportInput = z.toJSONSchema(LeadExportInput, { io: 'input' });
schemas.LeadExportInput.properties.columns.uniqueItems = true;
schemas.WorkspaceSettings = {
  type: 'object',
  required: ['version', 'exportsEnabled', 'assignedOnly'],
  properties: {
    version: { type: 'integer', minimum: 1 },
    exportsEnabled: { type: 'boolean' },
    assignedOnly: { type: 'boolean' },
  },
};
schemas.LeadExportPage = {
  type: 'object',
  required: ['columns', 'rows', 'nextCursor', 'policyVersion', 'asOf'],
  properties: {
    columns: {
      type: 'array',
      items: {
        type: 'object',
        required: ['key', 'label'],
        properties: { key: { type: 'string' }, label: { type: 'string' } },
      },
    },
    rows: {
      type: 'array',
      maxItems: 100,
      items: {
        type: 'object',
        required: ['id', 'values'],
        properties: {
          id: { type: 'string' },
          values: { type: 'array', items: { type: ['string', 'number'] } },
        },
      },
    },
    nextCursor: { type: ['string', 'null'] },
    scanLimited: { type: 'boolean' },
    policyVersion: { type: 'integer' },
    asOf: { type: 'string', format: 'date-time' },
  },
};
schemas.AISettingsPatch = z.toJSONSchema(AISettingsPatch, { io: 'input' });
schemas.AISettings = {
  type: 'object',
  required: [
    'version',
    'instructions',
    'defaultInstructions',
    'usingDefault',
    'insightMode',
  ],
  properties: {
    version: { type: 'integer', minimum: 1 },
    instructions: { type: 'string', maxLength: 4000 },
    insightMode: { type: 'string', enum: ['manual', 'automatic'] },
    defaultInstructions: { type: 'string' },
    usingDefault: { type: 'boolean' },
  },
};
schemas.FieldOptionsPatch = z.toJSONSchema(FieldOptionsPatch, { io: 'input' });
schemas.FieldOptions = {
  type: 'object',
  required: ['version', 'values'],
  properties: {
    version: { type: 'integer', minimum: 1 },
    values: schemas.FieldOptionsPatch.properties.values,
    labels: schemas.FieldOptionsPatch.properties.labels,
    customFields: schemas.FieldOptionsPatch.properties.customFields,
    hiddenFields: schemas.FieldOptionsPatch.properties.hiddenFields,
  },
};
schemas.Error = {
  type: 'object',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message', 'requestId'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        requestId: { type: 'string' },
        details: {},
      },
    },
  },
};
schemas.Page = {
  type: 'object',
  required: ['items', 'nextCursor'],
  properties: {
    items: { type: 'array', items: { type: 'object' } },
    nextCursor: { type: ['string', 'null'] },
    scanLimited: { type: 'boolean' },
  },
};
const string = { type: 'string' };
const integer = { type: 'integer', minimum: 0 };
const instant = { type: 'string', format: 'date-time' };
const nullableInstant = { type: ['string', 'null'], format: 'date-time' };
const object = (properties, required = Object.keys(properties)) => ({
  type: 'object',
  properties,
  required,
});
const ref = (name) => ({ $ref: '#/components/schemas/' + name });
const pageOf = (name) =>
  object({
    items: { type: 'array', items: ref(name) },
    nextCursor: { type: ['string', 'null'] },
  });
schemas.Lead = object(
  {
    ...schemas.LeadInput.properties,
    id: string,
    version: integer,
    assignedToUid: { type: ['string', 'null'] },
    createdByUid: { type: ['string', 'null'] },
    createdAt: instant,
    updatedAt: instant,
    lastContactAt: nullableInstant,
    lastCallOutcome: {
      type: ['string', 'null'],
      enum: [...contracts.OUTCOMES, null],
    },
    doNotContact: { type: 'boolean' },
    suppressionReason: string,
    archived: { type: 'boolean' },
  },
  ['id', 'name', 'stage', 'version', 'assignedToUid', 'createdAt', 'updatedAt'],
);
delete schemas.Lead.properties.allowDuplicate;
schemas.Task = object({
  ...schemas.TaskInput.properties,
  id: string,
  leadId: { type: ['string', 'null'] },
  creatorUid: string,
  recipientUid: string,
  state: { type: 'string', enum: ['Pending', 'Completed', 'Cancelled'] },
  version: integer,
  createdAt: instant,
  completedAt: nullableInstant,
});
schemas.AutomaticReminder = object(
  {
    id: string,
    status: {
      type: 'string',
      enum: [
        'Pending',
        'Scheduled',
        'NeedsReview',
        'NoAction',
        'Failed',
        'Cancelled',
        'Manual',
        'Disabled',
        'Dismissed',
        'TaskChanged',
      ],
    },
    ownerUid: string,
    taskId: { type: ['string', 'null'] },
    message: string,
    dueAt: instant,
    timezone: string,
    processedAt: instant,
  },
  ['id', 'status', 'ownerUid', 'taskId', 'message'],
);
schemas.Activity = object(
  {
    id: string,
    leadId: string,
    type: { type: 'string', enum: ['call', 'note', 'change'] },
    outcome: string,
    disposition: string,
    notes: string,
    createdAt: instant,
    actorUid: string,
    revision: integer,
    autoReminder: ref('AutomaticReminder'),
    sourceColumn: string,
    sourceOrder: integer,
    imported: { type: 'boolean' },
    occurredAt: nullableInstant,
  },
  ['id', 'leadId', 'type', 'notes', 'createdAt'],
);
schemas.Member = object({
  id: string,
  uid: string,
  email: { type: 'string', format: 'email' },
  name: string,
  role: { type: 'string', enum: ['Admin', 'Viewer', 'SDR'] },
  scope: { type: 'string', enum: ['all', 'assigned'] },
  capabilities: {
    type: 'array',
    items: { type: 'string', enum: contracts.CAPABILITIES },
  },
  active: { type: 'boolean' },
  version: integer,
});
schemas.Invitation = object({
  id: string,
  email: { type: 'string', format: 'email' },
  role: { type: 'string', enum: ['Viewer', 'SDR'] },
  scope: { type: 'string', enum: ['all', 'assigned'] },
  capabilities: { type: 'array', items: { type: 'string' } },
  active: { type: 'boolean' },
  expiresAt: instant,
  version: integer,
});
schemas.Profile = object({
  identity: object({
    uid: string,
    email: { type: 'string', format: 'email' },
    name: string,
  }),
  mode: { type: 'string', enum: ['live', 'demo'] },
  member: { anyOf: [ref('Member'), { type: 'null' }] },
  preferences: ref('Preferences'),
  invitation: {
    anyOf: [
      object({ id: string, role: string, scope: string }),
      { type: 'null' },
    ],
  },
});
schemas.Profile.properties.identity.properties.photoURL = {
  type: 'string',
  description:
    'Google profile photo URL when available; initials are used otherwise.',
};
schemas.Notification = object(
  {
    id: string,
    taskId: { type: ['string', 'null'] },
    kind: {
      type: 'string',
      enum: ['task_reminder', 'lead_created', 'lead_assigned'],
    },
    body: string,
    leadId: { type: ['string', 'null'] },
    workspaceId: string,
    title: string,
    createdAt: instant,
    readAt: nullableInstant,
  },
  ['id', 'taskId', 'leadId', 'workspaceId', 'title', 'createdAt', 'readAt'],
);
schemas.Device = object(
  {
    id: string,
    label: string,
    enabled: { type: 'boolean' },
    lastSeenAt: instant,
  },
  ['id', 'label', 'enabled'],
);
schemas.ImportError = object({ index: integer, error: string });
schemas.ImportJob = object({
  id: string,
  filename: string,
  sheet: string,
  total: integer,
  valid: integer,
  invalid: integer,
  blank: integer,
  offset: integer,
  imported: integer,
  duplicates: integer,
  failed: integer,
  status: { type: 'string', enum: ['Preview', 'Importing', 'Completed'] },
  createdByUid: string,
  createdAt: instant,
  expiresAt: instant,
  errors: { type: 'array', items: ref('ImportError') },
});
schemas.ImportJob.properties.commentCount = {
  ...integer,
  description:
    'Nonempty comment entries in valid preview rows, before duplicate-contact skipping.',
};
schemas.ImportJob.properties.chunkSize = {
  type: 'integer',
  minimum: 1,
  description:
    'New previews use 11 rows per commit; older previews may use 25.',
};
schemas.Summary = object({
  total: integer,
  newLeads: integer,
  due: integer,
  calls: integer,
  connected: integer,
  period: string,
});
schemas.CallSaved = object({ activity: ref('Activity'), lead: ref('Lead') });
schemas.Ok = object({ ok: { type: 'boolean' } });
schemas.PersonalAccessToken = object(
  {
    id: string,
    name: string,
    prefix: string,
    scopes: {
      type: 'array',
      items: { type: 'string', enum: TOKEN_SCOPES.map((s) => s.id) },
    },
    createdAt: instant,
    expiresAt: instant,
    lastUsedAt: nullableInstant,
    revokedAt: nullableInstant,
    active: { type: 'boolean' },
  },
  ['id', 'name', 'prefix', 'scopes', 'createdAt', 'expiresAt', 'active'],
);
schemas.TokenCreated = object(
  {
    token: {
      type: 'string',
      readOnly: true,
      description:
        'One-time raw Bearer credential. Store securely; never put in a URL.',
    },
    personalAccessToken: ref('PersonalAccessToken'),
  },
  ['token', 'personalAccessToken'],
);
schemas.TokenPage = object(
  {
    items: { type: 'array', items: ref('PersonalAccessToken') },
    nextCursor: { type: ['string', 'null'] },
    availableScopes: {
      type: 'array',
      items: object({ id: string, description: string, capability: string }),
    },
    maxActiveTokens: { type: 'integer', const: 20 },
  },
  ['items', 'nextCursor', 'availableScopes', 'maxActiveTokens'],
);
const responseFor = (method, url) => {
  if (url === '/personal-access-tokens')
    return ref(method === 'get' ? 'TokenPage' : 'TokenCreated');
  if (url.startsWith('/personal-access-tokens/')) return ref('Ok');
  if (url.endsWith('/journey'))
    return {
      type: 'object',
      required: ['items', 'nextCursor', 'currentStage', 'historyComplete'],
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              leadId: { type: 'string' },
              from: { type: ['string', 'null'] },
              to: { type: 'string' },
              leadVersion: { type: 'integer' },
              createdAt: { type: 'string', format: 'date-time' },
              reason: { type: 'string' },
            },
          },
        },
        nextCursor: { type: ['string', 'null'] },
        currentStage: { type: 'string' },
        historyComplete: {
          type: 'boolean',
          description:
            'Whether an app-creation transition is recorded; never fabricated for legacy leads.',
        },
      },
    };
  if (url === '/workspace-settings') return ref('WorkspaceSettings');
  if (url === '/leads/export') return ref('LeadExportPage');
  if (url === '/ai-settings') return ref('AISettings');
  if (url === '/scoring-settings') return ref('ScoringConfig');
  if (url === '/lead-scores')
    return {
      type: 'object',
      properties: { items: { type: 'array', items: ref('LeadScore') } },
    };
  if (url.includes('/score')) return ref('LeadScore');
  if (url === '/dashboard') return ref('Dashboard');
  if (url === '/dashboard/insights') return ref('DashboardBrief');
  if (url === '/field-options') return ref('FieldOptions');
  if (method === 'delete' && url.startsWith('/tasks/')) return ref('Ok');
  if (url === '/me') return ref(method === 'get' ? 'Profile' : 'Preferences');
  if (url === '/summary') return ref('Summary');
  if (url.includes('/imports/') && url.endsWith('/errors'))
    return pageOf('ImportError');
  if (url.startsWith('/imports')) return ref('ImportJob');
  if (url.endsWith('/automatic-reminder') || url.includes('/corrections'))
    return ref('Activity');
  if (url.includes('/activities'))
    return method === 'get' ? pageOf('Activity') : ref('CallSaved');
  if (url.includes('/corrections')) return ref('Activity');
  if (url === '/members') return pageOf('Member');
  if (url.startsWith('/members/')) return ref('Member');
  if (url === '/invitations')
    return method === 'get' ? pageOf('Invitation') : ref('Invitation');
  if (url.includes('/invitations/')) return ref('Ok');
  if (url === '/leads' && method === 'get') return pageOf('Lead');
  if (url.endsWith('/archive')) return ref('Ok');
  if (url.startsWith('/leads')) return ref('Lead');
  if (url === '/tasks' && method === 'get') return pageOf('Task');
  if (url.startsWith('/tasks')) return ref('Task');
  if (url === '/notifications' && method === 'get')
    return pageOf('Notification');
  if (url === '/devices')
    return method === 'get' ? pageOf('Device') : ref('Device');
  return ref('Ok');
};
const source = await readFile(
  new URL('../functions/src/app.js', import.meta.url),
  'utf8',
);
const endpoints = [
  ...source.matchAll(
    /route\(\s*['"](get|post|patch|delete)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*([^,]+),/g,
  ),
].map((m) => ({
  method: m[1],
  url: m[2],
  capability:
    m[3].trim() === 'null'
      ? 'Active workspace membership'
      : m[3].replaceAll("'", '').replaceAll('"', '').trim(),
}));
endpoints.push(
  { method: 'get', url: '/me', capability: 'Google sign-in' },
  {
    method: 'post',
    url: '/invitations/:id/accept',
    capability: 'Matching verified Google identity',
  },
);
const bodyFor = (m, u) =>
  u === '/workspace-settings'
    ? 'WorkspaceSettingsPatch'
    : u === '/leads/export'
      ? 'LeadExportInput'
      : u === '/personal-access-tokens' && m === 'post'
        ? 'TokenInput'
        : u === '/ai-settings'
          ? 'AISettingsPatch'
          : u === '/scoring-settings'
            ? 'ScoringPatch'
            : u.endsWith('/score/refresh') || u === '/dashboard/insights'
              ? 'EmptyInput'
              : u === '/field-options'
                ? 'FieldOptionsPatch'
                : u.endsWith('/assignment')
                  ? 'AssignmentPatch'
                  : u === '/notifications/:id'
                    ? 'NotificationPatch'
                    : u === '/me'
                      ? 'Preferences'
                      : u.endsWith('/automatic-reminder')
                        ? 'AutomaticReminderAction'
                        : u === '/leads'
                          ? 'LeadInput'
                          : u === '/leads/:id'
                            ? 'LeadPatch'
                            : u.endsWith('/activities')
                              ? 'ActivityInput'
                              : u === '/tasks'
                                ? 'TaskInput'
                                : u === '/tasks/:id'
                                  ? m === 'delete'
                                    ? 'TaskDelete'
                                    : 'TaskPatch'
                                  : u === '/invitations'
                                    ? 'GrantInput'
                                    : u === '/members/:uid'
                                      ? 'MemberPatch'
                                      : u === '/devices'
                                        ? 'DeviceInput'
                                        : u === '/imports/preview'
                                          ? 'ImportInput'
                                          : null;
const paths = {};
for (const e of endpoints) {
  const url = '/api/v1' + e.url.replace(/:([a-zA-Z]+)/g, '{$1}');
  const operation = {
    operationId: e.method + e.url.replace(/[^a-zA-Z]/g, '_'),
    summary: e.method.toUpperCase() + ' ' + e.url,
    description: `Requires: ${e.capability}.${e.url === '/ai-settings' ? ' Admin-only workspace AI preferences; blank instructions restore defaults. Changes invalidate summary caches and stale generation cannot publish.' : ''} ${PAT_ROUTES[e.method + ' ' + e.url] ? 'Personal access token scope: ' + PAT_ROUTES[e.method + ' ' + e.url] + '.' : 'Google sign-in and App Check required; personal access tokens are not accepted.'} Server verifies current membership and assigned/all lead scope. Private responses use Cache-Control: no-store.${e.url === '/leads/export' ? ' Paged report data, not a binary file. Export must be enabled. Uses all supplied lead filters; selected available columns only. Follow nextCursor, including sparse pages, until null. Cursors bind filters, column order, field configuration and workspace policy. Audit records contain counts only. Maximum 120 pages per user per minute. Rows reflect current values while paging, not a transactional snapshot.' : ''}${e.url === '/workspace-settings' ? ' PATCH requires Admin role and members:write. assignedOnly defaults true and caps non-admin scope; false restores each member’s configured scope. exportsEnabled defaults true. Reads are allowed to active workspace members.' : ''}${e.url === '/leads/:id/activities' && e.method === 'post' ? ' Including stage requires leads:edit; including a manual followUp requires tasks:write. Notes may trigger automatic reminder analysis according to owner preferences.' : ''}${e.url === '/personal-access-tokens' && e.method === 'post' ? ' Admin-only. Do not send Idempotency-Key. Token is shown once; list and delete metadata never include the credential or its hash.' : ''}`,
    tags: [e.url.split('/')[1]],
    security: PAT_ROUTES[e.method + ' ' + e.url]
      ? [{ personalAccessToken: [] }, { firebaseIdToken: [], appCheck: [] }]
      : [{ firebaseIdToken: [], appCheck: [] }],
    'x-personal-access-token-scope': PAT_ROUTES[e.method + ' ' + e.url] || null,
    parameters: [],
    responses: {
      200: {
        description: 'Successful response',
        content: { 'application/json': { schema: { type: 'object' } } },
      },
      ...Object.fromEntries(
        [400, 401, 403, 404, 409, 429, 500, 502, 503].map((status) => [
          status,
          {
            description: {
              400: 'Validation failure',
              401: 'Missing, invalid, expired or revoked credential',
              403: 'Permission denied',
              404: 'Resource unavailable',
              409: 'Duplicate, stale version or conflict',
              429: 'Rate limited',
              500: 'Internal failure',
              502: 'AI response could not be grounded',
              503: 'Dependency or account verification temporarily unavailable',
            }[status],
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        ]),
      ),
    },
  };
  for (const [, name] of e.url.matchAll(/:([a-zA-Z]+)/g))
    operation.parameters.push({
      in: 'path',
      name,
      required: true,
      schema: { type: 'string' },
    });
  if (
    e.method === 'get' &&
    !e.url.includes('/:') &&
    e.url !== '/me' &&
    e.url !== '/summary' &&
    ![
      '/lead-scores',
      '/ai-settings',
      '/workspace-settings',
      '/scoring-settings',
      '/dashboard',
      '/field-options',
    ].includes(e.url)
  ) {
    operation.parameters.push(
      {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
      },
      {
        in: 'query',
        name: 'cursor',
        schema: { type: 'string' },
        description:
          'Opaque signed cursor bound to filters, identity and membership version.',
      },
    );
    operation.responses[200].content['application/json'].schema = {
      $ref: '#/components/schemas/Page',
    };
  }
  if (e.url === '/lead-scores')
    operation.parameters.push({
      in: 'query',
      name: 'ids',
      required: true,
      schema: { type: 'string' },
      description:
        'Comma-separated lead IDs, at most 100. Every ID must be within the caller scope.',
    });
  if (e.method === 'get' && e.url === '/leads')
    for (const name of ['stage', 'source', 'assignedToUid', 'search', 'field'])
      operation.parameters.push({
        in: 'query',
        name,
        schema:
          name === 'stage'
            ? { type: 'string' }
            : name === 'field'
              ? {
                  type: 'string',
                  enum: [
                    'name',
                    'company',
                    'phone',
                    'email',
                    'location',
                    'zone',
                  ],
                }
              : { type: 'string' },
        description:
          name === 'search'
            ? 'With column filters, case-insensitive contains search; city/sector use the same scanning path. Legacy queries without filters retain name/company prefix and normalized exact contact matching.'
            : undefined,
      });
  if (e.method === 'get' && e.url === '/leads')
    operation.parameters.push({
      in: 'query',
      name: 'filters',
      content: {
        'application/json': { schema: ref('LeadFilters'), example: [] },
      },
      description:
        'AND-combined column filters. Use JSON in the filters query parameter. Case-insensitive contains/equals/startsWith, empty/notEmpty and before/after for dates. Uses a bounded scan of authorized lead pages, with a signed continuation cursor. Empty pages may still have nextCursor; continue until null. Does not search all historical comment text: use the source discussion fields or latestComment.',
    });
  if (e.method === 'get' && e.url === '/tasks')
    for (const name of ['state', 'leadId'])
      operation.parameters.push({
        in: 'query',
        name,
        schema: { type: 'string' },
      });
  if (
    e.method === 'post' &&
    !e.url.includes('/accept') &&
    !e.url.endsWith('/test') &&
    !e.url.endsWith('/archive') &&
    e.url !== '/dashboard/insights' &&
    e.url !== '/personal-access-tokens' &&
    !e.url.endsWith('/score/refresh')
  )
    operation.parameters.push({
      in: 'header',
      name: 'Idempotency-Key',
      required: e.url !== '/devices',
      schema: { type: 'string', format: 'uuid' },
      description: 'Reuse the same key and body after an uncertain response.',
    });
  const body = bodyFor(e.method, e.url);
  if (body && ['post', 'patch', 'delete'].includes(e.method))
    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/' + body },
        },
      },
    };
  if (e.url.endsWith('/archive'))
    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['expectedVersion'],
            properties: { expectedVersion: { type: 'integer', minimum: 1 } },
          },
        },
      },
    };
  if (e.url.includes('/corrections'))
    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: z.toJSONSchema(
            contracts.ActivityInput.omit({
              followUp: true,
              stage: true,
              expectedVersion: true,
            }).extend({ expectedRevision: z.number().int().positive() }),
          ),
        },
      },
    };
  operation.responses[200].content['application/json'].schema = responseFor(
    e.method,
    e.url,
  );
  operation.responses[200].headers = {
    'Cache-Control': { schema: { type: 'string', const: 'no-store' } },
    'X-Request-Id': { schema: { type: 'string', format: 'uuid' } },
    'X-App-Version': { schema: { type: 'string' } },
  };
  for (const response of Object.values(operation.responses)) {
    response.headers = { ...operation.responses[200].headers };
  }
  operation.responses[401].headers['WWW-Authenticate'] = {
    schema: { type: 'string' },
    description: 'Bearer authentication challenge',
  };
  operation.responses[429].headers['Retry-After'] = {
    schema: { type: 'string', const: '60' },
    description: 'Wait at least 60 seconds before retrying',
  };
  const auditRoutes = new Set([
    'PATCH /me',
    'PATCH /workspace-settings',
    'PATCH /ai-settings',
    'PATCH /field-options',
    'PATCH /scoring-settings',
    'PATCH /members/:uid',
    'POST /invitations',
    'DELETE /invitations/:id',
    'POST /invitations/:id/accept',
    'POST /personal-access-tokens',
    'DELETE /personal-access-tokens/:id',
    'POST /devices',
    'DELETE /devices/:id',
  ]);
  if (auditRoutes.has(e.method.toUpperCase() + ' ' + e.url)) {
    operation.description +=
      ' Saved net configuration changes create an atomic server-side audit and privacy-safe Dynatrace outbox event. No values are exported; unchanged/failed/denied/replayed saves do not create duplicate success changes. No audit-read endpoint or token scope is granted.';
    operation['x-settings-audit'] = {
      eventType: 'com.avinyatech.salesdrone.settings.audit.committed',
      atomic: true,
      valuesExported: false,
      auditReadScopeAdded: false,
    };
  }
  paths[url] ??= {};
  paths[url][e.method] = operation;
}
const spec = {
  openapi: '3.1.0',
  info: {
    title: 'SalesDrone by AvinyaTech API',
    version: '1.14.0',
    description:
      'Part of Avinya Enterprises. Versioned REST API supporting GET, POST, PATCH and DELETE. Data operations accept expiring scoped Personal Access Tokens (Authorization: Bearer), or Firebase Google ID token plus App Check. Administration, token management, identity, device management and AI-generation endpoints require Google sign-in and App Check. Tokens inherit the active admin owner’s current capabilities and assigned/all lead scope; revoked or expired tokens fail authorization. Writes may require expectedVersion and Idempotency-Key as documented. Lead removal is archiving, never permanent erasure. All responses are no-store; paginate until nextCursor is null. Demo identities cannot read live data.',
  },
  servers: [{ url: '/' }],
  paths,
  components: {
    securitySchemes: {
      personalAccessToken: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'sd_pat_<id>_<secret>',
        description:
          'Generate in Settings → Developer settings → Personal Access Tokens. Enter the raw token, without Bearer. Stored only in memory by this portal. Scope and active owner permissions are rechecked server-side; not accepted for Google-only operations.',
      },
      firebaseIdToken: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Firebase ID token',
      },
      appCheck: { type: 'apiKey', in: 'header', name: 'X-Firebase-AppCheck' },
    },
    schemas,
  },
};
await mkdir(new URL('../apps/web/public/', import.meta.url), {
  recursive: true,
});
const json = JSON.stringify(spec, null, 2) + '\n';
await writeFile(new URL('../docs/openapi.json', import.meta.url), json);
await writeFile(
  new URL('../apps/web/public/openapi.json', import.meta.url),
  json,
);
console.log(`Generated ${endpoints.length} API operations.`);
