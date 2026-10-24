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
export async function api<T = any>(
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
    endObservation('network_error');
    throw e;
  }
  endObservation(
    res.ok ? 'response_ok' : 'response_error',
    res.headers.get('X-Request-Id') || undefined,
  );
  let data;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(
      res.status,
      'API_UNAVAILABLE',
      'The API is unavailable. Check your connection or Firebase setup.',
    );
  }
  if (!res.ok)
    throw new ApiError(
      res.status,
      data.error?.code || 'REQUEST',
      data.error?.message || 'Request failed',
      data.error?.details,
    );
  return data;
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
