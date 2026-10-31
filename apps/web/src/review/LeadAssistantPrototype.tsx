/** Design proposal only: fictional records, local interactions, no API or AI transport. */
import { useEffect, useRef, useState } from "react";
import LeadAssistantView, {
  type AssistantMessage,
  type AssistantLeadRow,
} from "../features/LeadAssistantView";
const leads: AssistantLeadRow[] = [
  {
    id: "synthetic-alex",
    name: "Alex Morgan",
    company: "Fictional North Supplies",
    stage: "Quoted",
    detail: "Tue, 3 Nov",
  },
  {
    id: "synthetic-jordan",
    name: "Jordan Lee",
    company: "Fictional Partner Enquiry",
    stage: "Interested",
    detail: "Thu, 5 Nov",
  },
  {
    id: "synthetic-taylor",
    name: "Taylor Brooks",
    company: "Fictional Trading",
    stage: "Samples sent",
    detail: "Fri, 6 Nov",
  },
];
export default function LeadAssistantPrototype() {
  const [messages, setMessages] = useState<AssistantMessage[]>([]),
    [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const answer = (text: string) => {
    if (/next week|call|follow.up/i.test(text))
      return {
        id: crypto.randomUUID(),
        role: "assistant" as const,
        text: "Three leads have recorded outreach reminders next week.",
        scope: "Your pending outreach reminders · assigned leads",
        period: "2–8 Nov 2026 · Asia/Kolkata",
        leads,
        sources: leads.map((lead) => ({
          id: lead.id,
          label: lead.name + " · recorded reminder",
          excerpt:
            "Fictional Pending outreach reminder due " +
            lead.detail +
            ". Lead is eligible for outreach.",
        })),
      };
    if (/approv|order/i.test(text))
      return {
        id: crypto.randomUUID(),
        role: "assistant" as const,
        text: "Which configured field should define an approved order?",
        clarifications: [
          "Sales stage → Order approved",
          "Enquiry status → Approved",
        ],
      };
    if (/convert/i.test(text))
      return {
        id: crypto.randomUUID(),
        role: "assistant" as const,
        text: "12 leads have a recorded conversion this month.",
        scope: "Your accessible active leads",
        period: "1–31 Oct 2026 · Asia/Kolkata",
        sources: [
          {
            id: "synthetic-transitions",
            label: "Recorded stage transitions",
            excerpt:
              "Synthetic demonstration: distinct entries into the configured converted group. Imported history may be incomplete; creation dates are not conversion dates.",
          },
        ],
      };
    return {
      id: crypto.randomUUID(),
      role: "assistant" as const,
      text: "Pricing and delivery questions appear in the retrieved notes. These are reported themes, not proven causes or whole-cohort prevalence.",
      scope: "Configured failed stages · source-verified sample",
      sources: [
        {
          id: "synthetic-note",
          label: "Fictional discussion note",
          excerpt:
            "The buyer asked for revised pricing and confirmation of delivery before deciding.",
        },
      ],
    };
  };
  const send = (question: string) => {
    setDraft("");
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "user", text: question },
    ]);
    setBusy(true);
    timer.current = setTimeout(() => {
      setMessages((m) => [...m, answer(question)]);
      setBusy(false);
    }, 500);
  };
  const reset = () => {
    if (timer.current) clearTimeout(timer.current);
    setBusy(false);
    setMessages([]);
    setDraft("");
  };
  return (
    <div
      className="assistant-prototype"
      style={{ padding: "clamp(16px,3vw,32px)" }}
    >
      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px" }}>
        Design proposal · fictional records and dates · no live queries or AI
      </p>
      <LeadAssistantView
        onOpenLead={() => {}}
        messages={messages}
        draft={draft}
        onDraft={setDraft}
        onSend={send}
        onNewChat={reset}
        busy={busy}
        onCancel={() => {
          if (timer.current) clearTimeout(timer.current);
          setBusy(false);
        }}
        scopeLabel="Your assigned leads"
        history={[
          {
            id: "calls",
            title: "Calls next week",
            updatedAt: "Fictional saved chat",
          },
          {
            id: "patterns",
            title: "Patterns in failed leads",
            updatedAt: "Fictional saved chat",
          },
        ]}
        onSelectChat={(id) => {
          setMessages([
            {
              id: "history-user",
              role: "user",
              text:
                id === "calls"
                  ? "List the leads I need to call next week"
                  : "What patterns appear in failed lead notes?",
            },
            answer(id === "calls" ? "next week" : "patterns"),
          ]);
        }}
        onClarify={(field) =>
          setMessages((m) => [
            ...m,
            { id: crypto.randomUUID(), role: "user", text: field },
            {
              id: crypto.randomUUID(),
              role: "assistant",
              text: "Two leads match that configured approval value.",
              scope: "Your assigned leads · " + field,
              leads: leads.slice(0, 2).map((lead) => ({
                ...lead,
                stage: "Order approved",
                detail: "Current value",
              })),
            },
          ])
        }
      />
    </div>
  );
}
