# Lead Assistant — agent experience and query plan

Status: **implemented locally for milestone v2.6.0**, issue #96. Production remains
2.5.3 until the verified PR is merged and deployed. The model proposes composable
read-only tools; deterministic server code executes them. Required integrated checks,
PR verification and deployment evidence gate publication.

## Product experience

Use a dedicated Assistant page with one centered conversation column, a calm welcome,
a few suggestion chips and a rounded primary composer. History opens from a compact
header action in a sheet. Index management stays in Settings. Results use brief text,
responsive lead rows/cards and collapsed source evidence. Preserve the existing
Google Sans/Manrope typography, Material colour/shape roles, themes and display zoom.

This follows the interaction hierarchy of Gemini while retaining SalesDrone branding.
No microphone, attachment or action button is added without a working capability.
The first version is read-only for leads/tasks; questions cannot call, schedule,
archive, merge, delete, message people or change their stage.

Primary references: [Material text fields](https://material-web.dev/components/text-field/),
[Material icon buttons](https://material-web.dev/components/icon-button/), and
[Material minimum target sizes](https://developer.android.com/develop/ui/compose/accessibility/api-defaults#minimum-touch-target-sizes).
Use accessible labels, a visible focus ring and comfortable touch targets. Enter sends;
Shift+Enter adds a line. Enter during IME composition must not send. Mobile composition
must remain usable with safe areas, navigation and the keyboard; browser emulation
alone does not certify a physical device.

## Answers to the requested examples

| Question | Data/tool | Truthfulness boundary |
| --- | --- | --- |
| Leads to call next week | Current member's Pending outreach tasks, resolved calendar window, current lead access and eligibility | Recorded reminders, not invented needs; no other member's private task data |
| Approved orders | Configured standard/custom lead field and matching values | Clarify when approval has no unique meaning; do not assume a separate Orders collection |
| Orders approved this month | Actual approval-date field or recorded qualifying transitions | Current value/updatedAt/import date cannot establish approval timing |
| Conversions last month | Complete scoped transition aggregation using configured outcomes | Distinct leads per calendar month; unknown imported history remains partial |
| Failure patterns | Exact configured failure cohort plus relevant versioned RAG sources | Retrieved themes are sampled reports, not proven causes or prevalence |
| Only those in a zone/product | Validated configured filters added to the structured conversation context | Preserve prior filters explicitly; never silently broaden the cohort |

For relative dates, resolve a real interval server-side using the appropriate saved
calendar/timezone settings and display its dates. A potentially ambiguous period or
business meaning produces a focused clarification. The Assistant does not guess
field meanings, missing dates, task ownership or events that were never recorded.

## Composable read-only tools

The model proposes a strict structured plan using only these operations:

1. `find_leads`: current configured standard/custom fields, supported AND filters and bounded stable-ID pages. Requested arbitrary rankings require clarification.
2. `find_own_followups`: private recorded tasks belonging to the current member, joined to currently eligible accessible leads.
3. `aggregate_leads`: exact count and supported field distributions over the complete authorized cohort.
4. `aggregate_stage_history`: observed transition analytics with explicit outcome mappings, calendar windows and coverage.
5. `retrieve_evidence`: bounded semantic retrieval with current source/access and requested-field checks; a sample, never a complete cohort.
6. `read_hygiene_findings`: the creator's current authorized report summary; record-level findings remain on Hygiene.

Every field, operator, value, date range, limit and tool is validated against the
current schema/policy. Identity, workspace and scope are server-derived. There is no
model-generated SQL, Firestore code, arbitrary path, script or general data endpoint.
Lists paginate through request-bound signed cursors. Counts never use vector top-k. Only requested tools execute; qualitative
questions do not require feeding the complete lead list to the model.

Follow-up questions reuse bounded structured query context and current source references.
Exact comparison values must be literal in the question or retained from a valid structured plan; ambiguous synonyms clarify. A missing/retired field or changed permission invalidates that context. Source selection
and list joins recheck assignment, archive/suppression/review eligibility, task ownership,
versions and deletion before prompts and publication. Each tool uses the existing
business/policy layer rather than creating a second definition of permissions.

## Result and clarification contract

Results can combine a concise statement, exact aggregate facts, paginated matching
leads, explicit scope/filters/date window and cited excerpts. Counts and IDs come from
validated server results. Unknowns are stated. Source links use server-derived internal
lead IDs; model-authored HTML or arbitrary external links are not rendered.

If approval could refer to multiple configured fields, present those actual field/value
choices. If a date or business meaning is unavailable, explain the missing input and
ask directly. Related questions with unavailable data receive an honest limitation;
unrelated general knowledge, secret requests and every mutation are declined.

Progress describes activity such as Checking records or Reading relevant notes, not
hidden model reasoning. Define cancellation in the versioned request API before
exposing Stop: it prevents later publication/work but cannot undo already-sent model
context. No source business write is performed by a question or cancellation.

## Privacy, retention and retrieval

Admins have access by default; member grants intersect current lead scope. Admin status
alone does not grant other people's private chats or tasks. Histories remain until
explicit deletion; members manage their own chats. Workspace reset removes derived data.

Indexing is opt-in, resumable and incrementally updated. Source/ACL metadata are not an
authorization authority. Authoritative checks precede snippets/prompts/citations. Only
bounded relevant source packs reach Gemini. Source text is untrusted, contacts are
minimized and no question, prompt, answer, snippet or vector enters telemetry.

## Delivery sequence and acceptance

1. Review the Material 3 page prototype and update the shared query/result/API contract.
2. Implement the composable server tools, private task/date joins and configured field resolution.
3. Replace the fixed-intent planner, integrate structured follow-up context and validate output.
4. Connect the new page to real conversation APIs; keep the fictional adapter development-only.
5. Verify exact fixtures for follow-up lists, custom approval fields, calendar boundaries,
   full pagination, ambiguity, source access changes, cancellation and adversarial inputs.
6. Refresh the actual completed UI's public captures, docs, skill, changelog and release plan.
7. Complete #95/#96/#98 against the scoped milestone, pass PR/CI and publish only then.

The local prototype is available at `/design-admin.html?preview=assistant-agent` and in
the design-review page's Preview selector. Its records, dates, tool responses and AI
answers are fictional. It demonstrates the intended interaction; it does not prove
these broader questions are implemented in the backend or ready for production.

Local verification: TypeScript and skill ownership checks pass. Focused milestone
policy tests pass (5 cases), and an attempted unplanned 2.6.1 bump was rejected
before changing the 2.6.0 candidate. Synthetic browser review covered 390px results
and history and a 1280px welcome view; live query/provider acceptance remains pending.

## Implemented delivery boundaries

The production `/assistant` container now uses LeadAssistantView with the real private
conversation APIs. The separate assistant-agent preview remains a fictional interaction
proposal. Knowledge controls live in Admin Settings. Read-only tools support standard
and active custom fields; exact counts/distributions; recorded conversion history;
recipient-private pending outreach; bounded source-verified notes; current private
Hygiene summaries. Other joins, ranking and unavailable business meanings clarify.

Indexing is disabled until an Admin opts in. Counts and structured lists do not need
embeddings. Existing customer data is not rewritten, stage meanings are not inferred,
and no lead/task mutation is available to the model. Cancellation is versioned, prevents
publication, and does not claim to retract an already sent provider request.

A synthetic live-provider probe verified the strict planner schema, next-week reminder
operation, North-zone count, explicit approval-stage list, out-of-scope rejection,
quoted theme output and 768-dimensional embeddings. An initial provider proposal
incorrectly equated active with New; the prompt was corrected and a server-side
literal-filter guard plus regression test now reject that unsupported narrowing.
No production lead records were sent in these probes. This is bounded provider
acceptance, not certification of every possible natural-language question.

Final local UI review: nine widths from 360 to 1920px in both palettes, actual mobile
shell, a short 390x500 window and 125% zoom. The zoom review found and fixed an
oversized history sheet; its measured final bounds were 360x500 within 390x500.
Two component cases cover IME/Shift-Enter and literal source rendering/result loading.
