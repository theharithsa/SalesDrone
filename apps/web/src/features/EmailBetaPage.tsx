import type { ComponentProps, ReactNode } from 'react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Inbox, MailOpen, Plus, RefreshCw, Reply, Send, Unlink } from 'lucide-react';
import { Button as AstryxButton } from '@astryxdesign/core/Button';
import { ErrorMessage, Modal } from '../components/UI';
import { displayDate } from '../lib/types';
import type { ApiClient } from '../lib/api';
import ImportSurface from './ImportSurface';
import EmailConversationMessage, { type EmailMessage } from './EmailConversation';
import type { RichDraft } from './EmailRichEditor';
import './email-beta.css';

const EmailRichEditor = lazy(() => import('./EmailRichEditor'));

type LeadLink = { id: string; name: string };
export type EmailThread = {
  id: string; subject: string; correspondent: string; updatedAt: string;
  latestMessageId: string; version: number; lead: LeadLink | null;
  unread: boolean; canSend: boolean; preview?: string;
};
type ThreadDetail = EmailThread & { messages: EmailMessage[]; nextCursor: string | null };
type ThreadPage = { items: EmailThread[]; nextCursor: string | null };
export type EmailTarget = { lead?: LeadLink; threadId?: string };
const labels = { all: 'All', unread: 'Unread', sent: 'Sent', unlinked: 'Unlinked' } as const;
const folderIcons = { all: Inbox, unread: MailOpen, sent: Send, unlinked: Unlink };
const errorText = (cause: unknown) => cause instanceof Error ? cause.message : 'Something went wrong';

type ButtonProps = Omit<ComponentProps<typeof AstryxButton>, 'label'> & { children?: ReactNode; disabled?: boolean; 'aria-label'?: string };
function Button({ children, disabled, 'aria-label': name, ...props }: ButtonProps) {
  const pieces = Array.isArray(children) ? children : [children];
  const label = name || pieces.filter(piece => typeof piece === 'string').join('').trim();
  const icon = pieces.find(piece => piece != null && typeof piece === 'object');
  return <AstryxButton {...props} isDisabled={disabled} label={label} isIconOnly={!!name} icon={icon} />;
}


export default function EmailBetaPage({ request, admin, target, onConsumeTarget, onOpenLead, timezone }: {
  request: ApiClient; admin: boolean; target: EmailTarget | null; onConsumeTarget: () => void;
  onOpenLead: (lead: LeadLink) => void; timezone: string;
}) {
  const [filter, setFilter] = useState<keyof typeof labels>('all');
  const [items, setItems] = useState<EmailThread[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [listCursor, setListCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState(target?.threadId || '');
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [draft, setDraft] = useState<{ lead?: LeadLink; reply?: ThreadDetail } | null>(target?.lead ? { lead: target.lead } : null);
  const [manage, setManage] = useState<'link' | 'delete' | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailBusy, setDetailBusy] = useState(false);
  const [listError, setListError] = useState('');
  const [detailError, setDetailError] = useState('');
  const detailButton = useRef<HTMLHeadingElement>(null);
  const readingPane = useRef<HTMLElement>(null);
  const conversationRows = useRef(new Map<string, HTMLButtonElement>());
  const previousFocus = useRef<HTMLElement | null>(null);
  const refreshInbox = () => {
    setListCursor(null);
    setRefresh(count => count + 1);
  };
  useEffect(() => {
    if (target) onConsumeTarget();
  }, [target, onConsumeTarget]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setListError('');
    const query = '/email/threads?filter=' + filter + (listCursor ? '&cursor=' + encodeURIComponent(listCursor) : '');
    void request(query, 'GET', undefined, undefined, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      const { items: results, nextCursor } = data as ThreadPage;
      setItems(prior => listCursor ? [...prior, ...results.filter(item => !prior.some(row => row.id === item.id))] : results);
      setNext(nextCursor);
    }).catch(cause => {
      if (controller.signal.aborted) return;
      setItems([]);
      setNext(null);
      setListError(errorText(cause));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filter, listCursor, refresh, request]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setThread(null);
    setDetailError('');
    setDetailBusy(true);
    const url = '/email/threads/' + selected;
    void request(url, 'GET', undefined, undefined, controller.signal).then(async data => {
      if (controller.signal.aborted) return;
      const detail = data as ThreadDetail;
      setThread(detail);
      if (detail.unread) {
        await request(url + '/read', 'PATCH', { latestMessageId: detail.latestMessageId }, undefined, controller.signal);
        if (!controller.signal.aborted) setItems(prior => prior.map(item => item.id === selected ? { ...item, unread: false } : item));
      }
    }).catch(cause => {
      if (controller.signal.aborted) return;
      setThread(null);
      setDetailError(errorText(cause));
    }).finally(() => { if (!controller.signal.aborted) setDetailBusy(false); });
    return () => controller.abort();
  }, [selected, refresh, request]);
  useEffect(() => {
    if (!selected) return;
    if (readingPane.current) readingPane.current.scrollTop = 0;
    detailButton.current?.focus({ preventScroll: true });
  }, [selected]);
  const active = thread?.id === selected ? thread : null;
  const activeIndex = items.findIndex(item => item.id === selected);
  const previous = activeIndex > 0 ? items[activeIndex - 1] : undefined;
  const following = activeIndex >= 0 ? items[activeIndex + 1] : undefined;


  return <ImportSurface className="page-body email-beta">
    <header className="email-beta-header">
      <div><h1>Email <span className="email-beta-badge">Beta</span></h1><p>Manage your lead conversations.</p></div>
      <div className="email-beta-actions">
        <Button aria-label="Refresh email" onClick={refreshInbox}><RefreshCw size={16} /></Button>
      </div>
    </header>
    <div className={'email-beta-layout' + (selected ? ' has-thread' : '')}>
      <aside className="email-beta-mailbox" aria-label="Mailbox">
        <Button variant="primary" onClick={event => { previousFocus.current = event.currentTarget; setDraft({}); }}><Plus size={16} /> Compose</Button>
        <nav className="email-beta-filters" aria-label="Inbox filters">{(Object.keys(labels) as (keyof typeof labels)[])
          .filter(key => key !== 'unlinked' || admin).map(key => {
            const Icon = folderIcons[key];
            return <Button key={key} aria-pressed={filter === key} onClick={() => {
              if (filter === key) return;
              setSelected('');
              setThread(null);
              setListCursor(null);
              setItems([]);
              setNext(null);
              setFilter(key);
            }}><Icon size={16} />{labels[key]}</Button>;
          })}</nav>
      </aside>
      <section className="email-beta-list" aria-label="Conversations" aria-busy={loading}>
        <h2>{filter === 'all' ? 'Conversations' : labels[filter]}</h2>
        <ErrorMessage error={listError} />
        {!items.length && !listError && <p className="email-beta-hint" role="status">{loading ? 'Loading conversations…' : 'No conversations on this page.'}</p>}
        <ul>{items.map(item => <li key={item.id}><button type="button" className="email-beta-row"
          ref={node => {
            if (node) conversationRows.current.set(item.id, node);
            else conversationRows.current.delete(item.id);
          }}
          aria-current={selected === item.id || undefined} onClick={() => setSelected(item.id)}>
          <span className="email-beta-row-byline">
            <span>{item.unread && <span className="email-beta-unread" aria-label="Unread" role="img" />}{item.correspondent}</span>
            <small>{displayDate(item.updatedAt, timezone)}</small>
          </span>
          <strong>{item.subject}</strong>
          {item.preview && <span className="email-beta-row-preview">{item.preview}</span>}
        </button></li>)}</ul>
        {next && <Button disabled={loading} onClick={() => setListCursor(next)}>Load more conversations</Button>}
      </section>
      <section ref={readingPane} className="email-beta-thread" aria-label="Selected conversation" aria-busy={detailBusy}>
        {selected && <div className="email-beta-reading-toolbar">
          <Button className="email-beta-back" onClick={() => {
            setSelected('');
            requestAnimationFrame(() => conversationRows.current.get(selected)?.focus());
          }}><ArrowLeft size={16} /> Inbox</Button>
          {(previous || following) && <div className="email-beta-reading-nav" role="group" aria-label="Conversation navigation">
            <Button aria-label="Previous conversation" disabled={!previous || detailBusy}
              onClick={() => previous && setSelected(previous.id)}><ChevronLeft size={18} /></Button>
            <Button aria-label="Next conversation" disabled={!following || detailBusy}
              onClick={() => following && setSelected(following.id)}><ChevronRight size={18} /></Button>
          </div>}
        </div>}
        <h2 ref={detailButton} tabIndex={-1}>{active?.subject || (selected ? 'Conversation' : 'Select a conversation')}</h2>
        {detailBusy && <p role="status">Loading messages…</p>}
        <ErrorMessage error={detailError} />
        {active && <>
          <p className="email-beta-correspondent">{active.correspondent}</p>
          <div className="email-beta-actions">
            {active.lead && <Button onClick={() => active.lead && onOpenLead(active.lead)}>Open {active.lead.name}</Button>}
            {admin && <details className="email-beta-manage">
              <summary>Manage</summary>
              <div>
                <Button onClick={event => {
                  previousFocus.current = event.currentTarget; setManage('link');
                }}>{active.lead ? 'Change lead link' : 'Link to lead'}</Button>
                <Button onClick={event => {
                  previousFocus.current = event.currentTarget; setManage('delete');
                }}>Delete conversation</Button>
              </div>
            </details>}
          </div>
          {active.nextCursor && <Button disabled={detailBusy} onClick={async () => {
            setDetailBusy(true);
            try {
              const older = await request('/email/threads/' + active.id + '?cursor=' + encodeURIComponent(active.nextCursor!)) as ThreadDetail;
              setThread(current => current?.id === active.id
                ? { ...older, messages: [...current.messages, ...older.messages] } : current);
            } catch (cause) {
              setThread(null);
              setDetailError(errorText(cause));
            } finally { setDetailBusy(false); }
          }}>Load older messages</Button>}
          <ol className="email-beta-messages" aria-label="Conversation messages">
            {[...active.messages].reverse().map(message =>
              <EmailConversationMessage key={message.id} message={message} correspondent={active.correspondent}
                timezone={timezone} latest={message.id === active.latestMessageId} />)}
          </ol>
          {active.canSend && <Button variant="primary" onClick={event => {
            previousFocus.current = event.currentTarget; setDraft({ reply: active });
          }}><Reply size={16} /> Reply</Button>}
        </>}
      </section>
    </div>
    {draft && <EmailComposer key={draft.reply?.id || draft.lead?.id || 'new'} {...draft}
      request={request} returnFocusRef={previousFocus} onClose={() => setDraft(null)}
      onQueued={id => { setDraft(null); setFilter('all'); setSelected(id); refreshInbox(); }} />}
    {manage && active && <ManageThread mode={manage} thread={active} request={request}
      returnFocusRef={previousFocus} onClose={() => setManage(null)}
      onSaved={() => { if (manage === 'delete') setSelected(''); setManage(null); refreshInbox(); }} />}
  </ImportSurface>;
}

function LeadPicker({ request, onSelect }: { request: ApiClient; onSelect: (lead: LeadLink) => void }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<LeadLink[]>([]);
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (search.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setStatus('Searching leads…');
      void request('/leads?limit=10&search=' + encodeURIComponent(search.trim()), 'GET', undefined, undefined, controller.signal)
        .then(value => {
          if (controller.signal.aborted) return;
          const leads = (value as { items: (LeadLink & { company?: string })[] }).items;
          setResults(leads.map(lead => ({ id: lead.id, name: lead.name || lead.company || 'Unnamed lead' })));
          setStatus(leads.length ? '' : 'No matching leads');
        }).catch(cause => { if (!controller.signal.aborted) setStatus(errorText(cause)); });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, request]);
  return <div className="email-beta-pick">
    <label>Find lead<input value={search} maxLength={100} onChange={event => {
      setResults([]); setStatus(''); setSearch(event.target.value);
    }} /></label>
    {status && <p role="status">{status}</p>}
    {results.map(lead => <Button type="button" key={lead.id} onClick={() => onSelect(lead)}>{lead.name}</Button>)}
  </div>;
}

type DialogProps = { request: ApiClient; onClose: () => void; returnFocusRef: { current: HTMLElement | null } };
function EmailComposer({ lead: initialLead, reply, request, onClose, onQueued, returnFocusRef }:
  DialogProps & { lead?: LeadLink; reply?: ThreadDetail; onQueued: (id: string) => void }) {
  const [lead, setLead] = useState(initialLead);
  const [subject, setSubject] = useState('');
  const [draft, setDraft] = useState<RichDraft>({ body: '', html: '' });
  const [busy, setBusy] = useState(false);
  const tooLong = draft.body.length > 16000 || draft.html.length > 48000;
  const canSend = !busy && !tooLong && !!draft.body.trim() && (!!reply || (!!lead && !!subject.trim()));
  const [error, setError] = useState('');
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  return <Modal open onClose={() => { if (!busy) onClose(); }} title={reply ? 'Reply' : 'New email'} description={reply ? 'Add a message to this conversation.' : 'Send a message to a lead from SalesDrone.'} wide returnFocusRef={returnFocusRef}>
    <ImportSurface><form className="email-beta-form" onSubmit={async event => {
      event.preventDefault();
      if (!canSend) return;
      const input = reply ? { expectedVersion: reply.version, ...draft } : { leadId: lead!.id, subject, ...draft };
      const payload = JSON.stringify(input);
      if (attempt.current?.payload !== payload) attempt.current = { payload, key: crypto.randomUUID() };
      setBusy(true);
      setError('');
      try {
        const result = await request(reply ? '/email/threads/' + reply.id + '/replies' : '/email/threads', 'POST',
          input, attempt.current.key) as { threadId: string };
        onQueued(result.threadId);
      } catch (cause) { setError(errorText(cause)); }
      finally { setBusy(false); }
    }}>
      <div className="email-compose-envelope">
        {reply || lead ? <div className="email-compose-recipient">
          <span>To</span>
          <strong>{reply?.correspondent || lead?.name}</strong>
          {!reply && <Button type="button" variant="ghost" disabled={busy} onClick={() => setLead(undefined)}>Change lead</Button>}
        </div> : <LeadPicker request={request} onSelect={setLead} />}
        {reply ? <p className="email-compose-recipient"><span>Subject</span><strong>{reply.subject}</strong></p>
          : <label className="email-compose-subject">Subject<input value={subject} maxLength={180} required
            disabled={busy} onChange={event => setSubject(event.target.value)} /></label>}
      </div>
      <Suspense fallback={<p role="status">Loading editor…</p>}>
        <EmailRichEditor disabled={busy} onChange={setDraft} />
      </Suspense>
      {tooLong && <p role="alert">This message is too long. Shorten the text or remove some formatting.</p>}
      <ErrorMessage error={error} />
      <div className="email-compose-footer">
        <Button variant="primary" type="submit" disabled={!canSend}><Send size={16} />{busy ? 'Queuing…' : 'Send email'}</Button>
      </div>
    </form></ImportSurface>
  </Modal>;
}

function ManageThread({ thread, mode, request, onClose, onSaved, returnFocusRef }:
  DialogProps & { thread: ThreadDetail; mode: 'link' | 'delete'; onSaved: () => void }) {
  const [target, setTarget] = useState<LeadLink | null | undefined>(undefined);
  const [suggestion, setSuggestion] = useState<LeadLink | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (mode !== 'link' || thread.lead) return;
    const controller = new AbortController();
    void request('/email/threads/' + thread.id + '/match', 'GET', undefined, undefined, controller.signal)
      .then(value => { if (!controller.signal.aborted) setSuggestion((value as { lead: LeadLink | null }).lead); })
      .catch(cause => { if (!controller.signal.aborted) setError(errorText(cause)); });
    return () => controller.abort();
  }, [mode, request, thread.id, thread.lead]);
  const deleting = mode === 'delete';
  return <Modal open onClose={() => { if (!busy) onClose(); }} title={deleting ? 'Delete conversation' : 'Link to a lead'} returnFocusRef={returnFocusRef}>
    <ImportSurface><form className="email-beta-form" onSubmit={async event => {
      event.preventDefault();
      if (busy || (deleting ? confirmation !== 'DELETE' : target === undefined)) return;
      setBusy(true);
      setError('');
      try {
        const url = '/email/threads/' + thread.id;
        await request(deleting ? url : url + '/lead', deleting ? 'DELETE' : 'PATCH', deleting
          ? { confirmation, expectedVersion: thread.version }
          : { leadId: target?.id || null, expectedVersion: thread.version });
        onSaved();
      } catch (cause) { setError(errorText(cause)); }
      finally { setBusy(false); }
    }}>
      {deleting ? <label>Type DELETE to remove this conversation from SalesDrone<input disabled={busy} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
        : <>
            <p>Anyone with access to the selected lead can see this conversation.</p>
            {suggestion && <Button type="button" disabled={busy} onClick={() => setTarget(suggestion)}>Suggested lead · {suggestion.name}</Button>}
            <LeadPicker request={request} onSelect={setTarget} />
            {thread.lead && <Button type="button" disabled={busy} onClick={() => setTarget(null)}>Remove lead link</Button>}
            {target !== undefined && <p role="status">{target?.name || 'Unlinked inbox'}</p>}
          </>}
      <ErrorMessage error={error} />
      <Button type="submit" disabled={busy || (deleting ? confirmation !== 'DELETE' : target === undefined)}>
        {deleting ? 'Delete conversation' : 'Save lead link'}
      </Button>
    </form></ImportSurface>
  </Modal>;
}
