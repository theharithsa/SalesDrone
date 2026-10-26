/** Origin-local identity with a distinct page-lifetime fallback when storage is blocked. */
export function createAnonymousId(deps: {
  read: () => string | null;
  write: (id: string) => void;
  random: () => string;
}) {
  let fallback: string | undefined;
  return () => {
    try {
      let id = deps.read();
      if (!id || !/^[a-f0-9-]{36}$/i.test(id)) {
        id = deps.random();
        deps.write(id);
      }
      return 'browser:' + id;
    } catch {
      fallback ||= deps.random();
      return 'browser:' + fallback;
    }
  };
}
type ActionAgent = {
  addActionProperties?: (
    id: number,
    longs?: unknown,
    dates?: unknown,
    strings?: Record<string, string>,
  ) => void;
  leaveAction?: (id: number) => void;
};
/** Cleanup owns closure even if the agent rejects properties. Completion is idempotent. */
export function finishAction(
  agent: ActionAgent | undefined,
  id: number | undefined,
) {
  let completed = false;
  return (properties: Record<string, string>) => {
    if (id === undefined || completed) return;
    completed = true;
    try {
      agent?.addActionProperties?.(id, undefined, undefined, properties);
    } catch {
    } finally {
      try {
        agent?.leaveAction?.(id);
      } catch {}
    }
  };
}
