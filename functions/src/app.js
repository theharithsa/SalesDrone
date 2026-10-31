import { ResearchSettingsPatch, RESEARCH_SETTINGS_PATH, readResearchSettings, validateResearchSettings } from './lead-research-settings.js';
import { researchMember, researchAccessKey } from './lead-research-access.js';
import { ScanInput, ResearchVersion, scanEpoch, createHygieneScan, readHygieneScan, deleteHygieneScan } from './lead-hygiene.js';
import { ConversationInput, QuestionInput, readConversation, createConversation, createQuestion, readAssistantRequest } from './lead-assistant.js';
import { INDEX_STATE_PATH, queueIndexBackfill } from './lead-research-index.js';
import { researchStore } from './lead-research-store.js';
import { dashboardFields } from './dashboard-grouping.js';
import { documentKey } from './store.js';
import { createCursorCodec } from './cursors.js';
import { rateLimitExpiry } from './rate-limit.js';
import {
  ImportVersion,
  ImportDecision,
  ImportDelete,
  createImportReview,
  readImport,
  importSummary,
  sharedImports,
  planImportChunk,
  visibleImportRows,
  decideImportRow,
  approveImportChunk,
  commitImportReview,
  refreshImportReview,
  deleteImportDetails,
} from './import-review.js';
import {
  guardLeadData,
  RESET_STATE,
  resetActive,
  resetAdmin,
  previewReset,
  startReset,
  resumeReset,
  resetStatus,
  ResetConfirmation,
  ResetResume,
} from './lead-data-reset.js';
import {
  AttachmentInput,
  AttachmentDelete,
  attachmentView,
  attachmentAccess,
  reserveAttachment,
  putAttachment,
  removeAttachment,
  MAX_FILE_BYTES,
} from './attachments.js';
import { BulkLeadInput, planBulkLeads } from './bulk-leads.js';
import {
  settingsAuditTransaction,
  queueSettingsAudits,
} from './settings-audit.js';
import {
  WORKSPACE_SETTINGS_PATH,
  WorkspaceSettingsPatch,
  readWorkspaceSettings,
} from './workspace-settings.js';
import { LeadExportInput, exportColumns, exportRows } from './lead-reports.js';
import {
  AI_SETTINGS_PATH,
  AISettingsPatch,
  readAISettings,
} from './ai-settings.js';
import {
  PAT_ROUTES,
  TOKEN_SCOPES,
  TokenInput,
  MAX_TOKENS,
  tokenMetadata,
  generateToken,
  assertAdmin,
  authenticatePersonalToken,
} from './personal-access-tokens.js';
import { APP_VERSION } from './version.js';
import { recordStage, transitionId } from './journey.js';
import { z } from 'zod';
import {
  SCORING_PATH,
  ScoringPatch,
  readScoring,
  scoreView,
  processLeadScore,
} from './scoring.js';
import { dashboardSnapshot, dashboardBrief } from './dashboard.js';
import { queueLeadNotification, notificationVisible } from './notifications.js';
import {
  readFieldOptions,
  mergeFieldSettings,
  validateCustomValues,
  assertFieldOption,
  FieldOptionsPatch,
  FIELD_SETTINGS_PATH,
} from './field-options.js';
import express from 'express';
import { randomUUID } from 'node:crypto';
import {
  AppError,
  parse,
  LeadInput,
  LeadPatch,
  ArchiveInput,
  AssignmentPatch,
  NotificationPatch,
  ActivityInput,
  AutomaticReminderAction,
  TaskInput,
  TaskPatch,
  TaskDelete,
  GrantInput,
  MemberPatch,
  Preferences,
  DeviceInput,
  ImportInput,
  PRESETS,
} from './contracts.js';
import {
  path,
  hash,
  googleIdentity,
  resolveIdentity,
  effectiveMember,
  sameAccess,
  requireMember,
  scopeFilters,
  leadAccess,
  canReadLead,
  assertVersion,
  validateTimezone,
  ADMIN_EMAILS,
} from './policy.js';
import { parseLeadFilters, matchesLead } from './lead-filters.js';
import { appendDiscussions, appendImportedComments } from './discussions.js';
import { prepareLead, normalizeLead, contactKeys } from './leads.js';
import { IMPORT_CHUNK_SIZE, previewRows } from './imports.js';
import { makeTask, queueTask } from './tasks.js';
import { enqueueAnalysis, AUTO_DEFAULTS } from './automatic-reminders.js';
const uid = () => Date.now().toString(36) + '_' + randomUUID();
export function createApp({
  store,
  cursorSecret = process.env.CURSOR_SECRET,
  telemetry = () => null,
  verifyToken,
  verifyAppCheck,
  verifyPersonalTokenOwner = null,
  sendTest = async () => {},
  files = null,
  extractScore = null,
  summarizeDashboard = null,
  now = () => new Date().toISOString(),
}) {
  const maintenanceStore = store.maintenanceStore || store;
  store = guardLeadData(researchStore(store,()=>telemetry()?.capture()?.traceparent));
  const { encode: encodeCursor, decode: decodeCursor } = createCursorCodec(
    cursorSecret,
    {
      allowEphemeral:
        process.env.FUNCTIONS_EMULATOR === 'true' ||
        (!process.env.K_SERVICE && process.env.NODE_ENV !== 'production'),
    },
  );
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.set({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Request-Id': req.requestId,
      'X-App-Version': APP_VERSION,
    });
    next();
  });
  app.use((req, res, next) => {
    const t = telemetry();
    return t ? t.http(req, res, next) : next();
  });
  app.use(express.json({ limit: '12mb' }));
  const router = express.Router();
  router.use(async (req, res, next) => {
    try {
      const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      if (!bearer)
        throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue');
      if (bearer.startsWith('sd_pat_')) {
        req.identity = await authenticatePersonalToken(store, bearer, now);
        if (
          verifyPersonalTokenOwner &&
          !(await verifyPersonalTokenOwner(req.identity.uid))
        )
          throw new AppError(
            401,
            'INVALID_TOKEN',
            'The personal access token owner is unavailable',
          );
        // These identity/bootstrap routes are intentionally Google-only.
        if (req.path === '/me' || req.path.startsWith('/invitations/'))
          throw new AppError(
            403,
            'GOOGLE_REQUIRED',
            'Use Google sign-in for this operation',
          );
      } else {
        let token;
        try {
          token = await verifyToken(bearer);
        } catch {
          throw new AppError(
            401,
            'UNAUTHENTICATED',
            'Your session expired. Sign in again.',
          );
        }
        req.identity = googleIdentity(token);
        if (verifyAppCheck)
          await verifyAppCheck(req.headers['x-firebase-appcheck']);
      }
      telemetry()?.identify(req.identity.uid);
      for (const p of req.path.split('/').filter(Boolean))
        if (!/^[A-Za-z0-9_.:-]+$/.test(p))
          throw new AppError(400, 'PATH', 'Invalid path');
      next();
    } catch (e) {
      next(e);
    }
  });
  const route = (method, url, capability, handler) =>
    router[method](url, async (req, res, next) => {
      try {
        if (req.identity.personalAccess) {
          const scope = PAT_ROUTES[method + ' ' + url];
          if (!scope)
            throw new AppError(
              403,
              'GOOGLE_REQUIRED',
              'This operation requires Google sign-in and App Check',
            );
          req.identity.personalAccess.requiredScopes = [scope];
          if (
            (url === '/leads/batch' || url === '/leads/batch/preview') &&
            Object.hasOwn(req.body || {}, 'assignedToUid')
          )
            req.identity.personalAccess.requiredScopes.push(
              'assignments:write',
            );
          if (url === '/leads/:id/activities' && method === 'post') {
            if (req.body?.stage)
              req.identity.personalAccess.requiredScopes.push('leads:edit');
            if (req.body?.followUp)
              req.identity.personalAccess.requiredScopes.push('tasks:write');
          }
        }
        req.member = await requireMember(store, req.identity, capability);
        telemetry()?.operation(method.toUpperCase() + ' ' + url);
        if (
          method !== 'get' &&
          /^\/(leads|tasks|activities|imports|dashboard|lead-hygiene|lead-assistant)(\/|$)/.test(url) &&
          resetActive(await store.get(RESET_STATE))
        )
          throw new AppError(
            503,
            'LEAD_DATA_RESET',
            'Lead data is being cleared. Try again after cleanup finishes.',
          );
        const allowed =
          url === '/lead-scores'
            ? ['ids']
            : url === '/leads'
              ? [
                  'limit',
                  'cursor',
                  'stage',
                  'source',
                  'assignedToUid',
                  'search',
                  'field',
                  'filters',
                ]
              : url === '/imports'
                ? ['limit', 'cursor', 'status', 'uploader', 'from', 'to']
                : url === '/tasks'
                  ? ['limit', 'cursor', 'state', 'leadId']
                  : ['limit', 'cursor'];
        for (const [key, value] of Object.entries(req.query))
          if (!allowed.includes(key) || typeof value !== 'string')
            throw new AppError(
              400,
              'FILTER',
              'Unknown or invalid query parameter: ' + key,
            );
        const result = await handler(req, res);
        if (res.headersSent) return;
        res.json(result ?? { ok: true });
      } catch (e) {
        next(e);
      }
    });
  async function mutate(req, capability, fn, { idempotent = false } = {}) {
    const key = req.headers['idempotency-key'];
    if (idempotent && (!key || !/^[a-f0-9-]{36}$/i.test(key)))
      throw new AppError(400, 'IDEMPOTENCY', 'Supply a UUID Idempotency-Key');
    const fingerprint = idempotent
      ? hash(JSON.stringify([req.method, req.path, req.body]))
      : null;
    return store.run(async (tx) => {
      const member = await requireMember(tx, req.identity, capability);
      const requestPath = path('requests', hash(member.uid + ':' + key));
      const prior = idempotent ? await tx.get(requestPath) : null;
      if (prior) {
        if (prior.expiredByReset)
          throw new AppError(
            409,
            'RESET_REQUEST_EXPIRED',
            'This operation belongs to cleared data. Start a new operation.',
          );
        if (prior.fingerprint !== fingerprint)
          throw new AppError(
            409,
            'IDEMPOTENCY_CONFLICT',
            'This key was already used for a different request',
          );
        if (req.path === '/leads/batch')
          for (const item of req.body.items)
            await leadAccess(tx, member, item.id);
        const resource = req.params.id;
        if (req.path.startsWith('/leads/') && resource)
          await leadAccess(tx, member, resource);
        if (req.path === '/leads' && prior.result?.id)
          await leadAccess(tx, member, prior.result.id);
        if (req.path === '/tasks' && prior.result?.leadId)
          await leadAccess(tx, member, prior.result.leadId);
        if (req.path.startsWith('/activities/') && prior.result?.leadId)
          await leadAccess(tx, member, prior.result.leadId);
        if (req.path.startsWith('/imports') && prior.result?.id) {
          const job = await readImport(tx, member, prior.result.id);
          return job.formatVersion === 3 ? importSummary(job) : prior.result;
        }
        if (req.path.startsWith('/lead-hygiene/scans') && prior.result?.id)
          return readHygieneScan(tx,req.identity,prior.result.id);
        if (req.path.startsWith('/lead-assistant/conversations') && prior.result?.id) {
          if(req.path.endsWith('/questions')) return readAssistantRequest(tx,req.identity,prior.result.id);
          return readConversation(tx,req.identity,prior.result.id);
        }
        return prior.result;
      }
      const ratePath = path(
        'rateLimits',
        hash(
          `${member.uid}:${req.route.path.startsWith('/imports') ? req.route.path : 'writes'}:${now().slice(0, 16)}`,
        ),
      );
      const rate = await tx.get(ratePath);
      if ((rate?.count || 0) >= 180)
        throw new AppError(
          429,
          'RATE_LIMIT',
          'Too many changes. Try again in a minute.',
        );
      const tracking = settingsAuditTransaction(tx);
      const result = await fn(tracking.tx, member);
      const settingsChanges = await tracking.changes();
      tx.set(ratePath, {
        count: (rate?.count || 0) + 1,
        expiresAt: rateLimitExpiry(now()),
      });
      const id = uid();
      const audit = {
        id,
        actorUid: member.uid,
        authentication: req.identity.personalAccess
          ? 'personal_access_token'
          : 'google',
        ...(req.identity.personalAccess
          ? { personalAccessTokenId: req.identity.personalAccess.id }
          : {}),
        action: req.method + ' ' + req.route.path,
        requestId: req.requestId,
        createdAt: now(),
        ...(settingsChanges.length ? { settingsChanges } : {}),
      };
      tx.set(path('auditEvents', id), audit);
      queueSettingsAudits(tx, audit, settingsChanges, telemetry()?.capture());
      if (idempotent)
        tx.set(requestPath, {
          fingerprint,
          result:
            result?.formatVersion === 3
              ? { id: result.id, formatVersion: 3 }
              : result,
          createdAt: now(),
        });
      return result;
    });
  }
  async function list(
    req,
    collection,
    filters = [],
    ownerPath,
    order = 'id',
    direction = 'desc',
  ) {
    const n = Number(req.query.limit || 30);
    if (!Number.isInteger(n) || n < 1 || n > 100)
      throw new AppError(400, 'LIMIT', 'Limit must be 1–100');
    const binding = hash(
      JSON.stringify([
        req.member.uid,
        req.member.version,
        collection,
        filters,
        order,
        direction,
      ]),
    );
    const after = req.query.cursor
      ? decodeCursor(String(req.query.cursor), binding)
      : undefined;
    const records = await store.query(ownerPath || path(collection), {
      filters,
      order,
      direction,
      after,
      limit: n + 1,
    });
    const items = records.slice(0, n);
    return {
      items,
      nextCursor:
        records.length > n
          ? encodeCursor(
              order === 'id'
                ? [items.at(-1).id]
                : [items.at(-1)[order], items.at(-1).id],
              binding,
            )
          : null,
    };
  }
  const taskRecord = (input, member, id, leadId) =>
    makeTask(input, member, id, leadId, now());
  async function readTask(db, m, id) {
    const t = await db.get(path('tasks', id));
    if (!t || t.deleted) throw new AppError(404, 'NOT_FOUND', 'Task not found');
    if (t.leadId) await leadAccess(db, m, t.leadId);
    else if (t.creatorUid !== m.uid)
      throw new AppError(404, 'NOT_FOUND', 'Task not found');
    return t;
  }
  router.get('/me', async (req, res, next) => {
    try {
      const rawMember = await resolveIdentity(store, req.identity);
      const m = await effectiveMember(store, rawMember);
      const invitation = !m
        ? await store.get(path('invitations', hash(req.identity.email)))
        : null;
      const prefs = await store.get(`users/${req.identity.uid}`);
      res.json({
        identity: req.identity,
        mode: m ? 'live' : 'demo',
        member: m,
        workspaceSettings: m ? await readWorkspaceSettings(store) : undefined,
        preferences: {
          timezone: 'Asia/Kolkata',
          appearance: 'system',
          bookMode: false,
          fontStyle: 'standard',
          dashboardField: 'auto',
          displayScale: 100,
          ...AUTO_DEFAULTS,
          ...prefs,
        },
        invitation:
          invitation?.active && invitation.expiresAt > now()
            ? {
                id: invitation.id,
                role: invitation.role,
                scope: invitation.scope,
              }
            : null,
      });
    } catch (e) {
      next(e);
    }
  });
  router.post('/invitations/:id/accept', async (req, res, next) => {
    try {
      if (req.params.id !== hash(req.identity.email))
        throw new AppError(
          403,
          'INVITATION',
          'Invitation does not match this identity',
        );
      await store.run(async (rawTx) => {
        const tracking = settingsAuditTransaction(rawTx),
          tx = tracking.tx;
        const p = path('invitations', req.params.id);
        const inv = await tx.get(p);
        const existing = await tx.get(path('members', req.identity.uid));
        if (!inv?.active || inv.expiresAt <= now())
          throw new AppError(
            404,
            'INVITATION',
            'Invitation has expired or was revoked',
          );
        if (existing?.role === 'Admin')
          throw new AppError(409, 'ADMIN', 'Administrator already has access');
        tx.set(path('members', req.identity.uid), {
          ...req.identity,
          id: req.identity.uid,
          role: inv.role,
          capabilities: inv.capabilities,
          scope: inv.scope,
          active: true,
          version: (existing?.version || 0) + 1,
        });
        tx.set(p, { ...inv, active: false, acceptedUid: req.identity.uid });
        const id = uid();
        const settingsChanges = await tracking.changes();
        const audit = {
          id,
          actorUid: req.identity.uid,
          action: 'invitation.accept',
          createdAt: now(),
          requestId: req.requestId,
          settingsChanges,
        };
        rawTx.set(path('auditEvents', id), audit);
        queueSettingsAudits(
          rawTx,
          audit,
          settingsChanges,
          telemetry()?.capture(),
        );
      });
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
  route('patch', '/me', null, (req) => {
    const input = parse(Preferences, req.body);
    if(input.timezone!==undefined)validateTimezone(input.timezone);
    return mutate(req, null, async (tx) => {
      if(input.dashboardField && input.dashboardField!=='auto' && !dashboardFields(await readFieldOptions(tx),{includeHiddenStage:true}).some(f=>f.field===input.dashboardField))
        throw new AppError(400,'DASHBOARD_FIELD','Choose an available dashboard category field');
      const prefs = {
        timezone: 'Asia/Kolkata',
        appearance: 'system',
        dashboardField: 'auto',
        bookMode: false,
        fontStyle: 'standard',
        displayScale: 100,
        ...AUTO_DEFAULTS,
        ...(await tx.get(`users/${req.identity.uid}`)),
        ...input,
      };
      tx.set(`users/${req.identity.uid}`, prefs);
      return prefs;
    });
  });
  // Scan authorized, indexed lead pages, then apply arbitrary column combinations.
  // The signed cursor resumes after the last scanned row, even on sparse pages.
  async function filteredLeads(req) {
    const n = Number(req.query.limit || 30);
    if (!Number.isInteger(n) || n < 1 || n > 100)
      throw new AppError(400, 'LIMIT', 'Limit must be 1–100');
    const filters = parseLeadFilters(req.query.filters || '[]');
    const customFilters = filters.filter((f) => f.field.startsWith('cf_'));
    if (customFilters.length) {
      const config = await readFieldOptions(store);
      for (const filter of customFilters) {
        const definition = config.customFields.find(
          (f) => f.id === filter.field && !f.deleted,
        );
        if (
          !definition ||
          (['before', 'after'].includes(filter.op) &&
            definition.type !== 'date') ||
          (filter.op === 'exact' && definition.type !== 'select')
        )
          throw new AppError(
            400,
            'FILTER',
            'Choose an available custom field and a compatible comparison',
          );
      }
    }
    if (req.query.stage) {
      if (String(req.query.stage).length > 100)
        throw new AppError(400, 'FILTER', 'Unknown stage');
      filters.push({ field: 'stage', op: 'equals', value: req.query.stage });
    }
    if (req.query.source)
      filters.push({ field: 'source', op: 'equals', value: req.query.source });
    if (req.query.search) {
      const field = req.query.field || 'name';
      if (
        !['name', 'company', 'phone', 'email', 'location', 'zone'].includes(
          field,
        )
      )
        throw new AppError(400, 'FILTER', 'Unknown search field');
      filters.push({ field, op: 'contains', value: req.query.search });
    }
    const base = [...scopeFilters(req.member), ['archived', '==', false]];
    if (req.query.assignedToUid) {
      if (req.member.role !== 'Admin')
        throw new AppError(
          403,
          'SCOPE',
          'Only admins can filter other assignees',
        );
      base.push(['assignedToUid', '==', req.query.assignedToUid]);
    }
    const binding = hash(
      JSON.stringify([
        req.member.uid,
        req.member.version,
        'columnFilters',
        req.exportBinding || null,
        base,
        filters,
      ]),
    );
    let after = req.query.cursor
      ? decodeCursor(String(req.query.cursor), binding)
      : undefined;
    const exact = new Map();
    let contradiction = false;
    for (const f of filters.filter(f => f.op === 'exact')) {
      const field = f.field.startsWith('cf_') ? 'customFields.' + f.field : f.field;
      if (exact.has(field) && exact.get(field) !== f.value) contradiction = true;
      exact.set(field, f.value);
    }
    if (contradiction) return {items:[],nextCursor:null,scanLimited:false};
    // Default single-field indexes can merge raw equalities with document-ID order,
    // including dynamic custom dropdown keys. No lead rewrite/backfill is needed.
    const indexed = [...base, ...[...exact].map(([field,value])=>[field,'==',value])];
    const order = exact.size ? '__name__' : 'id';
    const items = [];
    let scanned = 0,
      hasMore = false;
    while (items.length < n && scanned < 1000) {
      const page = await store.query(path('leads'), {
        filters: indexed,
        order,
        direction: 'desc',
        after,
        limit: Math.min(100, 1000 - scanned),
      });
      if (!page.length) {
        hasMore = false;
        break;
      }
      for (let i = 0; i < page.length; i++) {
        const lead = page[i];
        scanned++;
        after = [exact.size ? documentKey(lead) : lead.id];
        if (matchesLead(lead, filters)) items.push(lead);
        if (items.length === n) {
          hasMore = i < page.length - 1 || page.length === 100;
          break;
        }
      }
      if (items.length === n) break;
      hasMore = page.length === 100;
      if (!hasMore) break;
    }
    return {
      items,
      nextCursor: hasMore ? encodeCursor(after, binding) : null,
      scanLimited: scanned >= 1000 && hasMore,
    };
  }
  route('get', '/personal-access-tokens', 'members:write', async (req) => {
    assertAdmin(req.member);
    const page = await list(
      req,
      'personalAccessTokens',
      [['ownerUid', '==', req.member.uid]],
      undefined,
      'createdAt',
    );
    return {
      ...page,
      items: page.items.map(tokenMetadata),
      availableScopes: TOKEN_SCOPES.filter((s) =>
        req.member.capabilities.includes(s.capability),
      ),
      maxActiveTokens: MAX_TOKENS,
    };
  });
  route('post', '/personal-access-tokens', 'members:write', (req) => {
    if (req.headers['idempotency-key'])
      throw new AppError(
        400,
        'TOKEN_ONE_TIME',
        'Token creation cannot be replayed; do not send Idempotency-Key',
      );
    const input = parse(TokenInput, req.body),
      generated = generateToken(req.member.uid, input, now());
    return mutate(req, 'members:write', async (tx, member) => {
      assertAdmin(member);
      if (
        input.scopes.some(
          (id) =>
            !member.capabilities.includes(
              TOKEN_SCOPES.find((s) => s.id === id).capability,
            ),
        )
      )
        throw new AppError(
          403,
          'TOKEN_SCOPE',
          'Tokens cannot exceed your current permissions',
        );
      const existing = await tx.query(path('personalAccessTokens'), {
        filters: [
          ['ownerUid', '==', member.uid],
          ['active', '==', true],
        ],
        direction: 'desc',
        limit: MAX_TOKENS + 1,
      });
      if (existing.filter((t) => t.expiresAt > now()).length >= MAX_TOKENS)
        throw new AppError(
          409,
          'TOKEN_LIMIT',
          'Revoke an existing token before creating another',
        );
      for (const t of existing.filter((t) => t.expiresAt <= now()))
        tx.set(path('personalAccessTokens', t.id), { ...t, active: false });
      tx.set(
        path('personalAccessTokens', generated.record.id),
        generated.record,
      );
      return {
        token: generated.token,
        personalAccessToken: tokenMetadata(generated.record),
      };
    });
  });
  route('delete', '/personal-access-tokens/:id', 'members:write', (req) => {
    parse(z.object({}).strict(), req.body ?? {});
    if (!/^[a-f0-9]{32}$/.test(req.params.id))
      throw new AppError(404, 'NOT_FOUND', 'Personal access token not found');
    return mutate(req, 'members:write', async (tx, member) => {
      assertAdmin(member);
      const t = await tx.get(path('personalAccessTokens', req.params.id));
      if (!t || t.ownerUid !== member.uid)
        throw new AppError(404, 'NOT_FOUND', 'Personal access token not found');
      if (t.active)
        tx.set(path('personalAccessTokens', t.id), {
          ...t,
          active: false,
          revokedAt: now(),
        });
      return { ok: true };
    });
  });
  route('get', '/workspace-settings', 'leads:read', () =>
    readWorkspaceSettings(store),
  );
  route('patch', '/workspace-settings', 'members:write', (req) => {
    const input = parse(WorkspaceSettingsPatch, req.body);
    return mutate(req, 'members:write', async (tx, member) => {
      assertAdmin(member);
      const current = await readWorkspaceSettings(tx);
      assertVersion(current, input.expectedVersion);
      if (
        current.exportsEnabled === input.exportsEnabled &&
        current.assignedOnly === input.assignedOnly
      )
        return current;
      const next = {
        version: current.version + 1,
        exportsEnabled: input.exportsEnabled,
        assignedOnly: input.assignedOnly,
      };
      tx.set(WORKSPACE_SETTINGS_PATH, {
        ...next,
        updatedAt: now(),
        updatedByUid: member.uid,
      });
      return next;
    });
  });
  route('post', '/leads/export', 'leads:read', async (req) => {
    const input = parse(LeadExportInput, req.body);
    const settings = await readWorkspaceSettings(store);
    if (!settings.exportsEnabled)
      throw new AppError(
        403,
        'EXPORT_DISABLED',
        'Lead exports are disabled by your administrator',
      );
    await store.run(async (tx) => {
      await requireMember(tx, req.identity, 'leads:read');
      const p = path(
        'rateLimits',
        hash('leadExport:' + req.member.uid + ':' + now().slice(0, 16)),
      );
      const rate = await tx.get(p);
      if ((rate?.count || 0) >= 120)
        throw new AppError(
          429,
          'RATE_LIMIT',
          'Too many report pages. Try again in a minute.',
        );
      tx.set(p, {
        count: (rate?.count || 0) + 1,
        expiresAt: rateLimitExpiry(now()),
      });
    });
    const config = await readFieldOptions(store);
    const selected = exportColumns(input.columns, config);
    const { columns, filters, cursor, limit, ...rest } = input;
    const result = await filteredLeads({
      ...req,
      query: {
        ...rest,
        filters: JSON.stringify(filters),
        limit: String(limit),
        ...(cursor ? { cursor } : {}),
      },
      exportBinding: ['report', settings.version, config.version, columns],
    });
    const current = await requireMember(store, req.identity, 'leads:read');
    const latest = await readWorkspaceSettings(store);
    if (!latest.exportsEnabled)
      throw new AppError(
        403,
        'EXPORT_DISABLED',
        'Lead exports are disabled by your administrator',
      );
    if (!sameAccess(current, req.member) || latest.version !== settings.version)
      throw new AppError(
        409,
        'SCOPE_CHANGED',
        'Workspace access changed; restart your report',
      );
    const id = uid();
    await store.run(async (tx) => {
      const member = await requireMember(tx, req.identity, 'leads:read');
      if (!sameAccess(member, current))
        throw new AppError(
          409,
          'SCOPE_CHANGED',
          'Workspace access changed; restart your report',
        );
      tx.set(path('auditEvents', id), {
        id,
        actorUid: member.uid,
        action: 'POST /leads/export',
        rowCount: result.items.length,
        columnCount: columns.length,
        createdAt: now(),
        requestId: req.requestId,
      });
    });
    return {
      columns: selected,
      rows: exportRows(result.items, selected),
      nextCursor: result.nextCursor,
      scanLimited: result.scanLimited,
      policyVersion: settings.version,
      asOf: now(),
    };
  });
  route('get', '/ai-settings', 'members:write', async (req) => {
    assertAdmin(req.member);
    return readAISettings(store);
  });
  route('patch', '/ai-settings', 'members:write', (req) => {
    const input = parse(AISettingsPatch, req.body);
    return mutate(req, 'members:write', async (tx, member) => {
      assertAdmin(member);
      const current = await readAISettings(tx);
      assertVersion(current, input.expectedVersion);
      const insightMode = input.insightMode ?? current.insightMode;
      if (
        current.instructions === input.instructions &&
        current.insightMode === insightMode
      )
        return current;
      tx.set(AI_SETTINGS_PATH, {
        version: current.version + 1,
        instructions: input.instructions,
        insightMode,
        updatedAt: now(),
        updatedByUid: member.uid,
      });
      return {
        ...current,
        version: current.version + 1,
        instructions: input.instructions,
        insightMode,
        usingDefault: !input.instructions,
      };
    });
  });
  route('get', '/field-options', 'leads:read', () => readFieldOptions(store));
  route('patch', '/field-options', 'members:write', (req) => {
    const input = parse(FieldOptionsPatch, req.body);
    return mutate(req, 'members:write', async (tx, m) => {
      if (m.role !== 'Admin')
        throw new AppError(
          403,
          'ADMIN',
          'Only administrators can change field choices',
        );
      const current = await readFieldOptions(tx);
      assertVersion(current, input.expectedVersion);
      const updated = {
        version: current.version + 1,
        ...mergeFieldSettings(current, input),
        updatedAt: now(),
        updatedByUid: m.uid,
      };
      tx.set(FIELD_SETTINGS_PATH, updated);
      return updated;
    });
  });
  route('get', '/lead-research-settings', 'leads:read', () => readResearchSettings(store));
  route('patch', '/lead-research-settings', 'members:write', req => {
    const input=parse(ResearchSettingsPatch,req.body);
    return mutate(req,'members:write',async(tx,m)=>{
      if(m.role!=='Admin')throw new AppError(403,'FORBIDDEN','Only Admins can change research settings');
      if(input.indexingEnabled&&m.scope!=='all')throw new AppError(403,'FORBIDDEN','Workspace-wide Admin access is required to enable knowledge indexing');
      const current=await readResearchSettings(tx);assertVersion(current,input.expectedVersion);
      await validateResearchSettings(tx,input);
      const {expectedVersion,...values}=input;
      if(JSON.stringify({...current,version:undefined})===JSON.stringify({...values,version:undefined}))return current;
      const updated={...values,version:current.version+1};
      tx.set(RESEARCH_SETTINGS_PATH,updated);
      if(input.indexingEnabled&&!current.indexingEnabled)await queueIndexBackfill(tx,req.identity);
      return updated;
    });
  });
  // Private paging binds cursors to current grants/scope and optional source epoch.
  async function researchList(req,collection,filters,access,project=async row=>row,epoch=null,order='id') {
    const limit=Number(req.query.limit || 30);
    if(!Number.isInteger(limit)||limit<1||limit>100)throw new AppError(400,'LIMIT','Limit must be 1–100');
    const binding=hash(JSON.stringify([req.identity.uid,access,collection,filters,epoch,order]));
    const after=req.query.cursor?decodeCursor(req.query.cursor,binding):undefined;
    const rows=await store.query(path(collection),{filters,order,direction:'desc',after,limit});
    const items=[];
    for(const row of rows){const value=await project(row);if(value)items.push(value);}
    if(epoch!==null&&await scanEpoch(store)!==epoch)throw new AppError(409,'STALE_SOURCE','Lead data changed. Run the report again.');
    return {items,nextCursor:rows.length===limit?encodeCursor(order==='id'?[rows.at(-1).id]:[rows.at(-1)[order],rows.at(-1).id],binding):null};
  }
  route('post', '/lead-hygiene/scans', 'hygiene:run', req => {
    const input=parse(ScanInput,req.body);
    return mutate(req,'hygiene:run',tx=>createHygieneScan(tx,req.identity,uid(),now(),{...input,traceparent:telemetry()?.capture()?.traceparent||null}),{idempotent:true});
  });
  route('get', '/lead-hygiene/scans', 'hygiene:read', async req => {
    const m=await researchMember(store,req.identity,['hygiene:read']);
    const epoch=await scanEpoch(store);
    const result=await researchList(req,'hygieneScans',[['ownerUid','==',m.uid]],researchAccessKey(m),async row=>{
      if(row.status==='Deleting')return null;
      try{return await readHygieneScan(store,req.identity,row.id);}catch(e){if(e.code==='STALE_ACCESS')return {id:row.id,status:'Stale',createdAt:row.createdAt,version:row.version};throw e;}
    },epoch);
    await researchMember(store,req.identity,['hygiene:read'],researchAccessKey(m));return result;
  });
  route('get', '/lead-hygiene/scans/:id', 'hygiene:read', req => readHygieneScan(store,req.identity,req.params.id));
  route('get', '/lead-hygiene/scans/:id/findings', 'hygiene:read', async req => {
    const job=await readHygieneScan(store,req.identity,req.params.id);
    if(job.status!=='Completed')throw new AppError(409,'REPORT_NOT_READY','This report is incomplete or stale. Run a new scan.');
    const result=await researchList(req,'hygieneFindings',[['jobId','==',job.id]],job.access,
      async row=>row.kind==='SharedContact'&&row.count<2?null:row,job.epoch);
    const current=await readHygieneScan(store,req.identity,job.id);if(current.status!=='Completed')throw new AppError(409,'STALE_SOURCE','The report changed. Run a fresh scan.');return result;
  });
  route('get', '/lead-hygiene/scans/:id/findings/:findingId/leads', 'hygiene:read', async req => {
    const job=await readHygieneScan(store,req.identity,req.params.id);
    if(job.status!=='Completed')throw new AppError(409,'REPORT_NOT_READY','Run a current report first');
    const finding=await store.get(path('hygieneFindings',req.params.findingId));
    if(!finding||finding.jobId!==job.id)throw new AppError(404,'NOT_FOUND','Finding not found');
    const result=await researchList(req,'hygieneEvidence',[['findingId','==',finding.id]],job.access,async row=>row.lead,job.epoch);
    const current=await readHygieneScan(store,req.identity,job.id);if(current.status!=='Completed')throw new AppError(409,'STALE_SOURCE','The report changed. Run a fresh scan.');return result;
  });
  route('delete', '/lead-hygiene/scans/:id', 'hygiene:read', req => {
    const input=parse(ResearchVersion,req.body);
    return mutate(req,'hygiene:read',tx=>deleteHygieneScan(tx,req.identity,req.params.id,input.expectedVersion,now()));
  });
  route('post', '/lead-hygiene/scans/:id/summary', 'hygiene:ai', req => {
    const input=parse(ResearchVersion,req.body);
    return mutate(req,'hygiene:ai',async tx=>{
      await researchMember(tx,req.identity,['hygiene:read','hygiene:ai']);
      const job=await readHygieneScan(tx,req.identity,req.params.id);assertVersion(job,input.expectedVersion);
      if(job.status!=='Completed')throw new AppError(409,'REPORT_NOT_READY','Run a current report first');
      if(['Pending','Completed'].includes(job.summaryStatus))return job;
      const updated={...job,summaryStatus:'Pending',summary:null,version:job.version+1,updatedAt:now()};
      tx.set(path('hygieneScans',job.id),updated);return updated;
    });
  });
  route('get', '/lead-assistant/index', 'assistant:query', async req => {
    const m=await researchMember(store,req.identity,['assistant:query']);
    const state=await store.get(INDEX_STATE_PATH),settings=await readResearchSettings(store);
    return {enabled:settings.indexingEnabled,canManage:m.role==='Admin'&&m.scope==='all',status:state?.status||'NotStarted',...(m.role==='Admin'&&m.scope==='all'?{
      scanned:state?.scanned||0,pending:await store.count(path('researchIndexJobs'),[['status','==','Pending']]),failed:await store.count(path('researchIndexJobs'),[['status','==','Failed']])}:{}),
      note:'Only currently accessible, source-verified evidence can be used. Indexing may lag edits.'};
  });
  route('post', '/lead-assistant/index', 'members:write', req => {
    parse(ConversationInput,req.body);
    return mutate(req,'members:write',async(tx,m)=>{
      if(m.role!=='Admin')throw new AppError(403,'FORBIDDEN','Only Admins can build the knowledge index');
      if(!(await readResearchSettings(tx)).indexingEnabled)throw new AppError(409,'SETUP_REQUIRED','Enable indexing in Lead research settings first');
      return queueIndexBackfill(tx,req.identity);
    });
  });
  route('post', '/lead-assistant/conversations', 'assistant:query', req => {
    parse(ConversationInput,req.body);
    return mutate(req,'assistant:query',tx=>createConversation(tx,req.identity,uid(),now()),{idempotent:true});
  });
  route('get', '/lead-assistant/conversations', 'assistant:query', async req => {
    const m=await researchMember(store,req.identity,['assistant:query']);
    const result=await researchList(req,'assistantConversations',[['ownerUid','==',m.uid]],researchAccessKey(m),async row=>row.status!=='Deleting'?{id:row.id,version:row.version,status:row.access===researchAccessKey(m)?row.status:'Stale',createdAt:row.createdAt,updatedAt:row.updatedAt}:null,null,'createdAt');
    await researchMember(store,req.identity,['assistant:query'],researchAccessKey(m));return result;
  });
  route('get', '/lead-assistant/conversations/:id/messages', 'assistant:query', async req => {
    const c=await readConversation(store,req.identity,req.params.id);
    const epoch=await scanEpoch(store),fields=await readFieldOptions(store),settings=await readResearchSettings(store);
    const result=await researchList(req,'assistantRequests',[['jobId','==',c.id]],c.access,async row=>readAssistantRequest(store,req.identity,row.id),epoch,'createdAt');
    if((await readFieldOptions(store)).version!==fields.version||(await readResearchSettings(store)).version!==settings.version)throw new AppError(409,'STALE_SOURCE','Reporting settings changed. Refresh the conversation.');
    const current=await readConversation(store,req.identity,c.id);return {...result,conversation:current};
  });
  route('post', '/lead-assistant/conversations/:id/questions', 'assistant:query', req => {
    const input=parse(QuestionInput,req.body);
    return mutate(req,'assistant:query',tx=>createQuestion(tx,req.identity,req.params.id,input,uid(),now(),telemetry()?.capture()?.traceparent||null),{idempotent:true});
  });
  route('get', '/lead-assistant/requests/:id', 'assistant:query', req => readAssistantRequest(store,req.identity,req.params.id));
  route('get', '/lead-assistant/requests/:id/leads', 'assistant:query', async req => {
    const r=await readAssistantRequest(store,req.identity,req.params.id);
    if(r.status!=='Completed'||!r.answer?.hasResults)throw new AppError(409,'RESULTS_UNAVAILABLE','Ask again for current completed lead results.');
    const m=await researchMember(store,req.identity,['assistant:query'],r.access);
    const result=await researchList(req,'assistantContributions',[['requestId','==',r.id]],r.access,async row=>{
      const lead=await store.get(path('leads',row.leadId));
      if(!canReadLead(m,lead)||lead.archived)throw new AppError(409,'STALE_SOURCE','Lead data changed. Ask again.');
      return row.lead;
    },r.epoch);
    const current=await readAssistantRequest(store,req.identity,r.id);if(current.status!=='Completed')throw new AppError(409,'STALE_SOURCE','Data changed. Ask again.');
    return result;
  });
  route('post', '/lead-assistant/requests/:id/cancel', 'assistant:query', req => {
    const input=parse(ResearchVersion,req.body);
    return mutate(req,'assistant:query',async tx=>{
      const r=await readAssistantRequest(tx,req.identity,req.params.id);assertVersion(r,input.expectedVersion);
      if(r.status!=='Pending')throw new AppError(409,'REQUEST_FINISHED','The answer has already finished.');
      const next={...r,status:'Cancelled',answer:{state:'Unavailable',text:'Answer stopped.'},version:r.version+1,updatedAt:now()};
      tx.set(path('assistantRequests',r.id),next);return {id:r.id,status:next.status,version:next.version};
    });
  });
  route('delete', '/lead-assistant/conversations/:id', 'assistant:query', req => {
    const input=parse(ResearchVersion,req.body);
    return mutate(req,'assistant:query',async tx=>{
      const c=await readConversation(tx,req.identity,req.params.id);assertVersion(c,input.expectedVersion);
      tx.set(path('assistantConversations',c.id),{...c,status:'Deleting',version:c.version+1,updatedAt:now()});
      return {id:c.id,status:'Deleting'};
    });
  });

  route('get', '/lead-data-reset', 'members:write', async (req) => {
    await resetAdmin(maintenanceStore, req.identity);
    return resetStatus(maintenanceStore);
  });
  route('post', '/lead-data-reset/preview', 'members:write', async (req) => {
    parse(z.object({}).strict(), req.body);
    return previewReset({
      store: maintenanceStore,
      identity: req.identity,
      now,
    });
  });
  route('post', '/lead-data-reset', 'members:write', (req) =>
    startReset({
      store: maintenanceStore,
      identity: req.identity,
      input: parse(ResetConfirmation, req.body),
      key: req.headers['idempotency-key'],
      now,
    }),
  );
  route('post', '/lead-data-reset/:id/resume', 'members:write', (req) =>
    resumeReset({
      store: maintenanceStore,
      identity: req.identity,
      id: req.params.id,
      expectedVersion: parse(ResetResume, req.body).expectedVersion,
      now,
    }),
  );
  route('get', '/archived-leads', 'leads:read', (req) =>
    list(req, 'leads', [...scopeFilters(req.member), ['archived', '==', true]]),
  );
  route('get', '/leads', 'leads:read', (req) => {
    if (
      req.query.filters !== undefined ||
      ['location', 'zone'].includes(req.query.field)
    )
      return filteredLeads(req);
    let searchOrder = 'id';
    const filters = [...scopeFilters(req.member), ['archived', '==', false]];
    if (req.query.stage) {
      if (String(req.query.stage).length > 100)
        throw new AppError(400, 'FILTER', 'Invalid stage');
      filters.push(['stage', '==', req.query.stage]);
    }
    if (req.query.source)
      filters.push(['source', '==', String(req.query.source)]);
    if (req.query.assignedToUid) {
      if (req.member.role !== 'Admin')
        throw new AppError(
          403,
          'SCOPE',
          'Only admins can filter other assignees',
        );
      filters.push(['assignedToUid', '==', String(req.query.assignedToUid)]);
    }
    if (req.query.search) {
      const field = req.query.field || 'name';
      const fields = {
        name: 'nameNormalized',
        company: 'companyNormalized',
        phone: 'phoneNormalized',
        email: 'email',
      };
      if (!fields[field])
        throw new AppError(400, 'FILTER', 'Unknown search field');
      const value = String(req.query.search).trim().toLowerCase().slice(0, 200);
      if (field === 'name' || field === 'company') {
        searchOrder = fields[field];
        filters.push(
          [fields[field], '>=', value],
          [fields[field], '<=', value + '\uf8ff'],
        );
      } else filters.push([fields[field], '==', value]);
    }
    return list(
      req,
      'leads',
      filters,
      undefined,
      searchOrder,
      searchOrder === 'id' ? 'desc' : 'asc',
    );
  });
  route('post', '/leads', 'leads:create', (req) => {
    const input = parse(LeadInput, req.body);
    if (req.member.role !== 'Admin' && input.needsReview)
      throw new AppError(
        403,
        'REVIEW',
        'Only admins may save incomplete legacy contacts',
      );
    return mutate(
      req,
      'leads:create',
      async (tx, m) => {
        const options = await readFieldOptions(tx);
        assertFieldOption(options, 'stage', input.stage);
        validateCustomValues(options, input.customFields);
        const id = uid();
        const prepared = await prepareLead(tx, input, {
          uid: m.uid,
          member: m,
          id,
          now: now(),
        });
        prepared.write();
        queueLeadNotification(
          tx,
          prepared.record,
          m.uid,
          'lead_created',
          now(),
        );
        await appendDiscussions(tx, prepared.record, m, now());
        return prepared.record;
      },
      { idempotent: true },
    );
  });
  const requireFiles = () => {
    if (!files)
      throw new AppError(
        503,
        'STORAGE_UNAVAILABLE',
        'File storage is unavailable',
      );
    return files;
  };
  const contentRoute = '/leads/:id/attachments/:attachmentId/content';
  router.put(
    contentRoute,
    async (req, res, next) => {
      try {
        if (req.identity.personalAccess)
          req.identity.personalAccess.requiredScopes = [
            PAT_ROUTES['put ' + contentRoute],
          ];
        const m = await requireMember(store, req.identity, 'leads:edit');
        await leadAccess(store, m, req.params.id);
        if (!req.is('application/octet-stream'))
          throw new AppError(
            415,
            'FILE_TYPE',
            'Upload binary file contents as application/octet-stream',
          );
        next();
      } catch (e) {
        next(e);
      }
    },
    express.raw({ type: 'application/octet-stream', limit: MAX_FILE_BYTES }),
  );
  route('post', '/leads/:id/attachments', 'leads:edit', (req) => {
    requireFiles();
    const input = parse(AttachmentInput, req.body);
    return mutate(
      req,
      'leads:edit',
      (tx, m) => reserveAttachment(tx, m, req.params.id, input, uid(), now()),
      { idempotent: true },
    );
  });
  route(
    'put',
    '/leads/:id/attachments/:attachmentId/content',
    'leads:edit',
    (req) =>
      putAttachment({
        store,
        identity: req.identity,
        leadId: req.params.id,
        id: req.params.attachmentId,
        bytes: req.body,
        files: requireFiles(),
        now,
        commit: (fn) => mutate(req, 'leads:edit', fn),
      }),
  );
  route('get', '/leads/:id/attachments', 'leads:read', async (req) => {
    await leadAccess(store, req.member, req.params.id);
    const result = await list(req, 'leadAttachments', [
      ['leadId', '==', req.params.id],
      ['state', '==', 'Ready'],
    ]);
    const m = await requireMember(store, req.identity, 'leads:read');
    await leadAccess(store, m, req.params.id);
    return { ...result, items: result.items.map(attachmentView) };
  });
  route(
    'get',
    '/leads/:id/attachments/:attachmentId/content',
    'leads:read',
    async (req, res) => {
      const { record } = await attachmentAccess(
        store,
        req.member,
        req.params.id,
        req.params.attachmentId,
      );
      if (record.state !== 'Ready')
        throw new AppError(
          409,
          'UPLOAD_PENDING',
          'This upload is not complete',
        );
      const bytes = await requireFiles().read(record.objectPath);
      const current = await requireMember(store, req.identity, 'leads:read');
      const latest = await attachmentAccess(
        store,
        current,
        req.params.id,
        req.params.attachmentId,
      );
      if (latest.record.state !== 'Ready')
        throw new AppError(404, 'NOT_FOUND', 'Attachment is unavailable');
      res.set({
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(record.name).replace(/'/g, '%27')}`,
        'Content-Length': String(bytes.length),
      });
      res.send(bytes);
    },
  );
  route(
    'delete',
    '/leads/:id/attachments/:attachmentId',
    'leads:edit',
    (req) => {
      const input = parse(AttachmentDelete, req.body);
      return mutate(req, 'leads:edit', (tx, m) =>
        removeAttachment(
          tx,
          m,
          req.params.id,
          req.params.attachmentId,
          input.expectedVersion,
          now(),
        ),
      );
    },
  );
  route('post', '/leads/batch/preview', 'leads:edit', (req) => {
    const input = parse(BulkLeadInput, req.body);
    return store.run(async (tx) =>
      planBulkLeads(
        tx,
        await requireMember(tx, req.identity, 'leads:edit'),
        input,
        now(),
      ),
    );
  });
  route('post', '/leads/batch', 'leads:edit', (req) => {
    const input = parse(BulkLeadInput, req.body);
    return mutate(
      req,
      'leads:edit',
      (tx, m) => planBulkLeads(tx, m, input, now(), true),
      { idempotent: true },
    );
  });
  route('get', '/leads/:id', 'leads:read', (req) =>
    leadAccess(store, req.member, req.params.id),
  );
  route('patch', '/leads/:id', 'leads:edit', (req) => {
    const input = parse(LeadPatch, req.body);
    return mutate(req, 'leads:edit', async (tx, m) => {
      const old = await leadAccess(tx, m, req.params.id);
      assertVersion(old, input.expectedVersion);
      const base = {};
      for (const k of Object.keys(LeadInput.shape))
        if (k in old) base[k] = old[k];
      const { expectedVersion, doNotContact, suppressionReason, ...changes } =
        input;
      if (changes.needsReview !== undefined && m.role !== 'Admin')
        throw new AppError(
          403,
          'REVIEW',
          'Only admins may change legacy review status',
        );
      const options = await readFieldOptions(tx);
      assertFieldOption(options, 'stage', changes.stage, old.stage);
      if (changes.customFields !== undefined) {
        changes.customFields = { ...old.customFields, ...changes.customFields };
        validateCustomValues(
          options,
          changes.customFields,
          old.customFields || {},
        );
      }
      const normalized = normalizeLead({ ...base, ...changes });
      const oldKeys = contactKeys(old), nextKeys = contactKeys(normalized);
      const keys = [...new Set([...oldKeys, ...nextKeys])];
      const docs = await Promise.all(
        keys.map((k) => tx.get(path('dedupeKeys', k))),
      );
      const otherIds = keys
        // Retained contact keys may be shared by separate imported enquiries.
        // Reject another lead's ownership only for newly acquired keys.
        .filter((k) => nextKeys.includes(k) && !oldKeys.includes(k))
        .flatMap((k) =>
          (docs[keys.indexOf(k)]?.leadIds || []).filter((id) => id !== old.id),
        );
      if (otherIds.length)
        throw new AppError(
          409,
          'DUPLICATE',
          'This contact belongs to another lead',
        );
      const tasks =
        doNotContact === true
          ? await tx.query(path('tasks'), {
              filters: [
                ['leadId', '==', old.id],
                ['state', '==', 'Pending'],
              ],
              limit: 101,
            })
          : [];
      if (tasks.length > 100)
        throw new AppError(
          409,
          'TASK_LIMIT',
          'Cancel pending tasks before suppressing this lead',
        );
      const { allowDuplicate, ...fields } = normalized;
      const updated = {
        ...old,
        ...fields,
        doNotContact: doNotContact ?? old.doNotContact,
        suppressionReason: suppressionReason ?? old.suppressionReason,
        updatedAt: now(),
        version: old.version + 1,
      };
      if (updated.doNotContact && !updated.suppressionReason)
        throw new AppError(400, 'REASON', 'Add a do-not-contact reason');
      keys.forEach((k, i) => {
        const ids = (docs[i]?.leadIds || []).filter((id) => id !== old.id);
        if (contactKeys(normalized).includes(k)) ids.push(old.id);
        tx.set(path('dedupeKeys', k), { id: k, leadIds: ids });
      });
      await appendDiscussions(tx, updated, m, now(), {
        previous: old,
        idPrefix: uid(),
      });
      tx.set(path('leads', old.id), updated);
      recordStage(tx, updated, old.stage, m.uid, now(), 'edited');
      for (const t of tasks)
        if (t.kind === 'outreach')
          tx.set(path('tasks', t.id), {
            ...t,
            state: 'Cancelled',
            version: t.version + 1,
          });
      const aid = uid();
      tx.set(path('activities', aid), {
        id: aid,
        leadId: old.id,
        type: 'change',
        notes:
          old.stage !== updated.stage
            ? `Stage changed to ${updated.stage}`
            : 'Lead details updated',
        actorUid: m.uid,
        createdAt: now(),
      });
      return updated;
    });
  });
  route('post', '/leads/:id/archive', 'leads:edit', (req) =>
    mutate(req, 'leads:edit', async (tx, m) => {
      const input = parse(ArchiveInput, req.body);
      const l = await leadAccess(tx, m, req.params.id);
      assertVersion(l, input.expectedVersion);
      if (l.archived) return { ok: true };
      const tasks = await tx.query(path('tasks'), {
        filters: [
          ['leadId', '==', l.id],
          ['state', '==', 'Pending'],
          ['kind', '==', 'outreach'],
        ],
        limit: 101,
      });
      if (tasks.length > 100)
        throw new AppError(409, 'TASK_LIMIT', 'Too many pending tasks');
      tx.set(path('leads', l.id), {
        ...l,
        archived: true,
        archivedAt: l.archivedAt || now(),
        version: l.version + 1,
        updatedAt: now(),
      });
      const activityId = uid();
      tx.set(path('activities', activityId), {
        id: activityId,
        leadId: l.id,
        type: 'change',
        notes: 'Lead archived',
        actorUid: m.uid,
        createdAt: now(),
      });
      for (const t of tasks)
        tx.set(path('tasks', t.id), {
          ...t,
          state: 'Cancelled',
          version: t.version + 1,
        });
      return { ok: true };
    }),
  );
  route('post', '/leads/:id/restore', 'leads:edit', req =>
    mutate(req,'leads:edit',async(tx,m)=>{
      const input=parse(ArchiveInput,req.body),lead=await leadAccess(tx,m,req.params.id);
      assertVersion(lead,input.expectedVersion);
      if(!lead.archived)return lead;
      const keys=contactKeys(lead),indexes=await tx.getAll(keys.map(key=>path('dedupeKeys',key)));
      for(let i=0;i<keys.length;i++)if(!indexes[i]?.leadIds?.includes(lead.id)&&indexes[i]?.leadIds?.some(id=>id!==lead.id))throw new AppError(409,'DUPLICATE','A contact index conflict needs Admin review before restoration');
      const updated={...lead,archived:false,archivedAt:null,restoredAt:now(),updatedAt:now(),version:lead.version+1};
      for(let i=0;i<keys.length;i++)tx.set(path('dedupeKeys',keys[i]),{id:keys[i],leadIds:[...new Set([...(indexes[i]?.leadIds||[]),lead.id])]});
      tx.set(path('leads',lead.id),updated);
      const id=uid();tx.set(path('activities',id),{id,leadId:lead.id,type:'change',notes:'Lead restored; cancelled outreach was not rescheduled',actorUid:m.uid,createdAt:now()});
      return updated;
    }),
  );
  route('patch', '/leads/:id/assignment', 'assignments:write', (req) =>
    mutate(req, 'assignments:write', async (tx, m) => {
      const input = parse(AssignmentPatch, req.body);
      const l = await leadAccess(tx, m, req.params.id);
      assertVersion(l, input.expectedVersion);
      const target = input.assignedToUid;
      if (target === l.assignedToUid) return l;
      if (l.archived)
        throw new AppError(
          400,
          'ARCHIVED',
          'Restore this lead before assigning it',
        );
      const member = target ? await tx.get(path('members', target)) : null;
      if (
        target &&
        (!member?.active || !member.capabilities.includes('leads:read'))
      )
        throw new AppError(
          400,
          'ASSIGNEE',
          'Choose an active member with lead access',
        );
      const tasks = await tx.query(path('tasks'), {
        filters: [
          ['leadId', '==', l.id],
          ['state', '==', 'Pending'],
          ['kind', '==', 'outreach'],
        ],
        limit: 101,
      });
      if (tasks.length > 100)
        throw new AppError(409, 'TASK_LIMIT', 'Too many pending tasks');
      const updated = {
        ...l,
        assignedToUid: target || null,
        assignmentRevision: (l.assignmentRevision || 1) + 1,
        version: l.version + 1,
        updatedAt: now(),
      };
      tx.set(path('leads', l.id), updated);
      queueLeadNotification(tx, updated, m.uid, 'lead_assigned', now());
      for (const t of tasks)
        tx.set(path('tasks', t.id), {
          ...t,
          state: 'Cancelled',
          version: t.version + 1,
        });
      return updated;
    }),
  );
  route('get', '/leads/:id/journey', 'leads:read', async (req) => {
    const lead = await leadAccess(store, req.member, req.params.id);
    const history = await list(req, 'leadTransitions', [
      ['leadId', '==', lead.id],
    ]);
    return {
      ...history,
      currentStage: lead.stage,
      historyComplete: !!(await store.get(
        path('leadTransitions', transitionId(lead.id, 1)),
      )),
    };
  });
  route('get', '/leads/:id/activities', 'leads:read', async (req) => {
    await leadAccess(store, req.member, req.params.id);
    return list(req, 'activities', [['leadId', '==', req.params.id]]);
  });
  route('post', '/leads/:id/activities', 'activities:write', (req) => {
    const input = parse(ActivityInput, req.body);
    if (input.type === 'call' && !input.outcome)
      throw new AppError(400, 'OUTCOME', 'Choose a call outcome');
    if (input.type === 'note' && !input.notes)
      throw new AppError(400, 'NOTE', 'Write a note');
    return mutate(
      req,
      'activities:write',
      async (tx, m) => {
        const l = await leadAccess(tx, m, req.params.id);
        assertVersion(l, input.expectedVersion);
        const options = await readFieldOptions(tx);
        assertFieldOption(options, 'stage', input.stage, l.stage);
        assertFieldOption(options, 'outcome', input.outcome);
        assertFieldOption(options, 'disposition', input.disposition);
        if (
          input.type === 'call' &&
          (l.doNotContact || l.needsReview || l.archived)
        )
          throw new AppError(
            409,
            'SUPPRESSED',
            'This lead is not available for outreach',
          );
        if (input.followUp && !m.capabilities.includes('tasks:write'))
          throw new AppError(403, 'TASKS', 'You cannot create tasks');
        if (input.stage && !m.capabilities.includes('leads:edit'))
          throw new AppError(403, 'STAGE', 'You cannot change lead stages');
        const suppress = input.disposition === 'Do not contact';
        if (suppress && input.followUp?.kind === 'outreach')
          throw new AppError(
            400,
            'SUPPRESSED',
            'Do not create outreach for a suppressed lead',
          );
        const pending = suppress
          ? await tx.query(path('tasks'), {
              filters: [
                ['leadId', '==', l.id],
                ['state', '==', 'Pending'],
              ],
              limit: 101,
            })
          : [];
        if (pending.length > 100)
          throw new AppError(409, 'TASK_LIMIT', 'Too many pending tasks');
        const id = uid();
        const { followUp, expectedVersion, stage, ...fields } = input;
        const activity = {
          ...fields,
          id,
          leadId: l.id,
          actorUid: m.uid,
          createdAt: now(),
          revision: 1,
        };
        const updated = {
          ...l,
          stage: stage || l.stage,
          ...(input.notes ? { latestComment: input.notes } : {}),
          version: l.version + 1,
          updatedAt: now(),
          ...(input.type === 'call'
            ? { lastContactAt: now(), lastCallOutcome: input.outcome }
            : {}),
          ...(suppress
            ? {
                doNotContact: true,
                suppressionReason: input.notes || 'Do not contact requested',
              }
            : {}),
        };
        const savedActivity = await enqueueAnalysis(
          tx,
          activity,
          m,
          updated,
          now(),
          { manual: Boolean(followUp) },
        );
        tx.set(path('leads', l.id), updated);
        recordStage(tx, updated, l.stage, m.uid, now(), 'conversation');
        if (followUp) {
          const task = taskRecord(followUp, m, uid(), l.id);
          if (task.kind === 'outreach' && (l.doNotContact || l.needsReview))
            throw new AppError(409, 'SUPPRESSED', 'Cannot schedule outreach');
          queueTask(tx, task);
        }
        for (const t of pending)
          if (t.kind === 'outreach')
            tx.set(path('tasks', t.id), {
              ...t,
              state: 'Cancelled',
              version: t.version + 1,
            });
        return { activity: savedActivity, lead: updated };
      },
      { idempotent: true },
    );
  });
  route('post', '/activities/:id/corrections', 'activities:write', (req) => {
    const input = parse(
      ActivityInput.omit({
        followUp: true,
        stage: true,
        expectedVersion: true,
      }).extend({ expectedRevision: LeadPatch.shape.expectedVersion }),
      req.body,
    );
    if (input.type === 'call' && !input.outcome)
      throw new AppError(400, 'OUTCOME', 'Choose a call outcome');
    return mutate(
      req,
      'activities:write',
      async (tx, m) => {
        const old = await tx.get(path('activities', req.params.id));
        if (!old) throw new AppError(404, 'NOT_FOUND', 'Activity not found');
        const lead = await leadAccess(tx, m, old.leadId);
        if (m.role !== 'Admin' && old.actorUid !== m.uid)
          throw new AppError(403,'ACTIVITY_AUTHOR','Only the original author or an Admin may correct this entry');
        const latest = await tx.query(path('activities'), {
          filters: [
            ['leadId', '==', old.leadId],
            ['type', '==', 'call'],
          ],
          order: 'id',
          direction: 'desc',
          limit: 1,
        });
        const options = await readFieldOptions(tx);
        assertFieldOption(options, 'outcome', input.outcome, old.outcome);
        assertFieldOption(
          options,
          'disposition',
          input.disposition,
          old.disposition,
        );
        if (input.type !== old.type)
          throw new AppError(
            400,
            'TYPE',
            'A correction cannot change the activity type',
          );
        if (old.revision !== input.expectedRevision)
          throw new AppError(409, 'STALE_VERSION', 'Activity changed');
        const id = uid();
        tx.set(path('activityRevisions', id), {
          ...old,
          id,
          activityId: old.id,
          correctedAt: now(),
          correctedBy: m.uid,
        });
        const { expectedRevision, ...fields } = input;
        const updated = { ...old, ...fields, revision: old.revision + 1 };
        let preserveManual = false;
        if (old.autoReminder?.taskId) {
          const task = await tx.get(path('tasks', old.autoReminder.taskId));
          if (task?.state === 'Pending' && task.version === 1)
            tx.set(path('tasks', task.id), {
              ...task,
              state: 'Cancelled',
              version: task.version + 1,
            });
          else if (task) preserveManual = true;
        }
        const previousJob = old.autoReminder?.id
          ? await tx.get(path('noteAnalyses', old.autoReminder.id))
          : null;
        if (previousJob)
          tx.set(path('noteAnalyses', previousJob.id), {
            ...previousJob,
            status: 'Cancelled',
          });
        const saved = await enqueueAnalysis(tx, updated, m, lead, now(), {
          manual: old.autoReminder?.status === 'Manual',
          preserveManual,
        });
        tx.set(path('leads', lead.id), {
          ...lead,
          ...(old.type === 'call' && latest[0]?.id === old.id
            ? { lastCallOutcome: input.outcome }
            : {}),
          version: lead.version + 1,
          updatedAt: now(),
        });
        return saved;
      },
      { idempotent: true },
    );
  });
  route('patch', '/activities/:id/automatic-reminder', 'tasks:write', (req) => {
    const input = parse(AutomaticReminderAction, req.body);
    return mutate(req, 'tasks:write', async (tx, m) => {
      const activity = await tx.get(path('activities', req.params.id));
      if (!activity) throw new AppError(404, 'NOT_FOUND', 'Activity not found');
      const lead = await leadAccess(tx, m, activity.leadId);
      if (activity.autoReminder?.ownerUid !== m.uid)
        throw new AppError(
          403,
          'OWNER',
          'Only the reminder owner can change automatic scheduling',
        );
      if (activity.revision !== input.expectedRevision)
        throw new AppError(
          409,
          'STALE_VERSION',
          'This note changed. Refresh and try again.',
        );
      const auto = activity.autoReminder;
      if (
        !['Pending', 'Failed', 'NeedsReview', 'Scheduled'].includes(auto.status)
      )
        throw new AppError(
          409,
          'ANALYSIS_STATE',
          'This analysis is already resolved',
        );
      const task = auto.taskId
        ? await tx.get(path('tasks', auto.taskId))
        : null;
      if (task && (task.version !== 1 || task.state !== 'Pending'))
        throw new AppError(
          409,
          'TASK_CHANGED',
          'This reminder was already changed. Edit it from Reminders.',
        );
      const job = await tx.get(path('noteAnalyses', auto.id));
      let summary;
      if (input.action === 'retry') {
        if (auto.status !== 'Failed')
          throw new AppError(
            409,
            'ANALYSIS_STATE',
            'Only failed analyses can be retried',
          );
        if (!m.capabilities.includes('activities:write'))
          throw new AppError(403, 'FORBIDDEN', 'You cannot analyze notes');
        if (job && (job.retryCount || 0) >= 3)
          throw new AppError(
            429,
            'RETRY_LIMIT',
            'Use manual scheduling after repeated analysis failures',
          );
        if (job)
          tx.set(path('noteAnalyses', auto.id), {
            ...job,
            status: 'Pending',
            attemptCount: 0,
            retryCount: (job.retryCount || 0) + 1,
            nextAttemptAt: now(),
          });
        summary = {
          ...auto,
          status: 'Pending',
          message: 'Checking this note again.',
        };
      } else {
        if (
          input.action === 'schedule' &&
          (lead.archived || lead.doNotContact || lead.needsReview)
        )
          throw new AppError(
            409,
            'SUPPRESSED',
            'Outreach is disabled for this lead',
          );
        if (task)
          tx.set(path('tasks', task.id), {
            ...task,
            state: 'Cancelled',
            version: task.version + 1,
          });
        if (job)
          tx.set(path('noteAnalyses', job.id), { ...job, status: 'Cancelled' });
        if (input.action === 'schedule') {
          if (Date.parse(input.task.dueAt) <= Date.parse(now()))
            throw new AppError(400, 'DATE', 'Choose a future time');
          const manual = taskRecord(input.task, m, uid(), lead.id);
          queueTask(tx, manual);
          summary = {
            ...auto,
            status: 'Manual',
            taskId: manual.id,
            dueAt: manual.dueAt,
            message: 'Reminder scheduled manually.',
          };
        } else
          summary = {
            ...auto,
            status: 'Dismissed',
            message: 'Automatic reminder dismissed.',
          };
      }
      const updated = { ...activity, autoReminder: summary };
      tx.set(path('activities', activity.id), updated);
      return updated;
    });
  });
  route('get', '/tasks', 'leads:read', (req) => {
    const filters = [['recipientUid', '==', req.member.uid]];
    if (req.query.state) filters.push(['state', '==', String(req.query.state)]);
    if (req.query.leadId)
      filters.push(['leadId', '==', String(req.query.leadId)]);
    return list(req, 'tasks', filters, undefined, 'dueAt', 'asc').then(
      async (result) => {
        const leadIds = [
          ...new Set(result.items.filter(t => !t.deleted && t.leadId).map(t => t.leadId)),
        ];
        const records = await store.getAll(leadIds.map(id => path('leads', id)));
        const leads = new Map(leadIds.map((id, i) => [id, records[i]]));
        const items = result.items.filter(t =>
          !t.deleted && (t.leadId
            ? canReadLead(req.member, leads.get(t.leadId))
            : t.creatorUid === req.member.uid),
        );
        return { ...result, items };
      },
    );
  });
  route('get', '/tasks/:id', 'leads:read', (req) =>
    readTask(store, req.member, req.params.id),
  );
  route('post', '/tasks', 'tasks:write', (req) => {
    const input = parse(TaskInput, req.body);
    return mutate(
      req,
      'tasks:write',
      async (tx, m) => {
        if (input.leadId) {
          const l = await leadAccess(tx, m, input.leadId);
          if (
            input.kind === 'outreach' &&
            (l.doNotContact || l.needsReview || l.archived)
          )
            throw new AppError(
              409,
              'SUPPRESSED',
              'Outreach is disabled for this lead',
            );
        }
        const task = taskRecord(input, m, uid(), input.leadId);
        queueTask(tx, task);
        return task;
      },
      { idempotent: true },
    );
  });
  route('patch', '/tasks/:id', 'tasks:write', (req) => {
    const input = parse(TaskPatch, req.body);
    return mutate(req, 'tasks:write', async (tx, m) => {
      const old = await readTask(tx, m, req.params.id);
      if (old.recipientUid !== m.uid)
        throw new AppError(
          403,
          'TASK_OWNER',
          'Only the recipient can update this task',
        );
      assertVersion(old, input.expectedVersion);
      if (input.timezone) validateTimezone(input.timezone);
      const { expectedVersion, ...fields } = input;
      const t = {
        ...old,
        ...fields,
        version: old.version + 1,
        completedAt:
          input.state === 'Completed'
            ? now()
            : input.state === 'Pending'
              ? null
              : old.completedAt,
      };
      if (t.state === 'Pending') {
        if (t.leadId) {
          const l = await leadAccess(tx, m, t.leadId);
          if (
            t.kind === 'outreach' &&
            (l.doNotContact || l.archived || l.needsReview)
          )
            throw new AppError(409, 'SUPPRESSED', 'Outreach is disabled');
        }
        queueTask(tx, t);
      } else tx.set(path('tasks', t.id), t);
      if (old.sourceActivityId) {
        const a = await tx.get(path('activities', old.sourceActivityId));
        if (a?.autoReminder?.taskId === old.id)
          tx.set(path('activities', a.id), {
            ...a,
            autoReminder: {
              ...a.autoReminder,
              status: 'TaskChanged',
              message:
                t.state === 'Pending'
                  ? 'Reminder was edited manually. Open Reminders to change it again.'
                  : 'Reminder ' + t.state.toLowerCase() + '.',
              dueAt: t.dueAt,
            },
          });
      }
      return t;
    });
  });
  route('delete', '/tasks/:id', 'tasks:write', (req) => {
    const input = parse(TaskDelete, req.body);
    return mutate(req, 'tasks:write', async (tx, m) => {
      const task = await readTask(tx, m, req.params.id);
      if (task.recipientUid !== m.uid)
        throw new AppError(
          403,
          'TASK_OWNER',
          'Only the recipient can delete this task',
        );
      assertVersion(task, input.expectedVersion);
      const delivery = await tx.get(
        path('reminderDeliveries', task.id + '_' + task.version),
      );
      const activity = task.sourceActivityId
        ? await tx.get(path('activities', task.sourceActivityId))
        : null;
      tx.set(path('tasks', task.id), {
        ...task,
        state: 'Cancelled',
        deleted: true,
        deletedAt: now(),
        version: task.version + 1,
      });
      if (delivery?.status === 'Pending')
        tx.set(path('reminderDeliveries', delivery.id), {
          ...delivery,
          status: 'Cancelled',
        });
      if (activity?.autoReminder?.taskId === task.id)
        tx.set(path('activities', activity.id), {
          ...activity,
          autoReminder: {
            ...activity.autoReminder,
            status: 'TaskChanged',
            message: 'Reminder deleted.',
          },
        });
      return { ok: true };
    });
  });
  route('get', '/members', 'members:write', (req) => list(req, 'members'));
  route('get', '/invitations', 'members:write', (req) =>
    list(req, 'invitations'),
  );
  route('post', '/invitations', 'members:write', (req) => {
    const input = parse(GrantInput, req.body);
    if (ADMIN_EMAILS.includes(input.email))
      throw new AppError(
        409,
        'ADMIN',
        'This account is a bootstrap administrator',
      );
    return mutate(
      req,
      'members:write',
      async (tx) => {
        const id = hash(input.email);
        const prior = await tx.get(path('invitations', id));
        const inv = {
          ...input,
          capabilities: input.capabilities || PRESETS[input.role],
          id,
          active: true,
          createdAt: now(),
          expiresAt: new Date(Date.parse(now()) + 7 * 86400000).toISOString(),
          version: (prior?.version || 0) + 1,
        };
        tx.set(path('invitations', id), inv);
        return inv;
      },
      { idempotent: true },
    );
  });
  route('delete', '/invitations/:id', 'members:write', (req) =>
    mutate(req, 'members:write', async (tx) => {
      const inv = await tx.get(path('invitations', req.params.id));
      if (inv) tx.set(path('invitations', inv.id), { ...inv, active: false });
      return { ok: true };
    }),
  );
  route('patch', '/members/:uid', 'members:write', (req) => {
    const input = parse(MemberPatch, req.body);
    return mutate(req, 'members:write', async (tx) => {
      const old = await tx.get(path('members', req.params.uid));
      if (!old) throw new AppError(404, 'NOT_FOUND', 'Member not found');
      if (old.role === 'Admin')
        throw new AppError(
          403,
          'BOOTSTRAP_ADMIN',
          'Bootstrap administrators cannot be changed through this screen',
        );
      assertVersion(old, input.expectedVersion);
      const { expectedVersion, ...fields } = input;
      const m = {
        ...old,
        ...fields,
        capabilities: input.capabilities || PRESETS[input.role],
        version: old.version + 1,
      };
      tx.set(path('members', m.uid), m);
      return m;
    });
  });
  route('get', '/imports', 'imports:read', async (req) => {
    const filters = sharedImports(req.member)
      ? []
      : [['createdByUid', '==', req.member.uid]];
    if (req.query.uploader) {
      if (!sharedImports(req.member) && req.query.uploader !== req.member.uid)
        throw new AppError(
          403,
          'FORBIDDEN',
          'Shared import access is required',
        );
      if (!filters.length)
        filters.push(['createdByUid', '==', req.query.uploader]);
    }
    if (req.query.status) {
      if (
        ![
          'Preparing',
          'Preview',
          'Importing',
          'Blocked',
          'Completed',
          'Deleting',
          'DetailsDeleted',
        ].includes(req.query.status)
      )
        throw new AppError(400, 'FILTER', 'Unknown import status');
      filters.push(['status', '==', req.query.status]);
    }
    for (const [key, op] of [
      ['from', '>='],
      ['to', '<='],
    ])
      if (req.query[key]) {
        if (
          !/^\d{4}-\d{2}-\d{2}T/.test(req.query[key]) ||
          !Number.isFinite(Date.parse(req.query[key]))
        )
          throw new AppError(400, 'FILTER', 'Use an ISO date-time');
        filters.push(['createdAt', op, new Date(req.query[key]).toISOString()]);
      }
    const result = await list(
      req,
      'imports',
      filters,
      undefined,
      'createdAt',
      'desc',
    );
    return { ...result, items: result.items.map(importSummary) };
  });
  route('get', '/imports/:id/rows', 'imports:read', async (req) => {
    const j = await readImport(store, req.member, req.params.id);
    if (j.formatVersion !== 3)
      return { items: [], nextCursor: null, legacy: true };
    const result = await list(
      req,
      'importChunks',
      [['importId', '==', j.id]],
      undefined,
      'id',
      'asc',
    );
    return {
      ...result,
      items: await visibleImportRows(
        store,
        req.member,
        j,
        result.items.flatMap((c) => c.rows || []),
      ),
    };
  });
  route('get', '/imports/:id/report', 'imports:read', async (req) => {
    if (!(await readWorkspaceSettings(store)).exportsEnabled)
      throw new AppError(
        403,
        'EXPORT_DISABLED',
        'Workspace exports are disabled',
      );
    const j = await readImport(store, req.member, req.params.id);
    if (j.formatVersion !== 3 || j.status === 'DetailsDeleted')
      return { items: [], nextCursor: null };
    const result = await list(
      req,
      'importChunks',
      [['importId', '==', j.id]],
      undefined,
      'id',
      'asc',
    );
    return {
      ...result,
      items: await visibleImportRows(
        store,
        req.member,
        j,
        result.items.flatMap((c) => c.rows || []),
      ),
    };
  });
  route('post', '/imports/:id/plan', 'imports:write', (req) =>
    mutate(req, 'imports:write', (tx, m) =>
      planImportChunk(
        tx,
        m,
        req.params.id,
        parse(ImportVersion, req.body),
        now(),
      ),
    ),
  );
  route('post', '/imports/:id/review', 'imports:write', (req) =>
    mutate(req, 'imports:write', (tx, m) =>
      approveImportChunk(
        tx,
        m,
        req.params.id,
        parse(ImportVersion, req.body),
        now(),
      ),
    ),
  );
  route('patch', '/imports/:id/rows/:index', 'imports:write', (req) => {
    const index = Number(req.params.index);
    if (!/^\d+$/.test(req.params.index) || !Number.isSafeInteger(index))
      throw new AppError(400, 'IMPORT_ROW', 'Choose a valid row');
    return mutate(req, 'imports:write', (tx, m) =>
      decideImportRow(
        tx,
        m,
        req.params.id,
        index,
        parse(ImportDecision, req.body),
        now(),
      ),
    );
  });
  route('post', '/imports/:id/refresh', 'imports:write', (req) =>
    mutate(req, 'imports:write', (tx, m) =>
      refreshImportReview(
        tx,
        m,
        req.params.id,
        parse(ImportVersion, req.body),
        now(),
      ),
    ),
  );
  route('delete', '/imports/:id', 'members:write', (req) =>
    mutate(req, 'members:write', (tx, m) =>
      deleteImportDetails(
        tx,
        m,
        req.params.id,
        parse(ImportDelete, req.body),
        now(),
      ),
    ),
  );
  route('post', '/imports/preview', 'imports:write', async (req) => {
    const input = parse(ImportInput, req.body);
    if(input.statusField!==undefined && !input.reviewed)throw new AppError(400,'IMPORT_MODE','Selectable status mapping requires reviewed import mode');
    if (input.reviewed) {
      if (req.identity.personalAccess)
        throw new AppError(
          403,
          'GOOGLE_REQUIRED',
          'Reviewed imports require Google sign-in',
        );
      return mutate(
        req,
        'imports:write',
        (tx, m) => createImportReview(tx, m, input, now()),
        { idempotent: true },
      );
    }
    if (req.member.role !== 'Admin')
      throw new AppError(403, 'FORBIDDEN', 'Use reviewed import mode');
    if (input.duplicateMode === 'update' || input.sourceImportId)
      throw new AppError(
        400,
        'IMPORT_MODE',
        'Updates require reviewed import mode',
      );
    const options = await readFieldOptions(store);
    const rows = previewRows(input, options.values.stage, {stageHidden:options.hiddenFields.includes('stage')});
    const fingerprintData = [
      input.sheet,
      input.rows,
      input.statusMap,
      input.dateOrder,
      input.duplicateMode,
      options.version,
      'discussion-import-v2',
    ];
    const ownerFingerprint = hash(
      JSON.stringify([req.member.uid, ...fingerprintData]),
    );
    return mutate(
      req,
      'imports:write',
      async (tx, m) => {
        let base = await tx.get(path('imports', ownerFingerprint));
        if (!base) {
          const legacy = await tx.get(
            path('imports', hash(JSON.stringify(fingerprintData))),
          );
          if (legacy?.createdByUid === m.uid) base = legacy;
        }
        const duplicate = base?.replacementImportId
          ? await tx.get(path('imports', base.replacementImportId))
          : base;
        if (
          duplicate &&
          duplicate.createdByUid === m.uid &&
          duplicate.status !== 'DetailsDeleted' &&
          (duplicate.expiresAt > now() ||
            duplicate.status !== 'Preview' ||
            duplicate.offset)
        )
          return duplicate;
        const fingerprint = base ? uid() : ownerFingerprint;
        if (base)
          tx.set(path('imports', base.id), {
            ...base,
            replacementImportId: fingerprint,
          });
        for (let offset = 0; offset < rows.length; offset += IMPORT_CHUNK_SIZE)
          tx.set(
            path(
              'importChunks',
              fingerprint + '_' + offset / IMPORT_CHUNK_SIZE,
            ),
            {
              id: fingerprint + '_' + offset / IMPORT_CHUNK_SIZE,
              importId: fingerprint,
              rows: rows.slice(offset, offset + IMPORT_CHUNK_SIZE),
            },
          );
        const result = {
          id: fingerprint,
          filename: input.filename,
          sheet: input.sheet,
          duplicateMode: input.duplicateMode,
          chunkSize: IMPORT_CHUNK_SIZE,
          commentCount: rows.reduce(
            (count, row) => count + (row.comments?.length || 0),
            0,
          ),
          total: rows.length,
          valid: rows.filter((r) => !r.error).length,
          invalid: rows.filter((r) => r.error).length,
          needsReview: rows.filter((r) => r.row?.needsReview).length,
          blank: input.blankRows,
          offset: 0,
          imported: 0,
          duplicates: 0,
          failed: 0,
          status: 'Preview',
          createdByUid: m.uid,
          createdAt: now(),
          expiresAt: new Date(Date.parse(now()) + 86400000).toISOString(),
          errors: rows.filter((r) => r.error).slice(0, 100),
        };
        tx.set(path('imports', fingerprint), result);
        return result;
      },
      { idempotent: true },
    );
  });
  route('get', '/imports/:id', 'imports:read', async (req) => {
    const i = await readImport(store, req.member, req.params.id);
    return i.formatVersion === 3 || req.member.role !== 'Admin'
      ? importSummary(i)
      : i;
  });
  route('get', '/imports/:id/errors', 'imports:read', async (req) => {
    const job = await readImport(store, req.member, req.params.id);
    if (req.member.scope !== 'all' && job.createdByUid !== req.member.uid)
      throw new AppError(
        403,
        'FORBIDDEN',
        'Use the permission-filtered row results',
      );
    const result = await list(req, 'importChunks', [
      ['importId', '==', job.id],
    ]);
    return {
      ...result,
      items: result.items.flatMap((c) =>
        c.rows
          .filter((r) => r.error)
          .map((r) => ({ index: r.index, error: r.error })),
      ),
    };
  });
  route('post', '/imports/:id/commit', 'imports:write', async (req) => {
    if (req.identity.personalAccess) {
      const job = await readImport(store, req.member, req.params.id, true);
      if (job.formatVersion === 3)
        throw new AppError(
          403,
          'GOOGLE_REQUIRED',
          'Reviewed commits require Google sign-in',
        );
    }
    return mutate(
      req,
      'imports:write',
      async (tx, m) => {
        const p = path('imports', req.params.id);
        const job = await readImport(tx, m, req.params.id, true);
        if (job.formatVersion === 3)
          return commitImportReview(
            tx,
            m,
            job.id,
            parse(ImportVersion, req.body),
            now(),
          );
        if (job.createdByUid !== m.uid && m.role !== 'Admin')
          throw new AppError(
            403,
            'FORBIDDEN',
            'Legacy jobs must be resumed by their uploader or an admin',
          );
        if (m.role !== 'Admin')
          throw new AppError(403, 'FORBIDDEN', 'Use reviewed import mode');
        if (job.expiresAt <= now() && job.status === 'Preview' && !job.offset)
          throw new AppError(
            409,
            'EXPIRED',
            'Preview expired. Re-upload and validate again.',
          );
        if (job.status === 'Completed') return job;
        const chunk = await tx.get(
          path(
            'importChunks',
            job.id + '_' + job.offset / (job.chunkSize || 25),
          ),
        );
        const prepared = [];
        const seen = new Set();
        const results = [];
        for (const item of chunk?.rows || []) {
          if (item.error) {
            results.push('invalid');
            continue;
          }
          const { phoneNormalized, nameNormalized, companyNormalized, ...row } =
            item.row;
          const keys = contactKeys(item.row);
          if (job.duplicateMode !== 'keep' && keys.some((k) => seen.has(k))) {
            results.push('duplicate');
            continue;
          }
          try {
            const id = job.id.slice(0, 16) + '_' + item.index;
            const l = await prepareLead(
              tx,
              { ...row, allowDuplicate: job.duplicateMode === 'keep' },
              { uid: null, id, now: now() },
            );
            l.record.createdByUid = m.uid;
            l.record.importId = job.id;
            l.importComments = item.comments;
            prepared.push(l);
            keys.forEach((k) => seen.add(k));
            results.push('imported');
          } catch (e) {
            if (e.code === 'DUPLICATE') results.push('duplicate');
            else throw e;
          }
        }
        const next = {
          ...job,
          offset: Math.min(job.total, job.offset + (chunk?.rows.length || 0)),
          imported:
            job.imported + results.filter((v) => v === 'imported').length,
          duplicates:
            job.duplicates + results.filter((v) => v === 'duplicate').length,
          status:
            job.offset + (chunk?.rows.length || 0) >= job.total
              ? 'Completed'
              : 'Importing',
        };
        const combinedKeys = new Map();
        for (const l of prepared)
          for (const key of contactKeys(l.record)) {
            if (!combinedKeys.has(key))
              combinedKeys.set(
                key,
                new Set((await tx.get(path('dedupeKeys', key)))?.leadIds || []),
              );
            combinedKeys.get(key).add(l.record.id);
          }
        for (const l of prepared) {
          l.write();
          if (l.importComments)
            appendImportedComments(
              tx,
              l.record,
              m,
              l.importComments,
              now(),
              job.id,
            );
          else
            await appendDiscussions(tx, l.record, m, now(), {
              imported: true,
              importId: job.id,
            });
        }
        for (const [id, ids] of combinedKeys)
          tx.set(path('dedupeKeys', id), { id, leadIds: [...ids] });
        tx.set(p, next);
        return next;
      },
      { idempotent: true },
    );
  });
  route('get', '/notifications', 'leads:read', (req) =>
    list(
      req,
      'notifications',
      [],
      `users/${req.member.uid}/notifications`,
    ).then(async (result) => {
      const visibility = await Promise.all(
        result.items.map((n) => notificationVisible(store, req.member, n)),
      );
      const items = result.items.filter((n, i) => visibility[i]);
      return { ...result, items };
    }),
  );
  route('patch', '/notifications/:id', 'leads:read', (req) =>
    mutate(req, 'leads:read', async (tx, m) => {
      const p = `users/${m.uid}/notifications/${req.params.id}`;
      const n = await tx.get(p);
      const input = parse(NotificationPatch, req.body);
      if (!n || !(await notificationVisible(tx, m, n)))
        throw new AppError(404, 'NOT_FOUND', 'Notification not found');
      tx.set(p, { ...n, readAt: input.read ? now() : null });
      return { ok: true };
    }),
  );
  route('get', '/devices', 'leads:read', (req) =>
    list(req, 'devices', [], `users/${req.member.uid}/devices`),
  );
  route('post', '/devices', 'leads:read', (req) => {
    const input = parse(DeviceInput, req.body);
    return mutate(req, 'leads:read', async (tx, m) => {
      const p = `users/${m.uid}/devices/${input.id}`;
      const old = await tx.get(p);
      const devices = await tx.query(`users/${m.uid}/devices`, { limit: 11 });
      if (!old && devices.length >= 10)
        throw new AppError(
          400,
          'DEVICE_LIMIT',
          'Revoke an old device before adding another (maximum 10).',
        );
      const d = {
        ...input,
        enabled: true,
        lastSeenAt: now(),
        createdAt: old?.createdAt || now(),
      };
      tx.set(p, d);
      return { id: d.id, label: d.label, enabled: true };
    });
  });
  route('delete', '/devices/:id', 'leads:read', (req) =>
    mutate(req, 'leads:read', async (tx, m) => {
      tx.delete(`users/${m.uid}/devices/${req.params.id}`);
      return { ok: true };
    }),
  );
  route('post', '/devices/:id/test', 'leads:read', async (req) => {
    const device = await store.get(
      `users/${req.member.uid}/devices/${req.params.id}`,
    );
    if (!device?.enabled)
      throw new AppError(404, 'NOT_FOUND', 'Device not found');
    await mutate(req, 'leads:read', async (tx) => {
      const p = path('pushTests', req.member.uid);
      const old = await tx.get(p);
      if (old && Date.parse(now()) - Date.parse(old.at) < 60000)
        throw new AppError(
          429,
          'RATE_LIMIT',
          'Wait a minute before sending another test',
        );
      tx.set(p, { at: now() });
      return { ok: true };
    });
    await sendTest(device);
    return { ok: true };
  });
  route('get', '/scoring-settings', 'leads:read', () => readScoring(store));
  route('patch', '/scoring-settings', 'members:write', (req) => {
    const input = parse(ScoringPatch, req.body);
    return mutate(req, 'members:write', async (tx, m) => {
      if (m.role !== 'Admin')
        throw new AppError(
          403,
          'ADMIN',
          'Only administrators can change scoring factors',
        );
      const current = await readScoring(tx);
      assertVersion(current, input.expectedVersion);
      const updated = {
        version: current.version + 1,
        enabled: input.enabled,
        factors: input.factors,
        updatedAt: now(),
        updatedByUid: m.uid,
      };
      tx.set(SCORING_PATH, updated);
      return updated;
    });
  });
  route('get', '/lead-scores', 'leads:read', async (req) => {
    const ids = parse(
      z
        .array(z.string().regex(/^[A-Za-z0-9_.:-]{1,120}$/))
        .min(1)
        .max(100),
      String(req.query.ids || '').split(','),
    );
    const unique = [...new Set(ids)],
      config = await readScoring(store);
    const leads = await Promise.all(
      unique.map((id) => leadAccess(store, req.member, id)),
    );
    const records = await Promise.all(
      unique.map((id) => store.get(path('leadScores', id))),
    );
    return {
      items: leads.map((lead, i) => {
        const v = scoreView(config, lead, records[i]);
        const { factors, ...summary } = v;
        return summary;
      }),
    };
  });
  route('get', '/leads/:id/score', 'leads:read', async (req) => {
    const lead = await leadAccess(store, req.member, req.params.id),
      config = await readScoring(store),
      record = await store.get(path('leadScores', lead.id));
    return scoreView(config, lead, record);
  });
  route('post', '/leads/:id/score/refresh', 'leads:edit', async (req) => {
    parse(z.object({}).strict(), req.body);
    await mutate(req, 'leads:edit', async (tx, m) => {
      await leadAccess(tx, m, req.params.id);
      return { ok: true };
    });
    if (!extractScore)
      throw new AppError(
        503,
        'AI_UNAVAILABLE',
        'Scoring is temporarily unavailable',
      );
    const result = await processLeadScore({
      store,
      leadId: req.params.id,
      extract: extractScore,
      now,
    });
    const current = await requireMember(store, req.identity, 'leads:read');
    await leadAccess(store, current, req.params.id);
    return result;
  });
  route('get', '/dashboard', 'leads:read', async (req) => {
    const { aiContext, ...snapshot } = await dashboardSnapshot(
      store,
      req.member,
      now(),
    );
    const { insightMode } = await readAISettings(store);
    return { ...snapshot, insightMode };
  });
  route('post', '/dashboard/insights', 'leads:read', async (req) => {
    parse(z.object({}).strict(), req.body);
    if (!summarizeDashboard) return { status: 'Unavailable' };
    const snapshot = await dashboardSnapshot(store, req.member, now());
    return dashboardBrief({
      store,
      member: req.member,
      snapshot,
      summarize: summarizeDashboard,
      now,
    });
  });
  route('get', '/summary', 'leads:read', async (req) => {
    const leadFilters = [
      ...scopeFilters(req.member),
      ['archived', '==', false],
    ];
    const taskFilters = [
      ['recipientUid', '==', req.member.uid],
      ['state', '==', 'Pending'],
    ];
    const since = new Date(Date.parse(now()) - 7 * 86400000).toISOString();
    const activityFilters = [
      ['actorUid', '==', req.member.uid],
      ['type', '==', 'call'],
      ['createdAt', '>=', since],
    ];
    const [total, newLeads, due, calls, connected] = await Promise.all([
      store.count(path('leads'), leadFilters),
      store.count(path('leads'), [...leadFilters, ['stage', '==', 'New']]),
      store.count(path('tasks'), [...taskFilters, ['dueAt', '<=', now()]]),
      store.count(path('activities'), activityFilters),
      store.count(path('activities'), [
        ...activityFilters,
        ['outcome', '==', 'Connected'],
      ]),
    ]);
    return { total, newLeads, due, calls, connected, period: 'Last 7 days' };
  });
  app.use('/api/v1', router);
  app.use((req, res) =>
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
        requestId: req.requestId,
      },
    }),
  );
  app.use((err, req, res, next) => {
    const parserError =
      err.type === 'entity.parse.failed'
        ? {
            status: 400,
            code: 'BAD_JSON',
            message: 'Request body must contain valid JSON.',
          }
        : err.type === 'entity.too.large'
          ? {
              status: 413,
              code: 'PAYLOAD_TOO_LARGE',
              message: 'Request body exceeds the allowed size.',
            }
          : null;
    const status = parserError?.status || err.status || 500;
    // Cleanup is an expected temporary lock, not an opaque server failure.
    // Use fixed public copy; never expose arbitrary provider error messages.
    const leadDataReset =
      err instanceof AppError && status === 503 && err.code === 'LEAD_DATA_RESET';
    if (status === 401)
      res.set('WWW-Authenticate', 'Bearer realm="SalesDrone"');
    if (status === 429 || leadDataReset) res.set('Retry-After', '60');
    if (status >= 500)
      console.error(
        JSON.stringify({
          requestId: req.requestId,
          code: err.code || 'INTERNAL',
          message: 'Request failed',
        }),
      );
    res.status(status).json({
      error: {
        code: parserError?.code || err.code || 'INTERNAL',
        message:
          parserError?.message ||
          (leadDataReset
            ? 'Lead data cleanup is still running. Wait for cleanup to finish in Settings, then retry this action.'
            : status >= 500 ? 'Something went wrong. Please retry.' : err.message),
        details: parserError ? undefined : err.details,
        requestId: req.requestId,
      },
    });
  });
  return app;
}
