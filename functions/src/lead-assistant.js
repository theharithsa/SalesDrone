import {
  AgentPlan,
  assistantFields,
  validateAgentPlan,
  agentPage,
  agentAnswer,
  matchesAgentLead,
} from "./lead-assistant-tools.js";
import { RESEARCH_TASK_EPOCH_PATH } from "./lead-research-store.js";
import { readFieldOptions } from "./field-options.js";
import { z } from "zod";
import { AppError } from "./contracts.js";
import { path, hash, scopeFilters, canReadLead } from "./policy.js";
import { documentKey } from "./store.js";
import { researchMember, researchAccessKey } from "./lead-research-access.js";
import {
  readResearchSettings,
  calendarMonthWindow,
  reportingDate,
} from "./lead-research-settings.js";
import { scanEpoch } from "./lead-hygiene.js";
import { retrieveEvidence } from "./lead-research-index.js";
export const ConversationInput = z.object({}).strict();
export const QuestionInput = z
  .object({ question: z.string().trim().min(3).max(1000) })
  .strict();
const LegacyPlan = z
  .object({
    intent: z.enum([
      "total",
      "current_converted",
      "current_failed",
      "month_converted",
      "failure_patterns",
      "lead_insights",
      "out_of_scope",
      "clarify",
    ]),
    monthOffset: z.number().int().min(-120).max(0),
  })
  .strict();
export const AssistantPlan = z.union([AgentPlan, LegacyPlan]);
export const AssistantThemes = z
  .object({
    themes: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(120),
            evidence: z
              .array(
                z
                  .object({
                    sourceId: z.string().max(200),
                    quote: z.string().trim().min(5).max(500),
                  })
                  .strict(),
              )
              .min(1)
              .max(3),
          })
          .strict(),
      )
      .max(4),
  })
  .strict();
const notFound = () => new AppError(404, "NOT_FOUND", "Conversation not found");
export async function readConversation(store, identity, id) {
  const m = await researchMember(store, identity, ["assistant:query"]);
  const c = await store.get(path("assistantConversations", id));
  if (!c || c.ownerUid !== m.uid || c.status === "Deleting") throw notFound();
  if (c.access !== researchAccessKey(m))
    throw new AppError(
      409,
      "STALE_ACCESS",
      "Access changed. Start a new conversation.",
    );
  return c;
}
export async function createConversation(tx, identity, id, at) {
  const m = await researchMember(tx, identity, ["assistant:query"]);
  const c = {
    id,
    ownerUid: m.uid,
    access: researchAccessKey(m),
    status: "Active",
    version: 1,
    createdAt: at,
    updatedAt: at,
  };
  tx.set(path("assistantConversations", id), c);
  return c;
}
export async function createQuestion(
  tx,
  identity,
  conversationId,
  input,
  id,
  at,
  traceparent = null,
) {
  const c = await readConversation(tx, identity, conversationId);
  const pending = await tx.query(path("assistantRequests"), {
    filters: [
      ["jobId", "==", c.id],
      ["status", "==", "Pending"],
    ],
    limit: 1,
  });
  const currentEpoch = await scanEpoch(tx);
  if (pending.some((r) => r.epoch === currentEpoch && r.access === c.access))
    throw new AppError(409, "REQUEST_PENDING", "Wait for the current answer");
  const recent = await tx.query(path("assistantRequests"), {
    filters: [["ownerUid", "==", c.ownerUid]],
    order: "createdAt",
    direction: "desc",
    limit: 10,
  });
  if (
    recent.filter((r) => Date.parse(at) - Date.parse(r.createdAt) < 60000)
      .length >= 5
  )
    throw new AppError(
      429,
      "RATE_LIMIT",
      "Please wait before asking another question",
    );
  const config = await readResearchSettings(tx),
    fields = await readFieldOptions(tx);
  const request = {
    id,
    jobId: c.id,
    ownerUid: c.ownerUid,
    access: c.access,
    epoch: currentEpoch,
    taskEpoch: (await tx.get(RESEARCH_TASK_EPOCH_PATH))?.version || 0,
    settingsVersion: config.version,
    fieldsVersion: fields.version,
    traceparent,
    question: input.question,
    status: "Pending",
    phase: "Plan",
    after: null,
    scanned: 0,
    total: 0,
    converted: 0,
    failed: 0,
    monthlyConverted: 0,
    version: 1,
    createdAt: at,
    updatedAt: at,
  };
  tx.set(path("assistantRequests", id), request);
  tx.set(path("assistantConversations", c.id), {
    ...c,
    version: c.version + 1,
    updatedAt: at,
  });
  return { id, status: "Pending", jobId: c.id };
}
export async function readAssistantRequest(store, identity, id) {
  const m = await researchMember(store, identity, ["assistant:query"]);
  const r = await store.get(path("assistantRequests", id));
  if (!r || r.ownerUid !== m.uid) throw notFound();
  await readConversation(store, identity, r.jobId);
  if (r.access !== researchAccessKey(m))
    throw new AppError(409, "STALE_ACCESS", "Access changed. Ask again.");
  if (
    r.epoch !== (await scanEpoch(store)) ||
    ((r.agentPlan?.tool === "find_own_followups" ||
      r.agentPlan?.tool === "read_hygiene_findings") &&
      r.taskEpoch !==
        ((await store.get(RESEARCH_TASK_EPOCH_PATH))?.version || 0)) ||
    (await readResearchSettings(store)).version !== r.settingsVersion ||
    (await readFieldOptions(store)).version !== r.fieldsVersion
  )
    return {
      id: r.id,
      jobId: r.jobId,
      question: r.question,
      status: "Stale",
      answer: {
        state: "Partial",
        text: "Lead data or reporting settings changed. Ask again for current results.",
      },
    };
  return r;
}
async function context(tx, r) {
  const m = await researchMember(
    tx,
    { uid: r.ownerUid },
    ["assistant:query"],
    r.access,
  );
  const c = await tx.get(path("assistantConversations", r.jobId));
  if (!c || c.status === "Deleting") throw notFound();
  const config = await readResearchSettings(tx);
  if (
    (await scanEpoch(tx)) !== r.epoch ||
    (["find_own_followups", "read_hygiene_findings"].includes(
      r.agentPlan?.tool,
    ) &&
      r.taskEpoch !==
        ((await tx.get(RESEARCH_TASK_EPOCH_PATH))?.version || 0)) ||
    config.version !== r.settingsVersion ||
    (await readFieldOptions(tx)).version !== r.fieldsVersion
  )
    throw new AppError(409, "STALE_SOURCE", "Lead data changed. Ask again.");
  return { m, config };
}
export async function processAssistantRequest({
  store,
  id,
  provider,
  now = () => new Date().toISOString(),
}) {
  const r = await store.get(path("assistantRequests", id));
  if (!r || r.status !== "Pending") return { processed: 0 };
  let ctx;
  try {
    ctx = await store.run((tx) => context(tx, r));
  } catch (e) {
    if (
      ![
        "FORBIDDEN",
        "DEMO_ONLY",
        "STALE_ACCESS",
        "STALE_SOURCE",
        "NOT_FOUND",
      ].includes(e.code)
    )
      throw e;
    await store.run(async (tx) => {
      const current = await tx.get(path("assistantRequests", id));
      if (current?.status === "Pending")
        tx.set(path("assistantRequests", id), {
          ...current,
          status: "Stale",
          answer: null,
          version: current.version + 1,
          updatedAt: now(),
        });
    });
    return { processed: 0, stale: 1 };
  }
  const publish = async (answer) =>
    store.run(async (tx) => {
      const current = await tx.get(path("assistantRequests", id));
      if (current?.version !== r.version) return { processed: 0 };
      await context(tx, current);
      tx.set(path("assistantRequests", id), {
        ...current,
        status: "Completed",
        answer,
        version: current.version + 1,
        updatedAt: now(),
      });
      return { processed: 1, completed: 1 };
    });
  const { config } = ctx;
  if (r.phase === "Plan") {
    const previous = await store.query(path("assistantRequests"), {
      filters: [["jobId", "==", r.jobId]],
      order: "createdAt",
      direction: "desc",
      limit: 5,
    });
    const history = previous
      .filter(
        (p) =>
          p.id !== r.id &&
          p.epoch === r.epoch &&
          p.access === r.access &&
          p.settingsVersion === r.settingsVersion &&
          p.fieldsVersion === r.fieldsVersion &&
          p.status === "Completed",
      )
      .slice(0, 4)
      .map((p) => ({ question: p.question, plan: p.agentPlan || p.plan }));
    if (
      !history.length &&
      /\b(only those|what about those|same leads)\b/i.test(r.question)
    )
      return publish({
        state: "Clarify",
        text: "Which lead group should I refine? Please state the field and value or start from a current query.",
      });
    const plan = AssistantPlan.parse(
      await provider.plan({
        question: r.question,
        history,
        timezone: config.timezone,
        asOf: r.createdAt,
        fields: assistantFields(await readFieldOptions(store)),
        outcomes: {
          converted: config.convertedStages,
          failed: config.failedStages,
        },
      }),
    );
    if (plan.tool) {
      if (plan.tool === "out_of_scope")
        return publish({
          state: "OutOfScope",
          text: "I can only read and explain accessible lead data. I cannot answer general questions or change records.",
        });
      if (plan.tool === "clarify")
        return publish({
          state: "Clarify",
          text: "Please specify the lead field, value or recorded date you mean. Approval must refer to a configured field; reminder questions use your own recorded outreach tasks.",
          fields: assistantFields(await readFieldOptions(store)),
        });
      let agentPlan;
      try {
        agentPlan = validateAgentPlan(
          plan,
          await readFieldOptions(store),
          config,
          r.createdAt,
          r.question,
          history,
        );
      } catch (e) {
        if (e.code !== "AGENT_CLARIFY") throw e;
        return publish({
          state: "Clarify",
          text: e.message,
          fields: assistantFields(await readFieldOptions(store)),
        });
      }
      return store.run(async (tx) => {
        const current = await tx.get(path("assistantRequests", id));
        if (current?.version !== r.version) return { processed: 0 };
        await context(tx, { ...current, agentPlan });
        tx.set(path("assistantRequests", id), {
          ...current,
          agentPlan,
          phase: agentPlan.tool === "retrieve_evidence" ? "Answer" : "Tools",
          matched: 0,
          groups: {},
          version: r.version + 1,
          updatedAt: now(),
        });
        return { processed: 1 };
      });
    }
    if (plan.intent === "out_of_scope")
      return publish({
        state: "OutOfScope",
        text: "I can answer questions about leads in this workspace. I cannot answer general questions or change data.",
      });
    if (plan.intent === "clarify")
      return publish({
        state: "Clarify",
        text: "Please ask about lead counts, conversions in a calendar month, failed leads, or patterns in recorded lead notes.",
      });
    const fields = await readFieldOptions(store);
    const outcomeStages = ["current_converted", "month_converted"].includes(
      plan.intent,
    )
      ? config.convertedStages
      : ["current_failed", "failure_patterns"].includes(plan.intent)
        ? config.failedStages
        : [];
    if (outcomeStages.some((stage) => !fields.values.stage.includes(stage)))
      return publish({
        state: "Insufficient",
        text: "Setup required: reporting stage mappings include retired choices. An Admin must review Lead research settings.",
      });
    if (
      (["current_converted", "month_converted"].includes(plan.intent) &&
        !config.convertedStages.length) ||
      (["current_failed", "failure_patterns"].includes(plan.intent) &&
        !config.failedStages.length)
    )
      return publish({
        state: "Insufficient",
        text: "Setup required: an Admin must choose converted and failed stages in Settings → Lead research.",
      });
    return store.run(async (tx) => {
      const current = await tx.get(path("assistantRequests", id));
      if (current?.version !== r.version) return { processed: 0 };
      await context(tx, current);
      tx.set(path("assistantRequests", id), {
        ...current,
        plan,
        window: calendarMonthWindow(
          r.createdAt,
          config.timezone,
          plan.monthOffset,
        ),
        phase: "Leads",
        version: r.version + 1,
        updatedAt: now(),
      });
      return { processed: 1 };
    });
  }
  if (r.phase === "Tools")
    return store.run(async (tx) => {
      const current = await tx.get(path("assistantRequests", id));
      if (current?.version !== r.version) return { processed: 0 };
      const { m } = await context(tx, current);
      const next = await agentPage(tx, current, m, config);
      tx.set(path("assistantRequests", id), {
        ...next,
        version: r.version + 1,
        updatedAt: now(),
      });
      return { processed: 1 };
    });
  if (r.agentPlan && r.agentPlan.tool !== "retrieve_evidence")
    return publish(agentAnswer(r, config));
  if (r.phase === "Leads" || r.phase === "Transitions")
    return store.run(async (tx) => {
      const current = await tx.get(path("assistantRequests", id));
      if (current?.version !== r.version) return { processed: 0 };
      const { m } = await context(tx, current);
      const rows = await tx.query(
        path(r.phase === "Leads" ? "leads" : "leadTransitions"),
        {
          filters:
            r.phase === "Leads"
              ? [...scopeFilters(m), ["archived", "==", false]]
              : [],
          order: "__name__",
          after: r.after ? [r.after] : undefined,
          limit: 100,
        },
      );
      const next = {
        ...r,
        version: r.version + 1,
        updatedAt: now(),
        after: rows.length ? documentKey(rows.at(-1)) : r.after,
      };
      if (r.phase === "Leads") {
        next.scanned += rows.length;
        next.total += rows.length;
        next.converted += rows.filter((l) =>
          config.convertedStages.includes(l.stage),
        ).length;
        next.failed += rows.filter((l) =>
          config.failedStages.includes(l.stage),
        ).length;
      } else {
        const transitions = rows.filter((t) => {
          const date = reportingDate(t.createdAt, config.timezone);
          return (
            t.from &&
            config.convertedStages.includes(t.to) &&
            !config.convertedStages.includes(t.from) &&
            date >= r.window.startDate &&
            date < r.window.endDate
          );
        });
        const ids = [...new Set(transitions.map((t) => t.leadId))],
          leads = await tx.getAll(ids.map((l) => path("leads", l))),
          seen = await tx.getAll(
            ids.map((l) => path("assistantContributions", id + "_" + hash(l))),
          );
        for (let i = 0; i < ids.length; i++)
          if (!seen[i] && canReadLead(m, leads[i]) && !leads[i].archived) {
            const key = id + "_" + hash(ids[i]);
            tx.set(path("assistantContributions", key), {
              id: key,
              jobId: r.jobId,
              requestId: id,
              leadId: ids[i],
            });
            next.monthlyConverted++;
          }
      }
      if (rows.length < 100) {
        next.phase =
          r.phase === "Leads" && r.plan?.intent === "month_converted"
            ? "Transitions"
            : "Answer";
        next.after = null;
      }
      tx.set(path("assistantRequests", id), next);
      return { processed: rows.length };
    });
  const coverage = {
    scanned: r.scanned,
    asOf: r.createdAt,
    timezone: config.timezone,
    cohort: "Currently active leads within your current access",
    ...(r.agentPlan?.filterSummary
      ? { filterSummary: r.agentPlan.filterSummary }
      : {}),
    ...(r.plan?.intent === "month_converted" ? { window: r.window } : {}),
  };
  const counts = {
    total: r.total,
    current_converted: r.converted,
    current_failed: r.failed,
    month_converted: r.monthlyConverted,
  };
  if (Object.hasOwn(counts, r.plan?.intent))
    return publish({
      state: r.plan?.intent === "month_converted" ? "Partial" : "Grounded",
      text:
        r.plan?.intent === "month_converted"
          ? `${r.monthlyConverted} distinct leads have a recorded conversion in this calendar month. Historical imports may lack conversion dates; this is an observed count, not a complete historical total.`
          : `${counts[r.plan?.intent]} ${r.plan?.intent === "total" ? "active leads" : r.plan?.intent === "current_failed" ? "leads in configured failed stages" : "leads in configured converted stages"}.`,
      count: counts[r.plan?.intent],
      coverage,
    });
  if (!config.indexingEnabled)
    return publish({
      state: "Insufficient",
      text: "The knowledge index is disabled. Ask an Admin to enable indexing in Settings → Lead research.",
      coverage,
    });
  const evidence = await retrieveEvidence({
    store,
    identity: { uid: r.ownerUid },
    access: r.access,
    question: r.question,
    embed: provider.embed,
    stages:
      r.plan?.intent === "failure_patterns" || r.agentPlan?.outcome === "failed"
        ? config.failedStages
        : r.agentPlan?.outcome === "converted"
          ? config.convertedStages
          : [],
    matchLead: (lead) =>
      !r.agentPlan || matchesAgentLead(lead, r.agentPlan, config),
  });
  if (!evidence.length)
    return publish({
      state: "Insufficient",
      text: "No current, accessible evidence was retrieved. The index may still be building, or these leads may have no relevant notes.",
      coverage,
    });
  await store.run((tx) => context(tx, r));
  const output = AssistantThemes.parse(
    await provider.themes({
      question: r.question,
      evidence: evidence.map(({ id, text }) => ({ id, text })),
    }),
  );
  const themes = output.themes.filter(
    (t) =>
      !/[0-9]/.test(t.label) &&
      t.evidence.every((e) =>
        evidence.some((s) => s.id === e.sourceId && s.text.includes(e.quote)),
      ),
  );
  if (!themes.length)
    return publish({
      state: "Insufficient",
      text: "The retrieved notes did not support a verified answer.",
      coverage,
    });
  return publish({
    state: "Partial",
    text:
      (r.plan?.intent === "failure_patterns"
        ? `${r.failed} active leads are in configured failed stages. `
        : "") +
      "Reported themes in retrieved notes. These are sampled observations, not proven causes or whole-cohort prevalence.",
    ...(r.plan?.intent === "failure_patterns" ? { count: r.failed } : {}),
    themes,
    coverage,
    sources: evidence
      .filter((source) =>
        themes.some((theme) =>
          theme.evidence.some((e) => e.sourceId === source.id),
        ),
      )
      .map(({ id, leadId, name, text }) => ({
        id,
        leadId,
        name,
        text,
      })),
    index: "Relevant current sources only; indexing may lag source changes.",
  });
}
