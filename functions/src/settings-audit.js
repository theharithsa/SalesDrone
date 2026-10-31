import { readResearchSettings } from './lead-research-settings.js';
import { APP_VERSION, BUILD_COMMIT } from './version.js';
import DEFAULT_FIELD_LABELS from './lead-labels.json' with { type: 'json' };
import { DEFAULT_FIELD_OPTIONS } from './field-options.js';
import { isDeepStrictEqual } from 'node:util';
import { hash, path, ROOT } from './policy.js';
import { AUTO_DEFAULTS } from './automatic-reminders.js';
import { readFieldOptions } from './field-options.js';
import { readScoring } from './scoring.js';
import { readAISettings } from './ai-settings.js';
import { readWorkspaceSettings } from './workspace-settings.js';
const personalDefaults = {
  timezone: 'Asia/Kolkata',
  appearance: 'system',
  bookMode: false,
  fontStyle: 'standard',
  displayScale: 100,
  dashboardField: 'auto',
  ...AUTO_DEFAULTS,
};
const definitions = {
  'ai.research': ['convertedStages','failedStages','archiveReviewStages','inactivityDays','timezone','indexingEnabled'],
  appearance: [
    'appearance',
    'bookMode',
    'fontStyle',
    'displayScale',
    'timezone',
  ],
  'dashboard.visualization': ['dashboardField'],
  reminders: [
    'automaticReminders',
    'reminderTime',
    'nextWeekRule',
    'moveWeekends',
  ],
  'reports-access': ['exportsEnabled', 'assignedOnly'],
  'ai.insights': ['instructions', 'insightMode'],
  'ai.scoring': ['enabled', 'factors'],
  'manage-fields': ['labels', 'values', 'hiddenFields', 'customFields'],
  'people.members': ['active', 'role', 'scope', 'capabilities'],
  'people.invitations': [
    'active',
    'role',
    'scope',
    'capabilities',
    'expiresAt',
  ],
  'developer.tokens': ['name', 'scopes', 'expiresAt', 'active', 'revokedAt'],
  'notifications.devices': ['enabled', 'token', 'label'],
};
function sections(p) {
  if (/^users\/[^/]+$/.test(p)) return ['appearance', 'reminders', 'dashboard.visualization'];
  if (/^users\/[^/]+\/devices\/[^/]+$/.test(p))
    return ['notifications.devices'];
  if (!p.startsWith(ROOT + '/')) return [];
  const tail = p.slice(ROOT.length + 1).split('/');
  if (tail.length !== 2) return [];
  if (tail[0] === 'settings')
    return (
      {
        fields: ['manage-fields'],
        workspace: ['reports-access'],
        ai: ['ai.insights'],
        scoring: ['ai.scoring'],
        leadResearch: ['ai.research'],
      }[tail[1]] || []
    );
  return (
    {
      members: ['people.members'],
      invitations: ['people.invitations'],
      personalAccessTokens: ['developer.tokens'],
    }[tail[0]] || []
  );
}
async function normalized(section, value) {
  const reader = { get: async () => value };
  if (['appearance', 'reminders', 'dashboard.visualization'].includes(section))
    return { ...personalDefaults, ...value };
  if (section === 'reports-access') return readWorkspaceSettings(reader);
  if (section === 'ai.research') return readResearchSettings(reader);
  if (section === 'ai.insights') return readAISettings(reader);
  if (section === 'ai.scoring') return readScoring(reader);
  if (section === 'manage-fields') return readFieldOptions(reader);
  return value || {};
}
function collectionKeys(prefix, before = [], after = [], properties) {
  const a = new Map(before.map((v) => [v.id, v])),
    b = new Map(after.map((v) => [v.id, v]));
  return [...new Set([...a.keys(), ...b.keys()])]
    .sort()
    .flatMap((id) =>
      properties
        .filter((key) => !isDeepStrictEqual(a.get(id)?.[key], b.get(id)?.[key]))
        .map((key) => prefix + '.' + hash(String(id)).slice(0, 16) + '.' + key),
    );
}
/** Snapshot before the first write. Reads/writes remain inside the caller's transaction. */
export function settingsAuditTransaction(tx) {
  const before = new Map(),
    writes = new Map();
  const snapshot = (p) => {
    if (!before.has(p))
      before.set(
        p,
        tx.get(p).then(
          (value) => ({ value }),
          (error) => ({ error }),
        ),
      );
  };
  const record = (p, value) => {
    if (!sections(p).length) return;
    snapshot(p);
    writes.set(p, value === null ? null : structuredClone(value));
  };
  return {
    tx: {
      ...tx,
      set: (p, value) => {
        record(p, value);
        tx.set(p, value);
      },
      delete: (p) => {
        record(p, null);
        tx.delete(p);
      },
    },
    changes: async () => {
      const changes = [];
      for (const [p, next] of writes) {
        const prior = await before.get(p);
        if (prior.error) throw prior.error;
        for (const section of sections(p)) {
          const [a, b] = await Promise.all([
            normalized(section, prior.value),
            normalized(section, next),
          ]);
          let keys = definitions[section].filter(
            (key) => !isDeepStrictEqual(a[key], b[key]),
          );
          if (section === 'manage-fields') {
            keys = keys.flatMap((key) =>
              key === 'labels' || key === 'values'
                ? Object.keys(
                    key === 'labels'
                      ? DEFAULT_FIELD_LABELS
                      : DEFAULT_FIELD_OPTIONS,
                  )
                    .filter(
                      (field) =>
                        !isDeepStrictEqual(a[key]?.[field], b[key]?.[field]),
                    )
                    .map((field) => key + '.' + field)
                : key === 'customFields'
                  ? collectionKeys(
                      'customFields',
                      a.customFields,
                      b.customFields,
                      ['label', 'type', 'options', 'required', 'deleted'],
                    )
                  : [key],
            );
          }
          if (section === 'ai.scoring') {
            keys = keys.flatMap((key) =>
              key === 'factors'
                ? collectionKeys('factors', a.factors, b.factors, [
                    'label',
                    'group',
                    'weight',
                    'description',
                    'enabled',
                  ])
                : [key],
            );
          }
          if (keys.length)
            changes.push({
              section,
              keys,
              targetId: p.split('/').at(-1),
              operation:
                next === null
                  ? 'deleted'
                  : prior.value === null
                    ? 'created'
                    : 'updated',
            });
        }
      }
      return changes;
    },
  };
}
/** Always durable, even if OTel initialization is unavailable. Never include values. */
export function queueSettingsAudits(tx, audit, changes, capture = {}) {
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    for (let offset = 0; offset < change.keys.length; offset += 40) {
      const keys = change.keys.slice(offset, offset + 40);
      const id = hash(audit.id + ':settings:' + i + ':' + offset / 40);
      const data = {
        'event.id': id,
        'event.provider': 'com.avinyatech.salesdrone.backend',
        'event.authority': 'server-confirmed',
        'schema.version': 1,
        'audit.id': audit.id,
        'transaction.id': audit.id,
        'app.version': APP_VERSION,
        'build.commit': BUILD_COMMIT,
        'actor.id': 'user:' + hash('salesdrone:' + audit.actorUid).slice(0, 32),
        'settings.section': change.section,
        'settings.changed_keys': keys,
        'settings.changed_count': keys.length,
        'settings.total_changed_count': change.keys.length,
        'settings.chunk_index': offset / 40,
        'settings.chunk_count': Math.ceil(change.keys.length / 40),
        'settings.operation': change.operation,
        'settings.subject_id': hash('settings-subject:' + change.targetId),
        'correlation.origin': capture.traceparent
          ? 'backend-settings-transaction'
          : 'outbox-consumer',
        operation: audit.action,
        'request.id': audit.requestId,
        ...(capture.operationId ? { 'operation.id': capture.operationId } : {}),
      };
      const event = {
        specversion: '1.0',
        id,
        source: 'com.avinyatech.salesdrone.backend',
        type: 'com.avinyatech.salesdrone.settings.audit.committed',
        time: audit.createdAt,
        data,
        ...(capture.traceparent ? { traceparent: capture.traceparent } : {}),
      };
      tx.set(path('telemetryOutbox', id), {
        id,
        status: 'Pending',
        nextAttemptAt: audit.createdAt,
        attemptCount: 0,
        createdAt: audit.createdAt,
        event,
      });
    }
  }
}
export function settingsAuditLogFields(event) {
  const data = event?.data;
  if (
    event?.type !== 'com.avinyatech.salesdrone.settings.audit.committed' ||
    !definitions[data?.['settings.section']] ||
    !/^(?:[a-z0-9]+_)?[a-f0-9-]{36}$/i.test(data?.['audit.id'] || '') ||
    !/^user:[a-f0-9]{32}$/.test(data?.['actor.id'] || '') ||
    !Number.isInteger(data?.['settings.changed_count']) ||
    data['settings.changed_count'] < 1 ||
    data['settings.changed_count'] > 40
  )
    return null;
  return {
    'audit.id': data['audit.id'],
    'settings.section': data['settings.section'],
    'settings.changed_count': data['settings.changed_count'],
    'actor.id': data['actor.id'],
  };
}
