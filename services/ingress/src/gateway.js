import { HEALTH_PATH } from './contract.js';
import http from 'node:http';
import https from 'node:https';
import { randomUUID } from 'node:crypto';
import { gunzipSync, inflateSync, brotliDecompressSync } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

export const JSON_LIMIT = 12 * 1024 * 1024;
export const BINARY_LIMIT = 8 * 1024 * 1024;
const WIRE_LIMIT=32 * 1024 * 1024;
const forwarding = ['authorization', 'x-firebase-appcheck', 'idempotency-key', 'content-type', 'content-encoding', 'accept', 'if-none-match'];
const hop = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);
const failure = (status, code) => Object.assign(new Error(code), { status, code });
const messages = { BAD_JSON: 'Invalid JSON body', PAYLOAD_TOO_LARGE: 'Request body is too large', UNSUPPORTED_ENCODING: 'Unsupported content encoding', NOT_FOUND: 'Route not found', UPSTREAM_UNAVAILABLE: 'API temporarily unavailable', REQUEST_TIMEOUT: 'Request timed out' };

export function createGateway({ upstream, version, commit, telemetry, timeoutMs = 55000, allowLocalTest = false, log = console.log }) {
  const target = new URL(upstream);
  if (target.username || target.password || target.search || target.hash || target.pathname !== '/' || (target.protocol !== 'https:' && !(allowLocalTest && target.protocol === 'http:' && target.hostname === '127.0.0.1'))) throw Error('A fixed HTTPS upstream origin is required');
  const transport = target.protocol === 'https:' ? https : http;
  let flushing=false,flushAgain=false;
  const requestFlush=()=>{
    if(!telemetry)return;
    flushAgain=true;
    if(flushing)return;
    flushing=true;
    void (async()=>{try{while(flushAgain){flushAgain=false;await telemetry.flush();}}catch{}finally{flushing=false;}})();
  };
  return http.createServer({ requestTimeout: timeoutMs, headersTimeout: Math.min(timeoutMs, 20000), maxHeaderSize: 16384 }, (req, res) => {
    req.requestId = randomUUID();
    req.route = { path: req.url===HEALTH_PATH ? HEALTH_PATH : '/api/*' };
    res.setHeader('X-Request-Id', req.requestId);
    res.setHeader('X-App-Version', version);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    let traceparent,operationSettled=false;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      if (!res.headersSent) {
        req.ingressError='REQUEST_TIMEOUT';
        res.writeHead(504, {'Content-Type':'application/json','Connection':'close'});
        res.end(JSON.stringify({error:{code:'REQUEST_TIMEOUT',message:messages.REQUEST_TIMEOUT,requestId:req.requestId}}));
      }
    }, timeoutMs);
    req.on('aborted', () => controller.abort());
    res.on('close', () => { if (!res.writableFinished) controller.abort(); });
    res.once('finish', () => {
      log(JSON.stringify({ event: 'ingress.request.completed', requestId: req.requestId, status: res.statusCode, version, commit, ...(traceparent ? {trace_id:traceparent.split('-')[1],span_id:traceparent.split('-')[2]} : {}) }));
      queueMicrotask(()=>{if(operationSettled)requestFlush();});
    });
    const run = async () => {
      traceparent=telemetry?.capture()?.traceparent;
      try {
        if (req.url === HEALTH_PATH && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ version, commit }));
          return;
        }
        // Concatenate only a validated origin-relative path. Never resolve // URLs.
        if (!req.url?.startsWith('/api/') || /[\r\n\\]/.test(req.url) || req.url.includes('#')) throw failure(404, 'NOT_FOUND');
        const json = /^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/i.test(req.headers['content-type'] || '');
        const limit = json ? JSON_LIMIT : BINARY_LIMIT;
        const length = req.headers['content-length'];
        const declaredOversize=length && Number(length)>limit;
        const chunks = []; let size = 0,tooLarge=false;
        // Do not destroy the incoming socket before the safe error can be returned.
        for await (const chunk of req.iterator({ destroyOnReturn: false })) {
          size += chunk.length;
          if (size > WIRE_LIMIT) throw failure(413, 'PAYLOAD_TOO_LARGE');
          // Drain supported wire sizes without buffering an oversized payload.
          // Closing while the client is still uploading can obscure the 413.
          if(declaredOversize || size>limit){tooLarge=true;chunks.length=0;continue;}
          if (controller.signal.aborted) throw failure(504, 'REQUEST_TIMEOUT');
          chunks.push(chunk);
        }
        if(tooLarge)throw failure(413,'PAYLOAD_TOO_LARGE');
        const body = Buffer.concat(chunks);
        if (json && body.length) {
          let decoded = body;
          const encoding = (req.headers['content-encoding'] || 'identity').toLowerCase();
          const decoder = { gzip: gunzipSync, deflate: inflateSync, br: brotliDecompressSync }[encoding];
          if (encoding !== 'identity' && !decoder) throw failure(415, 'UNSUPPORTED_ENCODING');
          try { if (decoder) decoded = decoder(body, { maxOutputLength: limit }); }
          catch (error) { throw failure(error.code === 'ERR_BUFFER_TOO_LARGE' ? 413 : 400, error.code === 'ERR_BUFFER_TOO_LARGE' ? 'PAYLOAD_TOO_LARGE' : 'BAD_JSON'); }
          try {
            const text = new TextDecoder('utf-8', { fatal: true }).decode(decoded);
            if (!/^[\s]*[[{]/.test(text)) throw Error('Strict JSON');
            JSON.parse(text);
          } catch { throw failure(400, 'BAD_JSON'); }
        }
        const forward = (span) => new Promise((resolve, reject) => {
          const headers = Object.fromEntries(forwarding.filter(k => req.headers[k] !== undefined).map(k => [k, req.headers[k]]));
          headers['content-length'] = String(body.length);
          const parent = telemetry?.capture()?.traceparent;
          if (parent) headers.traceparent = parent;
          const request = transport.request(target.origin + req.url, { method: req.method, headers, signal: controller.signal }, async response => {
            const connectionFields = String(response.headers.connection || '').toLowerCase().split(',').map(x => x.trim());
            for (const [key, value] of Object.entries(response.headers)) if (!hop.has(key) && !connectionFields.includes(key) && value !== undefined) res.setHeader(key, value);
            res.statusCode = response.statusCode || 502;
            span?.setAttribute('http.response.status_code',res.statusCode);
            try { await pipeline(response, res); resolve(); } catch (error) { reject(error); }
          });
          request.on('error', reject);
          request.end(body);
        });
        if (telemetry) await telemetry.span('api.forward', forward, { operation: 'api.forward', 'server.address':target.hostname, 'http.request.method':['GET','POST','PUT','PATCH','DELETE'].includes(req.method)?req.method:'OTHER' });
        else await forward();
      } catch (error) {
        if (res.writableEnded) return;
        if (res.headersSent) { res.destroy(); return; }
        const code = controller.signal.aborted ? 'REQUEST_TIMEOUT' : (messages[error.code] ? error.code : 'UPSTREAM_UNAVAILABLE');
        req.ingressError=code;
        res.statusCode = controller.signal.aborted ? 504 : (error.status || 502);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Connection', 'close');
        res.end(JSON.stringify({ error: { code, message: messages[code], requestId: req.requestId } }));
        req.resume();
      } finally { clearTimeout(timer);operationSettled=true;if(res.writableFinished)queueMicrotask(requestFlush); }
    };
    if (telemetry) telemetry.http(req, res, run);
    else void run();
  });
}
