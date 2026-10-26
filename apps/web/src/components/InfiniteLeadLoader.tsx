import { useEffect, useRef } from 'react';
import { LoaderCircle, ChevronDown } from 'lucide-react';

/** One automatic attempt per cursor; failures always require an explicit retry. */
export default function InfiniteLeadLoader({
  cursor,
  busy,
  error,
  onLoad,
}: {
  cursor: string | null;
  busy: boolean;
  error: boolean;
  onLoad: () => void;
}) {
  const marker = useRef<HTMLDivElement>(null);
  const attempted = useRef<string | null>(null);
  const action = useRef(onLoad);
  action.current = onLoad;
  useEffect(() => {
    if (
      !cursor ||
      busy ||
      error ||
      !marker.current ||
      !('IntersectionObserver' in window)
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || attempted.current === cursor) return;
        attempted.current = cursor;
        action.current();
      },
      { rootMargin: '0px 0px 300px 0px' },
    );
    observer.observe(marker.current);
    return () => observer.disconnect();
  }, [cursor, busy, error]);
  return (
    <div ref={marker} className="lead-load-more" aria-busy={busy}>
      {busy ? (
        <span role="status">
          <LoaderCircle className="spin" size={16} /> Loading leads…
        </span>
      ) : cursor || error ? (
        <button type="button" className="text-button" onClick={onLoad}>
          {error ? 'Retry loading leads' : 'Load more leads'}{' '}
          <ChevronDown size={16} />
        </button>
      ) : (
        <span role="status">All matching leads loaded</span>
      )}
    </div>
  );
}
