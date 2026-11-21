import { useEffect, useRef, useState } from 'react';
import { Building2, Plus, Search } from 'lucide-react';
import WorkspacePageHeader from '../components/WorkspacePageHeader';
import { ErrorMessage } from '../components/UI';
import type { Lead } from '../lib/types';

type Company = { key: string; name: string };
type Page = { items: Company[]; nextCursor: string | null };

export default function CompaniesPage({ request, refreshKey, hidden, demoLeads, onLeads, onAdd }: {
  request: (path: string) => Promise<Page>;
  refreshKey: number;
  hidden: boolean;
  demoLeads?: Lead[];
  onLeads: (name: string) => void;
  onAdd?: (name: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState<Page>({ items: [], nextCursor: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const params = new URLSearchParams(search ? { search } : undefined);
  const url = '/companies' + (search ? '?' + params : '');

  useEffect(() => {
    const current = ++generation.current;
    setPage({ items: [], nextCursor: null });
    setError('');
    if (hidden) { setBusy(false); return; }
    if (demoLeads) {
      setBusy(false);
      const names = new Map<string, string>();
      for (const lead of demoLeads) {
        const name = lead.company?.trim();
        if (!lead.archived && name && name.toLowerCase().startsWith(search.toLowerCase())) names.set(name.toLowerCase(), name);
      }
      setPage({ items: Array.from(names, ([key, name]) => ({ key, name })).sort((a,b) => a.key.localeCompare(b.key)), nextCursor: null });
      return;
    }
    setBusy(true);
    request(url).then(result => { if (current === generation.current) setPage(result); })
      .catch(err => { if (current === generation.current) setError(err.message); })
      .finally(() => { if (current === generation.current) setBusy(false); });
    return () => { generation.current = current + 1; };
  }, [url, search, hidden, demoLeads, request, refreshKey, retry]);

  async function more() {
    if (busy || !page.nextCursor) return;
    const current = generation.current;
    setBusy(true); setError('');
    params.set('cursor', page.nextCursor);
    try {
      const result = await request('/companies?' + params);
      if (current === generation.current) setPage(previous => ({
        items: [...new Map([...previous.items, ...result.items].map(item => [item.key, item])).values()],
        nextCursor: result.nextCursor,
      }));
    } catch (err) {
      if (current === generation.current) setError((err as Error).message);
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }

  return <div className="page-body companies-page">
    <WorkspacePageHeader title="Companies" description="Find an organization and open its leads." />
    {hidden ? <p>The company field is hidden in workspace settings.</p> : <>
      <form className="company-search" role="search" onSubmit={event => { event.preventDefault(); setSearch(draft.trim()); }}>
        <input type="search" value={draft} maxLength={200} aria-label="Company name" placeholder="Search by company name"
          onChange={event => { setDraft(event.target.value); if (!event.target.value) setSearch(''); }} />
        <button className="button" type="submit"><Search size={16} />Search</button>
      </form>
      <div className="panel company-directory" aria-busy={busy} data-dtrum-mask="" data-dt-mask="">
        {page.items.map(company => <div className="company-row" key={company.key}>
          <Building2 size={20} aria-hidden="true" />
          <button className="text-button company-name" onClick={() => onLeads(company.name)}>{company.name}</button>
          {onAdd && <button className="button" aria-label={'Add lead to ' + company.name} onClick={() => onAdd(company.name)}><Plus size={16} />Add lead</button>}
        </div>)}
        {!busy && !error && !page.items.length && <p>{search ? 'No companies match this name.' : 'Companies appear here when you add a company name to a lead.'}</p>}
        {busy && <p role="status">Loading companies…</p>}
        <ErrorMessage error={error} />
        {page.nextCursor ? <button className="button" disabled={busy} onClick={more}>Load more companies</button>
          : error && <button className="button" onClick={() => setRetry(n => n + 1)}>Try again</button>}
      </div>
    </>}
  </div>;
}
