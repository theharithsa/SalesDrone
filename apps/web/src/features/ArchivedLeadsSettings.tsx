import { useEffect, useRef, useState } from 'react';
import { Archive, RefreshCw } from 'lucide-react';
import { Badge, Empty, ErrorMessage } from '../components/UI';
import type { Lead } from '../lib/types';

type Request = (
  path: string,
  method?: string,
  body?: any,
  key?: string,
) => Promise<any>;
export default function ArchivedLeadsSettings({
  request,
  onOpenLead,
}: {
  request: Request;
  onOpenLead?: (lead: Lead) => void;
}) {
  const [items, setItems] = useState<Lead[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const generation = useRef(0);
  const pending = useRef(false);
  async function load(append = false) {
    if (pending.current) return;
    pending.current = true;
    const current = generation.current;
    setBusy(true);
    setError('');
    try {
      const page = await request(
        '/archived-leads?limit=30' +
          (append && cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
      );
      if (current !== generation.current) return;
      setItems((previous) =>
        append
          ? [
              ...new Map(
                [...previous, ...page.items].map((lead: Lead) => [
                  lead.id,
                  lead,
                ]),
              ).values(),
            ]
          : page.items,
      );
      setCursor(page.nextCursor);
      setLoaded(true);
    } catch (e) {
      if (current === generation.current) setError((e as Error).message);
    } finally {
      if (current === generation.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  useEffect(() => {
    generation.current++;
    pending.current = false;
    setItems([]);
    setCursor(null);
    setLoaded(false);
    void load();
    return () => {
      generation.current++;
      pending.current = false;
    };
  }, [request]);
  return (
    <section className="panel archived-leads-settings" aria-busy={busy}>
      <div className="section-heading">
        <div>
          <h3>
            <Archive size={20} /> Archived leads
          </h3>
          <p>
            Kept for reference, outside your active pipeline. Your current
            lead-access permissions still apply. Pending reminders stay
            cancelled.
          </p>
        </div>
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() => void load()}
        >
          <RefreshCw size={16} /> Refresh archives
        </button>
      </div>
      <ErrorMessage error={error} />
      {busy ? <p role="status">Loading archived leads…</p> : null}
      {loaded && !items.length && !busy ? (
        <Empty title="No archived leads">
          Leads you archive will appear here if they are within your access.
        </Empty>
      ) : null}
      <div className="archived-lead-list">
        {items.map((lead) => (
          <article className="archived-lead-card" key={lead.id}>
            <div className="archived-lead-identity">
              <h4>{lead.name || 'Unnamed lead'}</h4>
              <p>{lead.company || 'No company recorded'}</p>
              <Badge stage={lead.stage} />
            </div>
            <dl>
              <div>
                <dt>Phone</dt>
                <dd className="phone-number">{lead.phone || 'Not recorded'}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{lead.email || 'Not recorded'}</dd>
              </div>
              <div>
                <dt>Archived</dt>
                <dd>
                  {lead.archivedAt
                    ? new Date(lead.archivedAt).toLocaleDateString()
                    : 'Date not recorded'}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              className="text-button"
              disabled={!onOpenLead}
              onClick={() => onOpenLead?.(lead)}
            >
              View lead record
            </button>
          </article>
        ))}
      </div>
      {cursor ? (
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() => void load(true)}
        >
          Load more archived leads
        </button>
      ) : null}
      {!loaded && !busy ? (
        <button type="button" className="button" onClick={() => void load()}>
          Retry loading archives
        </button>
      ) : null}
    </section>
  );
}
