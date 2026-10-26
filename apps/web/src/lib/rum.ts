import { createAnonymousId, finishAction } from './rum-runtime';
import { createRumIdentity } from './rum-identity';
import { APP_VERSION } from './version';
type Rum = {
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
    lastPage = name;
  } catch {}
}
export function beginRumRequest(path: string, method: string) {
  const r = rum();
  let id: number | undefined;
  try {
    id = r?.enterAction?.('API ' + safeOperation(path, method));
  } catch {}
  const finish = finishAction(r, id);
  return (outcome: string, requestId?: string) =>
    finish({
      'app.version': APP_VERSION,
      'operation.outcome': [
        'success',
        'failure',
        'cancelled',
        'error',
      ].includes(outcome)
        ? outcome
        : 'other',
      ...(requestId && /^[a-f0-9-]{36}$/i.test(requestId)
        ? { 'request.id': requestId }
        : {}),
    });
}
