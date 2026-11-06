import { rumOutcome, httpStatusClass } from './rum-outcomes';
import { APPLICATION_ERRORS } from '../../../../functions/src/observability-contract.js';
import { createAnonymousId, finishAction } from './rum-runtime';
import { createRumIdentity } from './rum-identity';
import { APP_VERSION } from './version';
type Rum = {
  reportCustomError?: (key:string,value:string,hint?:string,parentingInfo?:number|boolean)=>void;
  reportError?: (error:{message:string})=>void;
  disableSessionReplay?: () => void;
  setAutomaticActionDetection?: (enabled: boolean) => void;
  enableManualPageDetection?: () => void;
  setPage?: (p: { name: string; group: string }) => number;
  identifyUser?: (id: string) => void;
  endSession?: () => void;
  enterAction?: (name: string) => number;
  leaveAction?: (id: number) => void;
  addActionProperties?: (
    id: number,
    longs?: unknown,
    dates?: unknown,
    strings?: Record<string, string>,
  ) => void;
};
const rum = () => (window as Window & { dtrum?: Rum }).dtrum;
let lastPage = '';
export const safePage = (path: string) => {
  const p = path.split('?')[0].split('/').filter(Boolean)[0] || 'login';
  return [
    'hygiene',
    'assistant',
    'today',
    'leads',
    'tasks',
    'notifications',
    'imports',
    'members',
    'settings',
    'login',
  ].includes(p)
    ? p
    : 'workspace';
};
export const safeOperation = (path: string, method: string) => {
  const p = path.split('?')[0];
  if (p === '/leads/batch' || p === '/leads/batch/preview')
    return `${method === 'POST' ? 'POST' : 'OTHER'} ${p}`;
  const kind = p.split('/').filter(Boolean)[0];
  const root = [
    'me',
    'leads',
    'tasks',
    'notifications',
    'imports',
    'members',
    'invitations',
    'devices',
    'dashboard',
    'lead-scores',
    'scoring-settings',
    'field-options',
    'workspace-settings',
    'ai-settings',
    'lead-research-settings',
    'lead-hygiene',
    'lead-assistant',
    'activities',
    'summary',
  ].includes(kind)
    ? kind
    : 'other';
  const tail = p
    .split('/')
    .filter(Boolean)
    .slice(2)
    .map((v) =>
      [
        'scans',
        'findings',
        'conversations',
        'requests',
        'questions',
        'messages',
        'index',
        'attachments',
        'content',
        'activities',
        'corrections',
        'automatic-reminder',
        'assignment',
        'archive',
        'journey',
        'score',
        'refresh',
        'commit',
        'rows',
        'report',
        'plan',
        'review',
        'errors',
        'accept',
        'test',
        'insights',
        'preview',
      ].includes(v)
        ? v
        : ':id',
    );
  return `${['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ? method : 'OTHER'} /${root}${p.split('/').filter(Boolean).length > 1 ? '/:id' : ''}${tail.length ? '/' + tail.join('/') : ''}`;
};
const anonymousId = createAnonymousId({
  read: () => localStorage.getItem('salesdrone.rum.browser'),
  write: (id) => localStorage.setItem('salesdrone.rum.browser', id),
  random: () => crypto.randomUUID(),
});
export const setRumIdentity = createRumIdentity({
  agent: rum,
  anonymous: anonymousId,
  hash: async (uid) =>
    'user:' +
    Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode('salesdrone:' + uid),
        ),
      ),
    )
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 32),
  onReady: (mode) => {
    document.documentElement.dataset.salesdroneRumIdentity = mode;
    lastPage = '';
    rumPage(location.pathname);
  },
  listen: (apply) => {
    window.addEventListener('salesdrone:rum-ready', apply);
    return () => window.removeEventListener('salesdrone:rum-ready', apply);
  },
  schedule: (apply) => setTimeout(apply, 500),
  clear: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
});
export function rumPage(path: string) {
  const name = safePage(path),
    r = rum();
  if (!r || name === lastPage) return;
  try {
    r.setPage?.({ name, group: 'salesdrone' });
    const action=r.enterAction?.('View '+name);
    finishAction(r,action)({'app_version':APP_VERSION,'interaction_intent':'View '+name});
    lastPage = name;
  } catch {}
}
export function safeIntent(path:string,method:string){
  if(method==='GET')return 'Read workspace';
  const root=path.split('/').filter(Boolean)[0];
  if(root==='imports'&&path.endsWith('/commit'))return 'Commit import';
  if(root==='lead-assistant')return 'Ask Lead Assistant';
  if(root==='lead-hygiene')return 'Review lead hygiene';
  if(['field-options','workspace-settings','ai-settings','scoring-settings','lead-research-settings','me'].includes(root))return 'Save settings';
  if(root==='leads')return method==='POST'?(path.split('?')[0]==='/leads'?'Create lead':path.includes('/activities')?'Add lead activity':'Update lead'):'Update lead';
  if(root==='tasks')return method==='POST'?'Create task':'Update task';
  return 'Update workspace';
}
export function beginRumRequest(path: string, method: string) {
  const r = rum();
  let id: number | undefined;
  try {
    id = r?.enterAction?.(method==='GET'?'API '+safeOperation(path,method):safeIntent(path,method));
  } catch {}
  const finish = finishAction(r, id);
  let done=false;
  return (outcome: string, requestId?: string, status?:number, code?:string) => {
    if(done)return;done=true;
    const safeCode=code&&(APPLICATION_ERRORS.has(code)||['API_UNAVAILABLE','NETWORK'].includes(code))?code:code?'INTERNAL':rumOutcome(outcome)==='network_error'?'NETWORK':'none';
    if(rumOutcome(outcome)==='network_error'||rumOutcome(outcome)==='failure'&&(!status||status>=500||[401,403,429].includes(status)||safeCode==='API_UNAVAILABLE')) reportRumFailure(safeCode==='none'?'NETWORK':safeCode, requestId, id);
    finish({
      'app_version': APP_VERSION,
      'operation_outcome':rumOutcome(outcome),
      'interaction_intent':safeIntent(path,method),
      'http_status_class':httpStatusClass(status),
      'error_code':safeCode,
      ...(requestId && /^[a-f0-9-]{36}$/i.test(requestId)
        ? { 'request_id': requestId }
        : {}),
    });
  };
}

export function reportRumFailure(code: string, requestId?:string, actionId?:number) {
  const safe=['NETWORK','RENDER','UNHANDLED','API_UNAVAILABLE'].includes(code)||APPLICATION_ERRORS.has(code)?code:'INTERNAL';
  const hint=requestId&&/^[a-f0-9-]{36}$/i.test(requestId)?requestId:undefined;
  try {rum()?.reportCustomError?.('salesdrone.error',safe,hint,actionId??false);} catch { /* Monitoring never blocks the UI. */ }
}
export function installRumErrorHandlers() {
  const error=()=>reportRumFailure('UNHANDLED');
  window.addEventListener('error',error);
  window.addEventListener('unhandledrejection',error);
  return ()=>{window.removeEventListener('error',error);window.removeEventListener('unhandledrejection',error);};
}
