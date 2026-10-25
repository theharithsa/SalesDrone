import { createServer } from 'node:http';
import { once } from 'node:events';
import { createTelemetry } from '../functions/src/telemetry.js';
import { otlpReceipt } from './deployment-signals.mjs';
export async function probeSignals(tenant, token, fetchImpl = fetch) {
  const batches = [],
    server = createServer(async (req, res) => {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      batches.push({ path: req.url, body: Buffer.concat(chunks) });
      res.writeHead(200, { 'Content-Type': 'application/x-protobuf' });
      res.end();
    });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const telemetry = createTelemetry({
    tenant: 'http://127.0.0.1:' + server.address().port,
    key: 'synthetic-not-a-credential',
    service: 'salesdrone-deployment-check',
    environment: 'production-verification',
    allowLocalTest: true,
  });
  try {
    await telemetry.worker('release.verification', async () => {
      telemetry.log('release.instrumentation', { outcome: 'success' });
      return { processed: 0 };
    });
    await telemetry.flush();
  } finally {
    await telemetry.shutdown();
    server.close();
    await once(server, 'close');
  }
  const receipts = [];
  for (const signal of ['traces', 'logs', 'metrics'])
    for (const batch of batches.filter((b) => b.path.endsWith('/' + signal))) {
      try {
        const r = await fetchImpl(tenant + batch.path, {
          method: 'POST',
          redirect: 'error',
          headers: {
            Authorization: 'Api-Token ' + token,
            'Content-Type': 'application/x-protobuf',
          },
          body: batch.body,
          signal: AbortSignal.timeout(15000),
        });
        receipts.push(
          otlpReceipt(signal, r.status, new Uint8Array(await r.arrayBuffer())),
        );
      } catch {
        receipts.push({ signal, status: 0, rejected: -1, error: true });
      }
    }
  return receipts;
}
