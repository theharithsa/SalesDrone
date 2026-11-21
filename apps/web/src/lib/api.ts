import { RUM_OUTCOMES } from './rum-outcomes';
import { beginRumRequest } from './rum';
import app, { auth, attestation } from './firebase';
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export type ApiClient<T = unknown> = (
  path: string,
  method?: string,
  body?: unknown,
  key?: string,
  signal?: AbortSignal,
) => Promise<T>;

function readError(body: unknown) {
  if (!body || typeof body !== 'object' || !('error' in body)) return {};
  const error = body.error;
  if (!error || typeof error !== 'object') return {};
  return {
    code: 'code' in error && typeof error.code === 'string' ? error.code : undefined,
    message: 'message' in error && typeof error.message === 'string' ? error.message : undefined,
    details: 'details' in error ? error.details : undefined,
  };
}

export async function api<T = unknown>(
  path: string,
  method = 'GET',
  body?: unknown,
  key?: string,
  signal?: AbortSignal,
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new ApiError(401, 'SIGN_IN', 'Sign in to continue');
  const [token, check] = await Promise.all([user.getIdToken(), attestation()]);
  const endObservation = beginRumRequest(path, method);
  let res: Response;
  try {
    res = await fetch('/api/v1' + path, {
      method,
      headers: {
        Authorization: 'Bearer ' + token,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(key ? { 'Idempotency-Key': key } : {}),
        ...(check ? { 'X-Firebase-AppCheck': check } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal,
    });
  } catch (e) {
    endObservation(e instanceof DOMException&&e.name==='AbortError'?RUM_OUTCOMES.cancelled:RUM_OUTCOMES.network);
    throw e;
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    endObservation(RUM_OUTCOMES.failure,res.headers.get('X-Request-Id')||undefined,res.status,'API_UNAVAILABLE');
    throw new ApiError(
      res.status,
      'API_UNAVAILABLE',
      'The API is unavailable. Check your connection or Firebase setup.',
    );
  }
  const error = readError(data);
  endObservation(
    res.ok ? RUM_OUTCOMES.success : RUM_OUTCOMES.failure,
    res.headers.get('X-Request-Id') || undefined,
    res.status,
    error.code,
  );
  if (!res.ok) {
    throw new ApiError(
      res.status,
      error.code || 'REQUEST',
      error.message || 'Request failed',
      error.details,
    );
  }
  return data as T;
}
export async function enablePush(label: string) {
  if (!('Notification' in window) || !('serviceWorker' in navigator))
    throw Error(
      'This browser does not support push. Use the in-app reminder list.',
    );
  if (!import.meta.env.VITE_FIREBASE_VAPID_KEY)
    throw Error(
      'Web push is not configured yet. Add the Firebase public VAPID key during setup.',
    );
  const permission = await Notification.requestPermission();
  if (permission !== 'granted')
    throw Error(
      'Notifications are blocked. Enable them in browser or device settings.',
    );
  const { getMessaging, getToken, isSupported } = await import(
    'firebase/messaging'
  );
  if (!(await isSupported()))
    throw Error(
      'Push is unavailable. On iPhone or iPad, add SalesDrone to your Home Screen first.',
    );
  const sw = await navigator.serviceWorker.register(
    '/firebase-messaging-sw.js',
  );
  await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: sw,
  });
  const id = localStorage.getItem('salesdrone.device') || crypto.randomUUID();
  localStorage.setItem('salesdrone.device', id);
  await api('/devices', 'POST', { id, token, label });
  return id;
}
export async function revokeThisDevice() {
  const id = localStorage.getItem('salesdrone.device');
  if (id) {
    await api('/devices/' + id, 'DELETE');
    const { getMessaging, deleteToken, isSupported } = await import(
      'firebase/messaging'
    );
    if (await isSupported()) await deleteToken(getMessaging(app));
    localStorage.removeItem('salesdrone.device');
  }
}

export async function uploadFileBytes<T = unknown>(
  path: string,
  file: File,
  onProgress: (value: number) => void,
  signal: AbortSignal,
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new ApiError(401, 'SIGN_IN', 'Sign in to continue');
  const [token, check] = await Promise.all([user.getIdToken(), attestation()]);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const end = beginRumRequest(path, 'PUT');
    const abort = () => xhr.abort();
    signal.addEventListener('abort', abort, { once: true });
    const finish = () => signal.removeEventListener('abort', abort);
    xhr.open('PUT', '/api/v1' + path);
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    if (check) xhr.setRequestHeader('X-Firebase-AppCheck', check);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      finish();
      let data: unknown;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        end(RUM_OUTCOMES.failure,xhr.getResponseHeader('X-Request-Id')||undefined,xhr.status,'API_UNAVAILABLE');
        reject(new ApiError(xhr.status, 'API_UNAVAILABLE', 'The file API is unavailable.'));
        return;
      }
      const error = readError(data);
      const ok = xhr.status >= 200 && xhr.status < 300;
      end(
        ok ? RUM_OUTCOMES.success : RUM_OUTCOMES.failure,
        xhr.getResponseHeader('X-Request-Id') || undefined,
        xhr.status,
        error.code,
      );
      if (ok) resolve(data as T);
      else reject(new ApiError(xhr.status, error.code || 'UPLOAD', error.message || 'Upload failed'));
    };
    xhr.onerror = () => {
      finish();
      end(RUM_OUTCOMES.network);
      reject(Error('Upload interrupted. Retry the same file.'));
    };
    xhr.onabort = () => {
      finish();
      end(RUM_OUTCOMES.cancelled);
      reject(new DOMException('Upload cancelled', 'AbortError'));
    };
    if (signal.aborted) {
      finish();
      end(RUM_OUTCOMES.cancelled);
      reject(new DOMException('Upload cancelled', 'AbortError'));
    } else xhr.send(file);
  });
}
export async function downloadFileBytes(path: string): Promise<Blob> {
  const user = auth.currentUser;
  if (!user) throw Error('Sign in to continue');
  const [token, check] = await Promise.all([user.getIdToken(), attestation()]);
  const end = beginRumRequest(path, 'GET');
  let response: Response;
  try {
    response = await fetch('/api/v1' + path, {
      headers: {
        Authorization: 'Bearer ' + token,
        ...(check ? { 'X-Firebase-AppCheck': check } : {}),
      },
      cache: 'no-store',
    });
  } catch (e) {
    end(RUM_OUTCOMES.network);
    throw e;
  }
  if (!response.ok) {
    const error = readError(await response.json().catch(() => null));
    end(RUM_OUTCOMES.failure, response.headers.get('X-Request-Id') || undefined, response.status, error.code);
    throw new ApiError(response.status, error.code || 'DOWNLOAD', error.message || 'Download failed');
  }
  try {const blob=await response.blob();end(RUM_OUTCOMES.success,response.headers.get('X-Request-Id')||undefined,response.status);return blob;}
  catch(error){end(RUM_OUTCOMES.network,response.headers.get('X-Request-Id')||undefined,response.status);throw error;}
}
