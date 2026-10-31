import { useCallback, useEffect, useState, useRef } from "react";
import {
  RefreshCw,
  Plus,
  Trash2,
  Sparkles,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";
import { ErrorMessage } from "../components/UI";
type Row = Record<string, any>;
type Request = (p: string, m?: string, b?: any, k?: string) => Promise<any>;
const issueLabel: Record<string, string> = {
  contact_index_verification_limited:
    "Large contact index: some references require further review",
  contact_index_missing: "Contact index reference missing",
  contact_index_needs_review:
    "Contact index needs review (no automatic repair)",
  missing_name: "Missing name",
  invalid_enquiry_date: "Invalid enquiry date",
  missing_contact: "Missing contact details",
  invalid_phone: "Invalid phone",
  invalid_email: "Invalid email",
  needs_review: "Marked for review",
  retired_stage: "Retired sales stage",
  custom_fields_need_review: "Required or invalid custom fields",
  archive_review: "Eligible for archive review",
};
export default function ResearchPage({
  mode,
  request,
  demo,
  canRun,
  canAI,
  admin,
}: {
  mode: "hygiene" | "assistant";
  request: Request;
  demo: boolean;
  canRun: boolean;
  canAI: boolean;
  admin: boolean;
}) {
  const loadEpoch = useRef(0);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [history, setHistory] = useState<Row[]>([]),
    [selected, setSelected] = useState<Row | null>(null),
    [items, setItems] = useState<Row[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [historyCursor, setHistoryCursor] = useState<string | null>(null),
    [question, setQuestion] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [index, setIndex] = useState<Row | null>(null);
  const base =
    mode === "hygiene"
      ? "/lead-hygiene/scans"
      : "/lead-assistant/conversations";
  const loadHistory = useCallback(
    async (next?: string) => {
      if (demo) return;
      const p = await request(
        base + (next ? "?cursor=" + encodeURIComponent(next) : ""),
      );
      setHistory((h) => (next ? [...h, ...p.items] : p.items));
      setHistoryCursor(p.nextCursor);
    },
    [base, demo, request],
  );
  const load = useCallback(
    async (row: Row, next?: string) => {
      if (demo) return;
      const epoch = ++loadEpoch.current;
      try {
        if (mode === "hygiene") {
          const job = await request(base + "/" + row.id);
          if (epoch !== loadEpoch.current) return;
          setSelected(job);
          if (job.status !== "Completed") {
            setItems([]);
            setCursor(null);
            return;
          }
          const p = await request(
            base +
              "/" +
              row.id +
              "/findings" +
              (next ? "?cursor=" + encodeURIComponent(next) : ""),
          );
          if (epoch !== loadEpoch.current) return;
          setItems((i) => (next ? [...i, ...p.items] : p.items));
          setCursor(p.nextCursor);
        } else {
          const p = await request(
            base +
              "/" +
              row.id +
              "/messages" +
              (next ? "?cursor=" + encodeURIComponent(next) : ""),
          );
          if (epoch !== loadEpoch.current) return;
          setSelected(p.conversation || row);
          if (epoch !== loadEpoch.current) return;
          setItems((i) => (next ? [...i, ...p.items] : p.items));
          setCursor(p.nextCursor);
        }
      } catch (error) {
        if (epoch === loadEpoch.current) {
          setItems([]);
          setSelected(null);
        }
        throw error;
      }
    },
    [base, demo, mode, request],
  );
  useEffect(() => {
    setSelected(null);
    setItems([]);
    setError("");
    if (demo) {
      setHistory([]);
      return;
    }
    let alive = true;
    loadHistory().catch((e) => {
      if (alive) setError(e.message);
    });
    if (mode === "assistant")
      request("/lead-assistant/index")
        .then((v) => {
          if (alive) setIndex(v);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    return () => {
      alive = false;
    };
  }, [demo, mode, loadHistory, request]);
  const pending =
    selected &&
    (mode === "hygiene"
      ? ["Pending", "Running"].includes(selected.status) ||
        selected.summaryStatus === "Pending"
      : items.some((i) => i.status === "Pending"));
  useEffect(() => {
    if (!pending || !selected || demo) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      if (alive)
        load(selected)
          .then(() => loadHistory())
          .catch((e) => {
            if (alive) setError(e.message);
          });
    }, 5000);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [pending, selected, items, demo, load, loadHistory]);
  useEffect(() => {
    if (demo || !selected) return;
    const refresh = () => {
      void load(selected).catch((e) => setError(e.message));
    };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [demo, selected, load]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      if ((e as any).status === 403 || (e as any).code === "STALE_ACCESS") {
        setItems([]);
        setSelected(null);
        setHistory([]);
      }
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    await run(async () => {
      const row = await request(
        base,
        "POST",
        mode === "hygiene" ? { includeArchived } : {},
        crypto.randomUUID(),
      );
      setSelected(row);
      setItems([]);
      setCursor(null);
      await loadHistory();
      if (mode === "hygiene") await load(row);
    });
  }
  return (
    <div className="research-page" data-dt-mask>
      <header className="page-heading">
        <div>
          <span className="eyebrow">
            {mode === "hygiene"
              ? "WORKSPACE QUALITY"
              : "WORKSPACE LEAD DATA ONLY"}
          </span>
          <h1>{mode === "hygiene" ? "Lead Hygiene" : "Lead Assistant"}</h1>
          <p>
            {mode === "hygiene"
              ? "Review shared contacts, missing details and potential archive candidates."
              : "Ask about your leads. Counts use exact analytics; note insights cite retrieved evidence."}
          </p>
        </div>
        <button
          className="button primary"
          disabled={busy || demo || (mode === "hygiene" && !canRun)}
          onClick={() => void create()}
        >
          <Plus size={18} />
          {mode === "hygiene" ? "Run scan" : "New chat"}
        </button>
      </header>
      <ErrorMessage error={error} />
      {mode === "hygiene" ? (
        <label className="report-setting-option">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          Include archived leads in a separate review group
        </label>
      ) : null}
      {demo ? (
        <section className="panel">
          <ShieldCheck />
          <h2>Synthetic preview</h2>
          <p>
            Live scans and AI requests are disabled in the demo. Reports use
            your current lead permissions; AI cannot change leads.
          </p>
          <div className="research-finding">
            <strong>Shared phone number</strong>
            <p>
              Example: two separate enquiries share a contact. Review both
              records before deciding whether they are duplicates.
            </p>
          </div>
          <div className="research-finding">
            <strong>Evidence-based answers</strong>
            <p>
              Example: “How many leads converted last month?” uses recorded
              stage changes and the Admin’s outcome settings.
            </p>
          </div>
        </section>
      ) : (
        <div className="research-layout">
          <aside className="panel research-history">
            <div className="section-heading">
              <h2>{mode === "hygiene" ? "Previous reports" : "Your chats"}</h2>
              <button
                className="icon-button"
                aria-label="Refresh history"
                onClick={() => void run(() => loadHistory())}
              >
                <RefreshCw size={18} />
              </button>
            </div>
            {!history.length ? (
              <p>No {mode === "hygiene" ? "reports" : "chats"} yet.</p>
            ) : (
              history.map((row) => (
                <button
                  key={row.id}
                  className={
                    "research-history-item " +
                    (selected?.id === row.id ? "active" : "")
                  }
                  onClick={() =>
                    void run(async () => {
                      await load(row);
                      if (window.innerWidth < 900)
                        document
                          .querySelector(".research-results")
                          ?.scrollIntoView({ block: "start" });
                    })
                  }
                >
                  <strong>
                    {mode === "hygiene" ? row.status : "Lead conversation"}
                  </strong>
                  <small>{new Date(row.createdAt).toLocaleString()}</small>
                  {row.scanned != null ? (
                    <span>{row.scanned} leads reviewed</span>
                  ) : null}
                </button>
              ))
            )}
            {historyCursor ? (
              <button
                className="button"
                onClick={() => void run(() => loadHistory(historyCursor))}
              >
                Earlier history
              </button>
            ) : null}
          </aside>
          <section className="panel research-results" aria-live="polite">
            {selected ? (
              <>
                <div className="section-heading">
                  <div>
                    <h2>
                      {mode === "hygiene"
                        ? "Review findings"
                        : "Lead conversation"}
                    </h2>
                    <p>
                      {mode === "hygiene"
                        ? `${selected.status}${selected.scanned != null ? " · " + selected.scanned + " leads reviewed" : ""}`
                        : "Private to your account · read-only"}
                    </p>
                  </div>
                  {admin || mode === "assistant" ? (
                    <button
                      className="icon-button"
                      aria-label={
                        mode === "hygiene" ? "Delete report" : "Delete chat"
                      }
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Delete this " +
                              (mode === "hygiene" ? "report" : "chat") +
                              " and its saved details? This does not delete any leads.",
                          )
                        )
                          void run(async () => {
                            await request(base + "/" + selected.id, "DELETE", {
                              expectedVersion: selected.version,
                            });
                            setSelected(null);
                            setItems([]);
                            await loadHistory();
                          });
                      }}
                    >
                      <Trash2 size={18} />
                    </button>
                  ) : null}
                </div>
                {mode === "hygiene" ? (
                  <>
                    <p className="muted">
                      Reports cover active leads within your access. Data
                      changes make saved reports stale. Shared contacts are
                      review signals, not automatic duplicates.
                    </p>
                    {selected.findings != null ? (
                      <p>
                        <strong>{selected.findings} findings</strong>
                        {selected.activeScanned != null
                          ? " · " + selected.activeScanned + " active leads"
                          : ""}
                        {selected.includeArchived
                          ? " · " + selected.archivedScanned + " archived leads"
                          : ""}
                      </p>
                    ) : null}
                    {selected.completedAt ? (
                      <small>
                        Observation window:{" "}
                        {new Date(selected.createdAt).toLocaleString()} to{" "}
                        {new Date(selected.completedAt).toLocaleString()}.
                        Source changes invalidate this report.
                      </small>
                    ) : null}
                    {selected.archiveReviewConfigured === false ? (
                      <p>
                        Archive review is not configured. An Admin can choose
                        eligible stages and an inactivity threshold in Lead
                        research settings.
                      </p>
                    ) : null}
                    {selected.status === "Stale" ? (
                      <p>
                        Lead data, settings or access changed. Run a new scan
                        for current findings.
                      </p>
                    ) : pending ? (
                      <p role="status">
                        Scanning in resumable pages. You can leave this page and
                        return later.
                      </p>
                    ) : null}
                    {selected.status === "Completed" &&
                    !items.length &&
                    !cursor ? (
                      <p>No findings on this page.</p>
                    ) : null}
                    {items.map((f) => (
                      <article className="research-finding" key={f.id}>
                        <h3>
                          {f.kind === "SharedContact"
                            ? `Shared ${f.field} · ${f.count} leads`
                            : "Details to review"}
                        </h3>
                        {f.archived ? <p>Archived enquiries</p> : null}
                        {f.comparison ? <p>{f.comparison}</p> : null}
                        {f.archiveEvidence ? (
                          <p>
                            Last recorded contact:{" "}
                            {new Date(
                              f.archiveEvidence.lastContactAt,
                            ).toLocaleDateString()}
                            . Threshold: {f.archiveEvidence.inactivityDays}{" "}
                            days. No blocking pending task.
                          </p>
                        ) : null}
                        {f.value ? <p className="mono">{f.value}</p> : null}
                        {f.issues ? (
                          <p>
                            {f.issues
                              .map((s: string) => issueLabel[s] || s)
                              .join(" · ")}
                          </p>
                        ) : null}
                        <ul>
                          {f.leads?.map((l: Row) => (
                            <li key={l.id}>
                              <a href={"/leads/" + encodeURIComponent(l.id)}>
                                {l.name || "Unnamed enquiry"}
                              </a>
                              {l.company ? " · " + l.company : ""}
                              {l.stage ? (
                                <small>
                                  {l.stage}
                                  {l.source ? " · " + l.source : ""}
                                  {l.imported ? " · Imported enquiry" : ""}
                                </small>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                        {f.count > (f.leads?.length || 0) ? (
                          <button
                            className="button"
                            onClick={() =>
                              void run(async () => {
                                const p = await request(
                                  base +
                                    "/" +
                                    selected.id +
                                    "/findings/" +
                                    f.id +
                                    "/leads",
                                );
                                setItems((rows) =>
                                  rows.map((r) =>
                                    r.id === f.id
                                      ? {
                                          ...r,
                                          leads: p.items,
                                          moreCursor: p.nextCursor,
                                        }
                                      : r,
                                  ),
                                );
                              })
                            }
                          >
                            View matching leads
                          </button>
                        ) : null}
                        {f.moreCursor ? (
                          <button
                            className="button"
                            onClick={() =>
                              void run(async () => {
                                const p = await request(
                                  base +
                                    "/" +
                                    selected.id +
                                    "/findings/" +
                                    f.id +
                                    "/leads?cursor=" +
                                    encodeURIComponent(f.moreCursor),
                                );
                                setItems((rows) =>
                                  rows.map((r) =>
                                    r.id === f.id
                                      ? {
                                          ...r,
                                          leads: [...r.leads, ...p.items],
                                          moreCursor: p.nextCursor,
                                        }
                                      : r,
                                  ),
                                );
                              })
                            }
                          >
                            More matching leads
                          </button>
                        ) : null}
                      </article>
                    ))}
                    {canAI && selected.status === "Completed" ? (
                      <button
                        className="button"
                        disabled={busy || selected.summaryStatus === "Pending"}
                        onClick={() =>
                          void run(async () => {
                            const j = await request(
                              base + "/" + selected.id + "/summary",
                              "POST",
                              { expectedVersion: selected.version },
                            );
                            setSelected(j);
                          })
                        }
                      >
                        <Sparkles size={17} />
                        Summarize findings
                      </button>
                    ) : null}
                    {selected.summaryStatus === "Pending" ? (
                      <p>Summary requested. Refresh this report shortly.</p>
                    ) : null}
                    {selected.summaryStatus === "Failed" ? (
                      <p>
                        The AI summary is unavailable. Your deterministic report
                        is preserved.
                      </p>
                    ) : null}
                    {selected.summary?.themes?.map((t: Row, i: number) => (
                      <blockquote key={i}>
                        <strong>{t.label}</strong>
                        {t.evidence.map((e: Row, j: number) => (
                          <p key={j}>{e.quote}</p>
                        ))}
                      </blockquote>
                    ))}
                  </>
                ) : (
                  <>
                    {[...items]
                      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                      .map((r) => (
                        <article className="research-message" key={r.id}>
                          <h3>You</h3>
                          <p>{r.question}</p>
                          <h3>
                            <MessageSquare size={16} /> Lead Assistant
                          </h3>
                          <p>
                            {r.status === "Pending"
                              ? "Working through your accessible records…"
                              : r.answer?.text ||
                                "This request is no longer current. Ask again."}
                          </p>
                          {r.answer?.coverage ? (
                            <small>
                              {r.answer.coverage.scanned} active leads scanned ·{" "}
                              {r.answer.coverage.timezone} · as of{" "}
                              {new Date(
                                r.answer.coverage.asOf,
                              ).toLocaleString(undefined,{timeZone:r.answer.coverage.timezone})}
                              {r.answer.coverage.window
                                ? " · " +
                                  r.answer.coverage.window.startDate +
                                  " to " +
                                  r.answer.coverage.window.endDate +
                                  " (end exclusive)"
                                : ""}
                            </small>
                          ) : null}
                          {r.answer?.themes?.map((t: Row, i: number) => (
                            <blockquote key={i}>
                              <strong>{t.label}</strong>
                              {t.evidence.map((e: Row, j: number) => {
                                const source = r.answer.sources?.find(
                                  (s: Row) => s.id === e.sourceId,
                                );
                                return (
                                  <p key={j}>
                                    “{e.quote}”{" "}
                                    {source ? (
                                      <a
                                        href={
                                          "/leads/" +
                                          encodeURIComponent(source.leadId)
                                        }
                                      >
                                        {source.name}
                                      </a>
                                    ) : null}
                                  </p>
                                );
                              })}
                            </blockquote>
                          ))}
                        </article>
                      ))}
                    <form
                      className="research-composer"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void run(async () => {
                          await request(
                            base + "/" + selected.id + "/questions",
                            "POST",
                            { question },
                            crypto.randomUUID(),
                          );
                          setQuestion("");
                          await load(selected);
                          await loadHistory();
                        });
                      }}
                    >
                      <label htmlFor="lead-question">
                        Ask about your leads
                      </label>
                      <textarea
                        id="lead-question"
                        maxLength={1000}
                        minLength={3}
                        required
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="How many leads converted last month?"
                        disabled={busy || !!pending}
                      />
                      <button
                        className="button primary"
                        disabled={
                          busy || !!pending || question.trim().length < 3
                        }
                      >
                        Ask Lead Assistant
                      </button>
                      <small>
                        Lead data only. No general questions, web searches or
                        changes to records.
                      </small>
                    </form>
                  </>
                )}
                {cursor ? (
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => void run(() => load(selected, cursor))}
                  >
                    Load more
                  </button>
                ) : null}
              </>
            ) : (
              <div className="research-empty">
                <ShieldCheck size={32} />
                <h2>
                  {mode === "hygiene"
                    ? "Start with a full-list scan"
                    : "Ask a grounded question"}
                </h2>
                <p>
                  {mode === "hygiene"
                    ? "Run a scan or select a saved report. Nothing is archived or deleted automatically."
                    : "Create a private chat or open a previous one. Outcome questions use Admin-configured stage meanings."}
                </p>
              </div>
            )}
            {mode === "assistant" && index ? (
              <p className="muted">
                Knowledge index: {index.enabled ? index.status : "Disabled"}.{" "}
                {index.note}
                {admin && index.canManage ? (
                  <>
                    <br />
                    {index.pending || 0} source jobs pending ·{" "}
                    {index.failed || 0} failed{" "}
                    <button
                      className="button"
                      disabled={busy || !index.enabled}
                      onClick={() =>
                        void run(async () => {
                          await request("/lead-assistant/index", "POST", {});
                          setIndex(await request("/lead-assistant/index"));
                        })
                      }
                    >
                      Rebuild index
                    </button>
                  </>
                ) : null}
              </p>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
