import { useRef, useState } from "react";
import {
  ArrowUp,
  BadgeCheck,
  History,
  LockKeyhole,
  PhoneOutgoing,
  Plus,
  Search,
  Sparkles,
  Square,
  TrendingUp,
  Trash2,
} from "lucide-react";
import { Modal } from "../components/UI";
import "../material/assistant.css";
export type AssistantLeadRow = {
  id: string;
  name: string;
  company: string;
  stage: string;
  detail: string;
};
export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  scope?: string;
  period?: string;
  leads?: AssistantLeadRow[];
  sources?: { id: string; label: string; excerpt: string }[];
  clarifications?: string[];
  fieldLabels?: string[];
  resultRequestId?: string;
  resultCount?: number;
  resultsLoaded?: boolean;
  hasMoreResults?: boolean;
};
export type AssistantChatSummary = {
  id: string;
  title: string;
  updatedAt: string;
};
const suggestions = [
  {
    label: "Calls next week",
    question: "List the leads I need to call next week",
    icon: PhoneOutgoing,
  },
  {
    label: "Approved orders",
    question: "Show me the approved orders",
    icon: BadgeCheck,
  },
  {
    label: "Conversions this month",
    question: "How many leads converted this month?",
    icon: TrendingUp,
  },
  {
    label: "Failure patterns",
    question: "What patterns are reported in failed lead notes?",
    icon: Search,
  },
];
export default function LeadAssistantView({
  messages,
  draft,
  onDraft,
  onSend,
  onNewChat,
  onSelectChat,
  onClarify,
  onCancel,
  busy = false,
  error = "",
  scopeLabel = "Your accessible leads",
  history = [],
  onDeleteChat,
  onMoreHistory,
  onEarlier,
  onLoadResults,
  onOpenLead,
}: {
  messages: AssistantMessage[];
  draft: string;
  onDraft: (value: string) => void;
  onSend: (question: string) => void;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onClarify: (value: string) => void;
  onCancel?: () => void;
  busy?: boolean;
  error?: string;
  scopeLabel?: string;
  history?: AssistantChatSummary[];
  onDeleteChat?: () => void;
  onMoreHistory?: () => void;
  onEarlier?: () => void;
  onLoadResults?: (id: string) => void;
  onOpenLead?: (id: string) => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyTrigger = useRef<HTMLButtonElement>(null),
    input = useRef<HTMLTextAreaElement>(null);
  const choose = (question: string) => {
    onDraft(question);
    input.current?.focus();
  };
  const submit = () => {
    if (draft.trim() && !busy) onSend(draft.trim());
  };
  return (
    <section
      className={"lead-assistant " + (!messages.length ? "is-empty" : "")}
      data-dt-mask
      aria-label="Lead Assistant"
    >
      <header className="assistant-topbar">
        <div className="assistant-title">
          <Sparkles size={22} />
          <span>Lead Assistant</span>
        </div>
        <div className="assistant-page-actions">
          {onDeleteChat ? (
            <button
              className="icon-button"
              aria-label="Delete this chat"
              title="Delete this chat"
              onClick={() => {
                if (
                  window.confirm(
                    "Delete this private chat and its saved answers?",
                  )
                )
                  onDeleteChat();
              }}
            >
              <Trash2 size={20} />
            </button>
          ) : null}
          <button
            className="icon-button"
            aria-label="Open chat history"
            title="Your chats"
            ref={historyTrigger}
            onClick={() => setHistoryOpen(true)}
          >
            <History size={21} />
          </button>
          <button
            className="icon-button"
            aria-label="New chat"
            title="New chat"
            onClick={onNewChat}
          >
            <Plus size={23} />
          </button>
        </div>
      </header>
      <div className="assistant-conversation">
        {onEarlier ? (
          <button className="button" onClick={onEarlier}>
            Earlier messages
          </button>
        ) : null}
        {!messages.length ? (
          <div className="assistant-welcome">
            <Sparkles className="assistant-welcome-icon" size={40} />
            <h1>How can I help with your leads?</h1>
            <p>Explore follow-ups, orders and pipeline insights.</p>
            <div className="assistant-suggestions">
              {suggestions.map(({ label, question, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => choose(question)}
                >
                  <Icon size={20} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div
            className="assistant-transcript"
            role="log"
            aria-label="Conversation"
            aria-live="polite"
          >
            {messages.map((message) => (
              <article
                key={message.id}
                className={"assistant-message " + message.role}
                aria-label={
                  message.role === "user"
                    ? "Your question"
                    : "Lead Assistant answer"
                }
              >
                {message.role === "assistant" ? (
                  <div className="assistant-answer-label">
                    <Sparkles size={18} />
                    <span>Lead Assistant</span>
                  </div>
                ) : null}
                <p className="assistant-message-text">{message.text}</p>
                {message.scope || message.period ? (
                  <p className="assistant-query-context">
                    {[message.scope, message.period]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
                {message.fieldLabels?.length ? (
                  <details className="assistant-sources">
                    <summary>Available lead fields</summary>
                    <p>{message.fieldLabels.join(" · ")}</p>
                  </details>
                ) : null}
                {message.clarifications ? (
                  <div className="assistant-clarifications">
                    {message.clarifications.map((value) => (
                      <button
                        className="button"
                        key={value}
                        onClick={() => onClarify(value)}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                ) : null}
                {message.leads?.length ? (
                  <ul className="assistant-lead-results">
                    {message.leads.map((lead) => (
                      <li key={lead.id}>
                        <div>
                          <a
                            href={"/leads/" + encodeURIComponent(lead.id)}
                            onClick={
                              onOpenLead
                                ? (event) => {
                                    event.preventDefault();
                                    onOpenLead(lead.id);
                                  }
                                : undefined
                            }
                          >
                            {lead.name}
                          </a>
                          <p>{lead.company}</p>
                        </div>
                        <span className="assistant-result-stage">
                          {lead.stage}
                        </span>
                        <span className="assistant-result-detail">
                          {lead.detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {message.resultRequestId &&
                onLoadResults &&
                (!message.resultsLoaded || message.hasMoreResults) ? (
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => onLoadResults(message.resultRequestId!)}
                  >
                    {message.resultsLoaded
                      ? "More matching leads"
                      : `View matching leads (${message.resultCount || 0})`}
                  </button>
                ) : null}
                {message.sources?.length ? (
                  <details className="assistant-sources">
                    <summary>
                      Sources · {message.sources.length} records
                    </summary>
                    {message.sources.map((source) => (
                      <div key={source.id}>
                        <strong>{source.label}</strong>
                        <p>{source.excerpt}</p>
                      </div>
                    ))}
                  </details>
                ) : null}
              </article>
            ))}
            {busy ? (
              <div className="assistant-progress" role="status">
                <Sparkles size={18} />
                <span>Checking the relevant records…</span>
              </div>
            ) : null}
          </div>
        )}
      </div>
      <div className="assistant-composer-dock">
        {error ? (
          <p className="error-message" role="alert">
            {error}
          </p>
        ) : null}
        <form
          className="assistant-composer"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <textarea
            ref={input}
            aria-label="Ask about your leads"
            placeholder="Ask about your leads"
            rows={2}
            maxLength={1000}
            value={draft}
            disabled={busy}
            onChange={(event) => onDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                submit();
              }
            }}
          />
          <div className="assistant-composer-toolbar">
            <span className="assistant-access-context">
              <LockKeyhole size={14} />
              {scopeLabel}
            </span>
            {busy && onCancel ? (
              <button
                className="assistant-send"
                type="button"
                aria-label="Stop current answer"
                onClick={onCancel}
              >
                <Square size={19} />
              </button>
            ) : (
              <button
                className="assistant-send"
                type="submit"
                aria-label="Send question"
                disabled={busy || !draft.trim()}
              >
                <ArrowUp size={23} />
              </button>
            )}
          </div>
        </form>
        <p className="assistant-footer-note">
          Lead data only. Review the sources. Your records stay unchanged.
        </p>
      </div>
      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Your chats"
        description="Private to your account."
        returnFocusRef={historyTrigger}
      >
        <div className="assistant-history">
          <button
            className="button"
            onClick={() => {
              onNewChat();
              setHistoryOpen(false);
            }}
          >
            <Plus size={18} />
            New chat
          </button>
          {onMoreHistory ? (
            <button className="button" onClick={onMoreHistory}>
              Older chats
            </button>
          ) : null}
          {history.length ? (
            history.map((chat) => (
              <button
                key={chat.id}
                className="assistant-history-row"
                onClick={() => {
                  onSelectChat(chat.id);
                  setHistoryOpen(false);
                }}
              >
                <span>{chat.title}</span>
                <small>{chat.updatedAt}</small>
              </button>
            ))
          ) : (
            <p>No saved chats yet.</p>
          )}
        </div>
      </Modal>
    </section>
  );
}
