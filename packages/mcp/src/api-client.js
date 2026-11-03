export const DEFAULT_API_URL = 'https://sales-drone-avinya.firebaseapp.com/api/v1';
export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const allowedPaths = [
  /^\/leads$/, /^\/archived-leads$/, /^\/leads\/[A-Za-z0-9_.:-]+(?:\/(?:journey|activities|tasks|attachments|score))?$/,
  /^\/(?:tasks|imports|notifications|lead-scores)(?:\/[A-Za-z0-9_.:-]+)?$/,
  /^\/imports\/[A-Za-z0-9_.:-]+\/errors$/,
  /^\/(?:summary|dashboard|field-options|workspace-settings|lead-assignees|team)$/,
  /^\/team\/members\/[A-Za-z0-9_.:-]+\/activities$/,
];
export class SalesDroneReadError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}
export function createApiClient({ token, apiUrl = DEFAULT_API_URL, fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  if (typeof token !== 'string' || !/^sd_pat_[a-f0-9]{32}_[A-Za-z0-9_-]{43}$/.test(token))
    throw new SalesDroneReadError('TOKEN_REQUIRED');
  const base = new URL(apiUrl);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if (base.username || base.password || base.search || base.hash || base.pathname.replace(/\/$/, '') !== '/api/v1' ||
      !(base.protocol === 'https:' || (base.protocol === 'http:' && local)))
    throw new SalesDroneReadError('INVALID_API_URL');
  let active = 0;
  return {
    async get(path, query = {}, signal) {
      if (!allowedPaths.some(pattern => pattern.test(path)) || path.split('/').some(p => p === '.' || p === '..'))
        throw new SalesDroneReadError('READ_PATH_DENIED');
      if (active >= 4) throw new SalesDroneReadError('BUSY');
      active++;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const url = new URL(base.origin + base.pathname.replace(/\/$/, '') + path);
        for (const [key, value] of Object.entries(query)) if (value !== undefined) url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
        const response = await fetchImpl(url, {
          method: 'GET', redirect: 'error', cache: 'no-store',
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json', 'User-Agent': 'salesdrone-mcp/1.0.0' },
          signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new SalesDroneReadError(response.status === 401 ? 'UNAUTHENTICATED' : response.status === 403 ? 'FORBIDDEN' : response.status === 429 ? 'RATE_LIMITED' : response.status === 404 ? 'NOT_FOUND' : 'API_ERROR', response.status);
        }
        if (!/^application\/json(?:;|$)/i.test(response.headers.get('content-type') || '')) {
          await response.body?.cancel(); throw new SalesDroneReadError('INVALID_RESPONSE');
        }
        const reader = response.body?.getReader();
        if (!reader) throw new SalesDroneReadError('INVALID_RESPONSE');
        const chunks = []; let bytes = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new SalesDroneReadError('RESPONSE_LIMIT'); }
          chunks.push(value);
        }
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch (error) {
        if (error instanceof SalesDroneReadError) throw error;
        throw new SalesDroneReadError(controller.signal.aborted || signal?.aborted ? 'CANCELLED_OR_TIMEOUT' : 'INVALID_RESPONSE');
      } finally { clearTimeout(timeout); active--; }
    },
  };
}
