const limit = 24;

function lifetime(path: string) {
  const [route, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  if (params.has('cursor') || params.has('search')) return 0;
  if (route === '/field-options' && !query) return 45_000;
  if ((route === '/summary' || route === '/dashboard') && !query) return 30_000;
  if (route === '/leads' || route === '/tasks') return 15_000;
  return 0;
}

/** Per-tab memory for repeat page reads. HTTP and persistent storage stay uncached. */
export class WorkspaceReadCache {
  private scope = '';
  private pending = new Map<string, Promise<unknown>>();
  private values = new Map<string, { value: unknown; expires: number }>();

  clear() {
    this.values.clear();
    this.pending.clear();
  }

  async read<T>(scope: string, path: string, load: () => Promise<T>, now = Date.now): Promise<T> {
    if (scope !== this.scope) {
      this.clear();
      this.scope = scope;
    }
    const ttl = scope ? lifetime(path) : 0;
    if (!ttl) return load();

    const cached = this.values.get(path);
    if (cached && cached.expires > now()) return structuredClone(cached.value) as T;
    this.values.delete(path);
    const running = this.pending.get(path);
    if (running) return structuredClone(await running) as T;
    if (this.pending.size >= limit) return load();

    const operation = load();
    this.pending.set(path, operation);
    try {
      const result = await operation;
      if (this.pending.get(path) === operation) {
        if (this.values.size >= limit) this.values.delete(this.values.keys().next().value!);
        this.values.set(path, { value: structuredClone(result), expires: now() + ttl });
      }
      return result;
    } finally {
      if (this.pending.get(path) === operation) this.pending.delete(path);
    }
  }
}
