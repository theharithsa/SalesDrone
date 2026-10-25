type Agent = {
  identifyUser?: (value: string) => void;
  endSession?: () => void;
  disableSessionReplay?: () => void;
  setAutomaticActionDetection?: (enabled: boolean) => void;
  enableManualPageDetection?: () => void;
};
export function createRumIdentity(deps: {
  agent: () => Agent | undefined;
  anonymous: () => string;
  hash: (uid: string) => Promise<string>;
  onReady: (mode: 'email' | 'pseudonymous' | 'anonymous') => void;
  listen: (apply: () => void) => () => void;
  schedule: (apply: () => void) => unknown;
  clear: (timer: unknown) => void;
}) {
  let epoch = 0,
    current = '';
  return (uid: string | null, email?: string | null) => {
    const generation = ++epoch;
    let cancelled = false,
      timer: unknown,
      attempt = 0,
      applied = false;
    const normalized =
      uid &&
      email &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
      email.length <= 254
        ? email.trim().toLowerCase()
        : null;
    let tag: string | undefined;
    const apply = () => {
      if (cancelled || generation !== epoch || !tag || applied) return;
      const r = deps.agent();
      if (!r?.identifyUser) {
        if (++attempt < 16) timer = deps.schedule(apply);
        return;
      }
      try {
        r.disableSessionReplay?.();
        r.setAutomaticActionDetection?.(false);
        r.enableManualPageDetection?.();
        if (current && current !== tag) r.endSession?.();
        r.identifyUser(tag);
        current = tag;
        applied = true;
        deps.onReady(normalized ? 'email' : uid ? 'pseudonymous' : 'anonymous');
      } catch {}
    };
    const unlisten = deps.listen(apply);
    void (async () => {
      tag = normalized || (uid ? await deps.hash(uid) : deps.anonymous());
      apply();
    })().catch(() => {});
    return () => {
      cancelled = true;
      deps.clear(timer);
      unlisten();
    };
  };
}
