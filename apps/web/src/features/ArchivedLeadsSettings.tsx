import { useEffect, useRef, useState } from 'react';
import { Archive, RefreshCw, ArchiveRestore } from 'lucide-react';
import { Badge, Empty, ErrorMessage, Modal } from '../components/UI';
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
  canRestore=false,
  onRestored,
}: {
  request: Request;
  onOpenLead?: (lead: Lead) => void;
  canRestore?: boolean;
  onRestored?:()=>void|Promise<void>;
}) {
  const [items, setItems] = useState<Lead[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [restoreLead, setRestoreLead] = useState<Lead|null>(null);
  const refreshRef=useRef<HTMLButtonElement|null>(null);
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
    setRestoreLead(null);
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
            lead-access permissions still apply. Restoring never reschedules cancelled
            outreach; administrative tasks keep their existing state.
          </p>
        </div>
        <button
          type="button"
          className="button"
          ref={refreshRef}
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
            {canRestore?<button type="button" className="button" disabled={busy} onClick={()=>setRestoreLead(lead)}><ArchiveRestore size={16}/> Restore lead</button>:null}
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
      <Modal open={!!restoreLead} onClose={()=>{if(!busy)setRestoreLead(null);}} title="Restore lead?" description="Return this lead to the active list. Suppression stays in place and cancelled outreach stays cancelled." returnFocusRef={refreshRef}>
        <p>{restoreLead?.name || 'Unnamed lead'}</p>
        <ErrorMessage error={error}/>
        <div className="form-actions">
          <button type="button" className="text-button" disabled={busy} onClick={()=>setRestoreLead(null)}>Cancel</button>
          <button type="button" className="button primary" disabled={busy || !canRestore} onClick={async()=>{
            if(!restoreLead || pending.current)return;
            const lead=restoreLead,current=generation.current;pending.current=true;setBusy(true);setError('');
            try{
              await request('/leads/'+encodeURIComponent(lead.id)+'/restore','POST',{expectedVersion:lead.version});
              if(current!==generation.current)return;
              setItems(rows=>rows.filter(row=>row.id!==lead.id));setRestoreLead(null);
              try{await onRestored?.();}catch{if(current===generation.current)setError('Lead restored. Refresh the workspace to see the updated active list.');}
            }catch(e){if(current===generation.current)setError((e as Error).message);}
            finally{if(current===generation.current){pending.current=false;setBusy(false);}}
          }}>{busy?'Restoring…':'Confirm restore'}</button>
        </div>
      </Modal>
    </section>
  );
}
