/** Export diagnostics never contain exporter messages, URLs or credentials. */
export function monitorExporter(exporter, signal, health, report = () => {}) {
  const original = exporter.export.bind(exporter);
  exporter.export = (batch, callback) => {
    let finished = false;
    const done = (result) => {
      if (finished) return;
      finished = true;
      const outcome = result?.code === 0 ? 'success' : 'failure';
      health[signal][outcome]++;
      if (outcome === 'failure') report(signal);
      callback(
        outcome === 'success'
          ? { code: 0 }
          : { code: 1, error: new Error('Telemetry export failed') },
      );
    };
    try {
      original(batch, done);
    } catch {
      done({ code: 1 });
    }
  };
  return exporter;
}
export async function boundedFlush(providers, timeoutMs = 2000) {
  let timer;
  try {
    return await Promise.race([
      Promise.allSettled(
        providers.map((p) => Promise.resolve().then(() => p.forceFlush())),
      ).then((results) => ({
        outcome: results.some((r) => r.status === 'rejected')
          ? 'failure'
          : 'success',
      })),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve({ outcome: 'timeout' }), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
