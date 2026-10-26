import { useEffect, useState } from 'react';
import { ArrowRight, GitBranch } from 'lucide-react';
import { Lead, Entity, displayDate } from '../lib/types';
import { ErrorMessage } from './UI';
export default function LeadJourney({
  lead,
  stages,
  request,
  timezone,
  demo,
}: {
  lead: Lead;
  stages: string[];
  request: (p: string) => Promise<any>;
  timezone: string;
  demo: boolean;
}) {
  const [items, setItems] = useState<Entity[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [complete, setComplete] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    setItems([]);
    setCursor(null);
    setComplete(false);
    setError('');
    if (demo) return;
    setBusy(true);
    request('/leads/' + lead.id + '/journey?limit=10')
      .then((r) => {
        if (alive) {
          setItems(r.items);
          setCursor(r.nextCursor);
          setComplete(r.historyComplete);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [lead.id, lead.version, request, demo]);
  async function more() {
    if (!cursor) return;
    setBusy(true);
    try {
      const r = await request(
        '/leads/' +
          lead.id +
          '/journey?limit=10&cursor=' +
          encodeURIComponent(cursor),
      );
      setItems((old) => [...old, ...r.items]);
      setCursor(r.nextCursor);
      setComplete((old) => old || r.historyComplete);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const labels = [...new Set([...stages, lead.stage])];
  return (
    <section className="detail-section lead-journey">
      <div className="score-section-heading">
        <h3>LEAD JOURNEY</h3>
        <GitBranch size={17} />
      </div>
      <ol
        className="lead-stage-path"
        tabIndex={0}
        aria-label="Configured sales stages"
      >
        {labels.map((label) => (
          <li
            key={label}
            className={label === lead.stage ? 'current-stage' : ''}
            aria-current={label === lead.stage ? 'step' : undefined}
          >
            <span />
            {label}
          </li>
        ))}
      </ol>
      <div className="journey-options">
        <details className="journey-explanation">
          <summary>About this journey</summary>
          <p className="field-hint">
            Stages show your workspace path. Only the recorded changes below
            confirm where this lead has been.
          </p>
        </details>
        <details className="journey-history">
          <summary>
            Recorded stage changes{' '}
            {items.length ? `(${items.length}${cursor ? '+' : ''})` : ''}
          </summary>
          {items.map((item) => (
            <div key={item.id}>
              <strong>
                {item.from || 'Created'} <ArrowRight size={12} /> {item.to}
              </strong>
              <time dateTime={item.createdAt}>
                {displayDate(item.createdAt, timezone)}
              </time>
            </div>
          ))}
          {busy ? <p className="field-hint">Loading journey…</p> : null}
          {!complete && !busy ? (
            <p className="field-hint">
              {demo
                ? 'Demo stages are illustrative; no stage history is fabricated.'
                : 'Earlier stage history is unavailable for this lead. Recording starts with changes made after this feature was introduced.'}
            </p>
          ) : null}
          {cursor ? (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void more()}
            >
              Earlier changes
            </button>
          ) : null}
        </details>
      </div>
      <ErrorMessage error={error} />
    </section>
  );
}
