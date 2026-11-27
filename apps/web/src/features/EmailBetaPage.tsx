import type { ComponentProps, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Mail, Plus, RefreshCw } from 'lucide-react';
import { Button as AstryxButton } from '@astryxdesign/core/Button';
import { ErrorMessage, Modal } from '../components/UI';
import { displayDate } from '../lib/types';
import type { ApiClient } from '../lib/api';
import ImportSurface from './ImportSurface';
import EmailConversationMessage, { FormattedEmailText, type EmailMessage } from './EmailConversation';
import './email-beta.css';

type LeadLink = { id: string; name: string };
export type EmailThread = {
  id: string; subject: string; correspondent: string; updatedAt: string;
  latestMessageId: string; version: number; lead: LeadLink | null;
  unread: boolean; canSend: boolean;
};
type ThreadDetail = EmailThread & { messages: EmailMessage[]; nextCursor: string | null };
type ThreadPage = { items: EmailThread[]; nextCursor: string | null };
export type EmailTarget = { lead?: LeadLink; threadId?: string };
const labels = { all: 'All', unread: 'Unread', sent: 'Sent', unlinked: 'Unlinked' } as const;
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
  const navigationFocus = useRef<HTMLElement | null>(null);
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
    if (selected) detailButton.current?.focus();
  }, [selected]);
  const active = thread?.id === selected ? thread : null;

  return <ImportSurface className="email-beta">
    <header className="email-beta-header">
      <div><h1>Email <span className="email-beta-badge">Beta</span></h1><p>Manage your lead conversations.</p></div>
      <div className="email-beta-actions">
        <Button aria-label="Refresh email" onClick={refreshInbox}><RefreshCw size={16} /></Button>
        <Button variant="primary" onClick={event => { previousFocus.current = event.currentTarget; setDraft({}); }}><Plus size={16} /> Compose</Button>
      </div>
    </header>
    <div className={'email-beta-layout' + (selected ? ' has-thread' : '')}>
      <section className="email-beta-list" aria-label="Conversations" aria-busy={loading}>
        <h2>Conversations</h2>
        <nav className="email-beta-filters" aria-label="Inbox filters">{(Object.keys(labels) as (keyof typeof labels)[])
          .filter(key => key !== 'unlinked' || admin).map(key => <Button key={key}
            aria-pressed={filter === key} onClick={() => {
              if (filter === key) return;
              setSelected('');
              setThread(null);
              setListCursor(null);
              setItems([]);
              setNext(null);
              setFilter(key);
            }}>{labels[key]}</Button>)}</nav>
        <ErrorMessage error={listError} />
        {!items.length && !listError && <p className="email-beta-hint" role="status">{loading ? 'Loading conversations…' : 'No conversations on this page.'}</p>}
        <ul>{items.map(item => <li key={item.id}><button type="button" className="email-beta-row"
          aria-current={selected === item.id || undefined} onClick={event => {
            navigationFocus.current = event.currentTarget;
            setSelected(item.id);
          }}>
          <strong>{item.subject}</strong>
          <span>{item.lead?.name || item.correspondent}</span>
          <small>{item.unread ? 'Unread · ' : ''}{displayDate(item.updatedAt, timezone)}</small>
        </button></li>)}</ul>
        {next && <Button disabled={loading} onClick={() => setListCursor(next)}>Load more conversations</Button>}
      </section>
      <section className="email-beta-thread" aria-label="Selected conversation" aria-busy={detailBusy}>
        <Button className="email-beta-back" onClick={() => {
          setSelected('');
          requestAnimationFrame(() => navigationFocus.current?.focus());
        }}><ArrowLeft size={16} /> Conversations</Button>
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
          }}>Reply</Button>}
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
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  function format(kind: 'bold' | 'italic' | 'list') {
    const input = editor.current;
    if (!input) return;
    const { selectionStart, selectionEnd: end } = input;
    const start = kind === 'list' && selectionStart > 0
      ? body.lastIndexOf('\n', selectionStart - 1) + 1 : selectionStart;
    const text = body.slice(start, end);
    const delimiter = kind === 'bold' ? '**' : '*';
    const replacement = kind === 'list'
      ? text.split('\n').map(line => '- ' + line).join('\n')
      : delimiter + text + delimiter;
    const next = body.slice(0, start) + replacement + body.slice(end);
    if (next.length > 16000) return;
    setBody(next);
    requestAnimationFrame(() => {
      input.focus();
      const cursor = text ? start + replacement.length : start + (kind === 'list' ? 2 : delimiter.length);
      input.setSelectionRange(cursor, cursor);
    });
  }
  return <Modal open onClose={() => { if (!busy) onClose(); }} title={reply ? 'Reply' : 'New email'} description={reply ? 'Add a message to this conversation.' : 'Send a message to a lead from SalesDrone.'} wide returnFocusRef={returnFocusRef}>
    <ImportSurface><form className="email-beta-form" onSubmit={async event => {
      event.preventDefault();
      if (busy || !body.trim() || (!reply && (!lead || !subject.trim()))) return;
      const input = reply ? { expectedVersion: reply.version, body } : { leadId: lead!.id, subject, body };
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
      {reply ? <p>To {reply.correspondent}</p> : lead ? <div className="email-beta-actions"><span>To {lead.name}</span>
        <Button type="button" disabled={busy} onClick={() => setLead(undefined)}>Change lead</Button></div> :
        <LeadPicker request={request} onSelect={setLead} />}
      {!reply && <label>Subject<input value={subject} maxLength={180} required disabled={busy} onChange={event => setSubject(event.target.value)} /></label>}
      <div className="email-beta-editor">
        <div className="email-beta-actions" role="group" aria-label="Message formatting">
          <Button disabled={busy || preview} onClick={() => format('bold')}>Bold</Button>
          <Button disabled={busy || preview} onClick={() => format('italic')}>Italic</Button>
          <Button disabled={busy || preview} onClick={() => format('list')}>Bulleted list</Button>
          <Button aria-pressed={preview} onClick={() => setPreview(value => !value)}>{preview ? 'Edit message' : 'Preview'}</Button>
        </div>
        {preview ? <div className="email-beta-preview" aria-label="Message preview">
          {body.trim() ? <FormattedEmailText value={body} /> : <p>Your message will appear here.</p>}
        </div> : <label>Message<textarea ref={editor} value={body} maxLength={16000} required disabled={busy} onChange={event => setBody(event.target.value)} /></label>}
      </div>
      <ErrorMessage error={error} />
      <Button variant="primary" type="submit" disabled={busy || !body.trim() || (!reply && (!lead || !subject.trim()))}><Mail size={16} />{busy ? 'Queuing…' : 'Send email'}</Button>
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
