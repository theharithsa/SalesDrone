import { useCallback, useEffect, useRef, useState } from "react";
import LeadAssistantView, {
  type AssistantMessage,
  type AssistantLeadRow,
} from "./LeadAssistantView";
type Row = Record<string, any>;
type Request = (p: string, m?: string, b?: any, k?: string) => Promise<any>;
export default function LeadAssistantPage({
  request,
  demo,
}: {
  request: Request;
  demo: boolean;
}) {
  const [history, setHistory] = useState<Row[]>([]),
    [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [chat, setChat] = useState<Row | null>(null),
    [rows, setRows] = useState<Row[]>([]),
    [cursor, setCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [results, setResults] = useState<
    Record<string, { items: AssistantLeadRow[]; nextCursor: string | null }>
  >({});
  const epoch = useRef(0),
    mounted = useRef(true),
    chatRef = useRef<Row | null>(null);
  const select = (value: Row | null) => {
    chatRef.current = value;
    setChat(value);
  };
  const historyPage = useCallback(
    async (next?: string) => {
      if (demo) return;
      const p = await request(
        "/lead-assistant/conversations" +
          (next ? "?cursor=" + encodeURIComponent(next) : ""),
      );
      if (mounted.current) {
        setHistory((h) => (next ? [...h, ...p.items] : p.items));
        setHistoryCursor(p.nextCursor);
      }
    },
    [demo, request],
  );
  const load = useCallback(
    async (row: Row, next?: string) => {
      const current = epoch.current;
      try {
        const p = await request(
          "/lead-assistant/conversations/" +
            row.id +
            "/messages" +
            (next ? "?cursor=" + encodeURIComponent(next) : ""),
        );
        if (!mounted.current || current !== epoch.current) return;
        select(p.conversation || row);
        setRows((old) => (next ? [...old, ...p.items] : p.items));
        setCursor(p.nextCursor);
        if (!next)
          setResults((old) =>
            Object.fromEntries(
              Object.entries(old).filter(([id]) =>
                p.items.some(
                  (r: Row) => r.id === id && r.status === "Completed",
                ),
              ),
            ),
          );
      } catch (e) {
        if (mounted.current && current === epoch.current) {
          setRows([]);
          setResults({});
          setError((e as Error).message);
        }
      }
    },
    [request],
  );
  useEffect(() => {
    mounted.current = true;
    void historyPage().catch((e) => setError(e.message));
    return () => {
      mounted.current = false;
    };
  }, [historyPage]);
  const pending = rows.find((r) => r.status === "Pending");
  const pendingId = pending?.id;
  useEffect(() => {
    if (!chat || demo) return;
    const refresh = () => void load(chat);
    const timer = window.setInterval(refresh, pendingId ? 3000 : 30000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [chat, demo, load, pendingId]);
  const run = async (fn: () => Promise<void>) => {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const send = (question: string) =>
    void run(async () => {
      if (demo) {
        setError("Live AI is disabled in the synthetic demo.");
        return;
      }
      const turn = epoch.current;
      let current = chatRef.current;
      if (!current) {
        current = await request(
          "/lead-assistant/conversations",
          "POST",
          {},
          crypto.randomUUID(),
        );
        if (turn !== epoch.current) return;
        select(current);
      }
      const id = current!.id;
      await request(
        "/lead-assistant/conversations/" + id + "/questions",
        "POST",
        { question },
        crypto.randomUUID(),
      );
      if (turn !== epoch.current) return;
      setDraft("");
      await load(current!);
      await historyPage();
    });
  const messages: AssistantMessage[] = [...rows]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .flatMap((r) => {
      const answer = r.answer;
      const groupText = answer?.groups
        ? Object.entries(answer.groups)
            .map(([label, count]) => `${label}: ${count}`)
            .join("\n")
        : "";
      const overflow = answer?.groupOverflow
        ? `Other values beyond the first 100 groups: ${answer.groupOverflow}`
        : "";
      const themes = (answer?.themes || []).map((t: Row) => t.label).join("\n");
      const evidence = (answer?.themes || []).flatMap(
        (t: Row) => t.evidence || [],
      );
      return [
        { id: r.id + "-q", role: "user" as const, text: r.question || "" },
        {
          id: r.id,
          role: "assistant" as const,
          text:
            r.status === "Pending"
              ? "Checking your accessible records…"
              : [
                  answer?.text || "This answer is unavailable. Ask again.",
                  groupText,
                  overflow,
                  themes,
                ]
                  .filter(Boolean)
                  .join("\n\n"),
          scope: [
            answer?.coverage?.cohort,
            ...(answer?.coverage?.filterSummary || []),
          ]
            .filter(Boolean)
            .join(" · "),
          period: answer?.coverage?.window
            ? `${answer.coverage.window.startDate} to ${answer.coverage.window.endDate} (end excluded) · ${answer.coverage.timezone}`
            : undefined,
          leads: results[r.id]?.items,
          sources: (answer?.sources || []).map((s: Row) => ({
            id: s.id,
            label: s.name,
            excerpt:
              evidence
                .filter((e: Row) => e.sourceId === s.id)
                .map((e: Row) => e.quote)
                .join("\n") || s.text,
          })),
          ...(answer?.hasResults
            ? {
                resultRequestId: r.id,
                resultCount: answer.count,
                resultsLoaded: !!results[r.id],
                hasMoreResults: !!results[r.id]?.nextCursor,
              }
            : {}),
          ...(answer?.state === "Clarify"
            ? {
                fieldLabels: (answer.fields || []).map(
                  (f: Row) =>
                    f.label +
                    (f.options?.length ? ": " + f.options.join(", ") : ""),
                ),
              }
            : {}),
        },
      ];
    });
  return (
    <LeadAssistantView
      messages={messages}
      draft={draft}
      onDraft={setDraft}
      onSend={send}
      busy={busy || !!pending}
      error={error}
      scopeLabel={
        demo ? "Synthetic demo · live AI disabled" : "Your current lead access"
      }
      history={history.map((h) => ({
        id: h.id,
        title:
          h.status === "Stale"
            ? "Chat · access changed"
            : "Chat · " + new Date(h.createdAt).toLocaleDateString(),
        updatedAt: new Date(h.updatedAt).toLocaleString(),
      }))}
      onNewChat={() => {
        epoch.current++;
        select(null);
        setRows([]);
        setResults({});
        setDraft("");
        setError("");
      }}
      onSelectChat={(id) => {
        epoch.current++;
        setRows([]);
        setResults({});
        select({ id });
        void load({ id });
      }}
      onClarify={(value) => setDraft(value)}
      onCancel={
        pending
          ? () =>
              void run(async () => {
                await request(
                  "/lead-assistant/requests/" + pending.id + "/cancel",
                  "POST",
                  { expectedVersion: pending.version },
                );
                if (chatRef.current) await load(chatRef.current);
              })
          : undefined
      }
      onDeleteChat={
        chat
          ? () =>
              void run(async () => {
                await request(
                  "/lead-assistant/conversations/" + chat.id,
                  "DELETE",
                  { expectedVersion: chat.version },
                );
                epoch.current++;
                select(null);
                setRows([]);
                setResults({});
                await historyPage();
              })
          : undefined
      }
      onMoreHistory={
        historyCursor
          ? () => void run(() => historyPage(historyCursor))
          : undefined
      }
      onEarlier={
        cursor && chat ? () => void run(() => load(chat, cursor)) : undefined
      }
      onLoadResults={(id) =>
        void run(async () => {
          const current = epoch.current,
            old = results[id];
          const p = await request(
            "/lead-assistant/requests/" +
              id +
              "/leads" +
              (old?.nextCursor
                ? "?cursor=" + encodeURIComponent(old.nextCursor)
                : ""),
          );
          if (current === epoch.current)
            setResults((r) => ({
              ...r,
              [id]: {
                items: [...(old?.items || []), ...p.items],
                nextCursor: p.nextCursor,
              },
            }));
        })
      }
    />
  );
}
