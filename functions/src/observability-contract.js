// Finite application/vendor codes. Never use arbitrary exception messages as telemetry.
export const APPLICATION_ERRORS = new Set([
  "ACTIVITY_AUTHOR",
  "ADMIN",
  "ADMIN_BOUND",
  "ADMIN_REQUIRED",
  "AGENT_CLARIFY",
  "AI_EVIDENCE",
  "AI_GROUNDING",
  "AI_RATE_LIMIT",
  "AI_SETTINGS_CHANGED",
  "AI_UNAVAILABLE",
  "ANALYSIS_STATE",
  "APP_CHECK",
  "ARCHIVED",
  "ASSIGNEE",
  "AUTH_UNAVAILABLE",
  "BAD_JSON",
  "BATCH_SIZE",
  "BOOTSTRAP_ADMIN",
  "CAPABILITY",
  "CELL",
  "COLUMNS",
  "COMMENT_COLUMN",
  "COMMENT_LIMIT",
  "CONFIGURATION",
  "CONTACT",
  "CONTEXT_LIMIT",
  "CURSOR",
  "CUSTOM_FIELD",
  "CUSTOM_FIELD_REQUIRED",
  "DASHBOARD_FIELD",
  "DATE",
  "DEMO_ONLY",
  "DEPENDENCY_ABORTED",
  "DEPENDENCY_RESPONSE_INVALID",
  "DEPENDENCY_TIMEOUT",
  "DEPENDENCY_UNAVAILABLE",
  "DEVICE_LIMIT",
  "DUPLICATE",
  "EXPIRED",
  "EXPORT_COLUMN",
  "EXPORT_DISABLED",
  "FIELD_DEFINITION",
  "FIELD_LABEL",
  "FIELD_OPTION",
  "FIELD_LAYOUT",
  "FILE_CONFLICT",
  "FILE_LIMIT",
  "FILE_SIZE",
  "FILE_TYPE",
  "FILTER",
  "FORBIDDEN",
  "GEMINI_CONFIG",
  "GEMINI_RATE_LIMIT",
  "GEMINI_UNAVAILABLE",
  "GOOGLE_REQUIRED",
  "IDEMPOTENCY",
  "IDEMPOTENCY_CONFLICT",
  "IMPORT_MODE",
  "IMPORT_ROW",
  "INTERNAL",
  "INVALID_QUERY",
  "INVALID_TOKEN",
  "INVITATION",
  "LEAD_DATA_RESET",
  "LEAD_COMMENT_LIMIT",
  "LIMIT",
  "MAPPING",
  "NOTE",
  "NOT_FOUND",
  "OUTCOME",
  "OWNER",
  "PATH",
  "PAYLOAD_TOO_LARGE",
  "PHONE",
  "PHONE_REQUIRED",
  "PROVIDER_UNAVAILABLE",
  "RATE_LIMIT",
  "REASON",
  "REPORT_NOT_READY",
  "REQUEST_FINISHED",
  "REQUEST_PENDING",
  "REQUIRED",
  "RESET_ACTIVE",
  "RESET_PREVIEW_EXPIRED",
  "RESET_REQUEST_EXPIRED",
  "RESET_STATE",
  "RESULTS_UNAVAILABLE",
  "RESULT_PART",
  "RETRY_LIMIT",
  "REVIEW",
  "ROW_SIZE",
  "SCAN_PENDING",
  "SCHEMA_INVALID",
  "SCOPE",
  "SCOPE_CHANGED",
  "SETUP_REQUIRED",
  "STAGE",
  "STALE_ACCESS",
  "STALE_SOURCE",
  "STALE_VERSION",
  "STATUS",
  "STATUS_COLUMN",
  "STATUS_FIELD",
  "STATUS_MAP",
  "STORAGE_UNAVAILABLE",
  "SUPPRESSED",
  "TASKS",
  "TASK_CHANGED",
  "TASK_COMMENT",
  "TASK_CONTEXT",
  "TASK_DUE",
  "TASK_STATE",
  "TASK_FINISHED",
  "TASK_LIMIT",
  "TASK_OWNER",
  "TASK_VIEW",
  "TEAM_LIMIT",
  "TEAM_PERIOD",
  "TEAM_STALE",
  "TIMEZONE",
  "TOKEN_LIMIT",
  "TOKEN_ONE_TIME",
  "TOKEN_RATE_LIMIT",
  "TOKEN_SCOPE",
  "TYPE",
  "UNAUTHENTICATED",
  "UPLOAD_EXPIRED",
  "UPLOAD_PENDING",
  "VALIDATION",
  "WORKSPACE_BUSY"
]);
const grpc = ['OK','CANCELLED','UNKNOWN','INVALID_ARGUMENT','DEADLINE_EXCEEDED','NOT_FOUND','ALREADY_EXISTS','PERMISSION_DENIED','RESOURCE_EXHAUSTED','FAILED_PRECONDITION','ABORTED','OUT_OF_RANGE','UNIMPLEMENTED','INTERNAL','UNAVAILABLE','DATA_LOSS','UNAUTHENTICATED'];
const firebase = {
  'messaging/registration-token-not-registered':'FCM_TOKEN_NOT_REGISTERED',
  'messaging/invalid-registration-token':'FCM_TOKEN_INVALID',
  'messaging/invalid-argument':'FCM_INVALID_ARGUMENT',
  'messaging/server-unavailable':'FCM_UNAVAILABLE',
  'messaging/internal-error':'FCM_INTERNAL',
  'messaging/quota-exceeded':'FCM_QUOTA',
  'auth/user-not-found':'AUTH_USER_NOT_FOUND',
  'auth/id-token-expired':'AUTH_TOKEN_EXPIRED',
  'auth/id-token-revoked':'AUTH_TOKEN_REVOKED',
  'auth/user-disabled':'AUTH_USER_DISABLED',
  'auth/invalid-id-token':'AUTH_TOKEN_INVALID',
};
export function errorType(error) {
  if (error?.name === 'TimeoutError') return 'DEPENDENCY_TIMEOUT';
  if (error?.name === 'AbortError') return 'DEPENDENCY_ABORTED';
  if (error?.name === 'ZodError') return 'SCHEMA_INVALID';
  if (error instanceof SyntaxError) return 'DEPENDENCY_RESPONSE_INVALID';
  if (firebase[error?.code]) return firebase[error.code];
  if (Number.isInteger(error?.code) && error.code > 0 && error.code < grpc.length) return 'GRPC_' + grpc[error.code];
  if (APPLICATION_ERRORS.has(error?.code)) return error.code;
  if (['ECONNRESET','ECONNREFUSED','ENOTFOUND','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT'].includes(error?.cause?.code || error?.code)) return 'DEPENDENCY_UNAVAILABLE';
  return 'INTERNAL';
}
// Dependency wrappers retain public API codes while spans use the finite root cause.
export function dependencyErrorType(error) {
  let root=error;
  for(let i=0;i<4&&root?.cause&&typeof root.cause==='object'&&root.cause!==root;i++)root=root.cause;
  return errorType(root);
}
export const policyRejection=error=>Number.isInteger(error?.status)&&error.status>=400&&error.status<500&&APPLICATION_ERRORS.has(error.code);
export const ERROR_TYPES = new Set([...APPLICATION_ERRORS, ...grpc.map(x=>'GRPC_'+x), ...Object.values(firebase)]);
export const WORK_STATS = ['examined','claimed','processed','ready','sent','failed','cancelled','skipped','created','indexed','delivered','retried','rejected','removed','blocked','scheduled','review','stale','completed','unchanged','noAction'];
export const COLLECTIONS = new Set(['leads','leadScores','leadTransitions','leadAttachments','activities','activityRevisions','tasks','members','personalAccessTokens','invitations','imports','importRows','importChunks','requests','auditEvents','settings','notifications','devices','reminderDeliveries','deviceDeliveries','noteAnalyses','leadDataResets','hygieneScans','assistantRequests','assistantConversations','assistantResults','researchIndex','researchWork','aiBudgets','rateLimits','pushTests','telemetryOutbox','other','multiple']);
export function collectionName(path) {
  const parts=String(path||'').split('/');
  const value=parts[parts.length-(parts.length%2 ? 1 : 2)];
  return COLLECTIONS.has(value) ? value : 'other';
}
export const OPERATIONS = new Set(['get','getAll','query','count','scan','nearest','transaction']);
export const WORKERS = new Set(['reminders','note-analysis','lead-intelligence','telemetry','validation','release.verification','bizevent-verification','settings-audit-verification','ci.report','other']);
export const STAGES = new Set(['received','authenticated','authorized','validated','executing','replayed','committed','responded','rejected','claimed','processing','retried','cancelled','completed','failed','indexed','retrieval','provider','response_validation','cleanup']);
export const LOG_EVENTS = new Set(['http.received','http.completed','http.failed','http.rejected','operation.stage','operation.failed','domain.transaction.committed','dependency.failed','worker.completed','worker.failed','worker.stage','worker.health.failed','audit.delivered','settings.audit.delivered','telemetry.delivery','telemetry.health.failed','ci.result','release.instrumentation','instrumentation.validation']);
export const LOG_KEYS = new Set(['audit.id','audit.action','settings.section','settings.changed_count','operation','operation.stage','outcome','error.type','http.status_code','request.id','transaction.id','operation.id','actor.id','event.id','event.type','event.occurred_at','record.domain','entity.ref','origin.trace_id','origin.span_id','origin.transaction.id','origin.operation','origin.actor.id','origin.request.id','worker','duration.ms','ci.check','ci.case.id','ci.run.id','dependency.name','db.collection.name','db.operation.name','db.query.result_count','db.transaction.attempts','field.count','changed.fields','reset','disabled','busy','request.has_body','request.size','correlation.has_parent',...WORK_STATS]);
export function safeLogFields(fields) {
  const result={}; let dropped=0;
  for (const [key,value] of Object.entries(fields)) {
    if (!LOG_KEYS.has(key)) { dropped++; continue; }
    if (key==='error.type') { result[key]=ERROR_TYPES.has(value)?value:'INTERNAL'; continue; }
    if (key==='operation.stage' && !STAGES.has(value)) { dropped++; continue; }
    if (typeof value==='boolean'||(typeof value==='number'&&Number.isFinite(value))) result[key]=value;
    else if(typeof value==='string'&&value.length<=180&&!/[\r\n]/.test(value)&&!value.includes(String.fromCharCode(0))) result[key]=value;
    else if(key==='changed.fields'&&Array.isArray(value)&&value.length<=40&&value.every(x=>typeof x==='string'&&/^[a-zA-Z0-9_.:-]{1,80}$/.test(x))) result[key]=value;
    else dropped++;
  }
  return {fields:result,dropped};
}
