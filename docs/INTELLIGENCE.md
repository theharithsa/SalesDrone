# Dashboard and lead intelligence

SalesDrone displays six responsive views: pipeline stage composition, 14-day personal outreach / lead additions, personal reminder workload, sector/city mix, score coverage, and call outcomes. Stage composition is not a conversion funnel. Reminder and outreach counts are personal; lead counts honor assigned/all scope. The dashboard states its account timezone and snapshot coverage.

## AI workspace brief

`POST /api/v1/dashboard/insights` uses Gemini server-side to produce a headline and up to four suggestions about permitted pipeline counts and the signed-in user's open tasks. It receives aggregate facts, up to 25 task titles/dates and authorized lead IDs/scores, without structured customer names, phones or emails. Free text can contain information entered by a user. Input is treated as untrusted data; the model has no tools and cannot contact leads or create tasks.

Each insight must reference an input task/lead or an exact supplied numeric fact. IDs and fact values are validated; the generated prose remains an AI suggestion and should be reviewed. Blocked leads are identified in the input and excluded from priority recommendations. This feature does not replace the existing automatic reminder worker.

Briefs are private to a UID, membership version and source fingerprint, cached for at most 15 minutes. A transaction lease prevents duplicate generation, and new generations are limited to two per user per minute. Membership is rechecked before publication. Charts remain available if Gemini fails.

Snapshots scan at most 2,000 permitted active leads, 1,000 personal open tasks and 2,000 recent personal call records. Coverage flags disclose bounded results. Lead-linked tasks/calls outside the scanned authorized lead set are excluded. This favors bounded reads over unbounded dashboard queries; plan aggregation before expanding substantially beyond these limits.

## Evidence-linked lead scores

The admin's configurable model contains up to 30 factors in Fit, Intent and Red flags. Defaults use the requested commercial construction/wholesale factors:

| Group | Factor | Weight |
| --- | --- | ---: |
| Fit | Commercial business profile | 15 |
| Fit | Project / bonding capacity | 10 |
| Fit | Within delivery coverage | 10 |
| Fit | Reported commercial credit approval | 10 |
| Fit | Licences / safety certifications | 5 |
| Intent | Bidding / project awards | 12 |
| Intent | Detailed RFQ / bill of materials | 12 |
| Intent | Sample request | 8 |
| Intent | Commercial credit application | 8 |
| Intent | Supply urgency | 10 |
| Red flags | Outside delivery radius | −35 |
| Red flags | Reported poor business payment history | −30 |
| Red flags | Retail / DIY volume mismatch | −20 |
| Red flags | Returns / disputes | −20 |

The server computes `clamp(round(100 × matched positive weights / all enabled positive weights − matched penalties), 0, 100)`. Gemini extracts factor evidence; it does not assign points. All unknown evidence produces an unscored lead, not a fabricated zero. The UI displays evidence coverage separately, because a low score with little known context is not proof of low potential. Explicit contradictions/conflicts receive no positive points. Scores are sales prioritization aids, not credit/lending decisions or independent credit, licensing, safety or delivery verification.

Extraction reads selected business profile fields plus up to 16 recent activity notes, with 1,800 characters per note, 8,000 total note characters and 1,500 profile characters. Historical imported comments are eligible for scoring without scheduling reminders. Source metadata distinguishes recorded dates from known event dates; an import timestamp is not evidence that an old bid or urgent need is current. Every non-unknown signal requires an exact contiguous quotation and source ID; fabricated quotations are discarded. Claims are only as reliable as the recorded notes. Names, phones and emails are omitted from structured profile input, but free-text notes/custom fields can still contain user-entered personal information. No yard location is configured by default, so a city alone cannot establish delivery coverage. Add explicit notes or adjust the factor condition when coverage is known.

The scheduled `leadIntelligence` function runs every minute, scans a cursor page of 40 active leads and analyzes at most 12, with four model requests concurrently. Leases, per-lead source/rule versions and failure backoff avoid duplicate/stale publication. First population of several hundred leads takes multiple scheduler runs. An editor can use Refresh in a lead inspector to analyze that lead immediately; a current cache is reused. Changed notes/call corrections and business fields invalidate evidence. Weight-only edits recalculate immediately; condition/factor changes trigger a new background pass. Failed extraction retries after five minutes, and after three failures backs off for 24 hours. New notes/rules reset that retry series.

## Settings and API

Admin Settings contains Lead scoring and the actual People & access controls. Existing protected bootstrap admins and permission rules remain in place. Mobile Settings uses the existing section dropdown. Sidebar collapse now sits directly above Settings with a text label when expanded.

OpenAPI 1.7.0 adds seven operations (43 total): GET/PATCH scoring-settings; GET lead-scores (at most 100 IDs, all scope checked); GET lead detail score; POST score refresh; GET dashboard; POST dashboard insights. Writes use expectedVersion where configuration is edited. Scores and briefs are service-side derived records; direct Firestore client access remains denied.

Both `api` and `leadIntelligence` explicitly bind Secret Manager's existing `GEMINI_API_KEY`; no secret is shipped to the browser. Current model is `GEMINI_MODEL`, default `gemini-3.5-flash-lite`. Additional indexes are activities actorUid/type/id DESC, leads archived/id ASC and leads archived/assignedToUid/id ASC. Deploy it and wait for READY before releasing dashboard assets. The new worker logs only result counts. The API audits manual score refreshes, scoring settings changes and brief generation. Derived scores and per-user briefs have no automatic erasure/retention workflow beyond existing project practices; minute budget documents should be included in future retention cleanup.
