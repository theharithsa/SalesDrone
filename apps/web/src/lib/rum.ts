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
let identityEpoch = 0,
  currentIdentity = '',
  lastPage = '';
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
  return `${['GET', 'POST', 'PATCH', 'DELETE'].includes(method) ? method : 'OTHER'} /${root}${p.split('/').filter(Boolean).length > 1 ? '/:id' : ''}${tail.length ? '/' + tail.join('/') : ''}`;
};
function anonymousId() {
  try {
    let id = localStorage.getItem('salesdrone.rum.browser');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('salesdrone.rum.browser', id);
    }
    return 'browser:' + id;
  } catch {
    return 'browser:session';
  }
}
export function setRumIdentity(uid: string | null) {
  const epoch = ++identityEpoch;
  let cancelled = false,
    timer: ReturnType<typeof setTimeout> | undefined,
    attempt = 0;
  const ready = async () => {
    const value = uid
      ? 'user:' +
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
          .slice(0, 32)
      : anonymousId();
    if (cancelled || epoch !== identityEpoch) return;
    const apply = () => {
      if (cancelled || epoch !== identityEpoch) return;
      const r = rum();
      if (!r) {
        if (++attempt < 16) timer = setTimeout(apply, 500);
        return;
      }
      try {
        r.disableSessionReplay?.();
        r.setAutomaticActionDetection?.(false);
        r.enableManualPageDetection?.();
        if (currentIdentity && currentIdentity !== value) r.endSession?.();
        r.identifyUser?.(value);
        currentIdentity = value;
        rumPage(location.pathname);
      } catch {}
    };
    apply();
  };
  void ready().catch(() => {});
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
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
  return (outcome: string, requestId?: string) => {
    if (id === undefined) return;
    try {
      r?.addActionProperties?.(id, undefined, undefined, {
        'app.version': APP_VERSION,
        'operation.outcome': outcome,
        ...(requestId && /^[a-f0-9-]{36}$/i.test(requestId)
          ? { 'request.id': requestId }
          : {}),
      });
      r?.leaveAction?.(id);
    } catch {}
  };
}
