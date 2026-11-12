# Firebase operating budget and ingress migration

## Baseline and attribution

Firestore Standard lists 50,000 document reads and 20,000 writes per day in the free quota, plus a separate delete quota. The project can still accrue Blaze charges, including from eligible index entry reads, TTL deletes, Functions and ingress. Treat the reported 500,000 figure as a starting point. Obtain the project, database, exact interval, read/write/delete breakdown, request volume, callers and billing SKUs before attributing the total. [Firestore billing](https://firebase.google.com/docs/firestore/pricing)

| Path | Cost mechanism | Status |
| --- | --- | --- |
| Leads, Tasks, Today and field configuration | Route changes can repeat first-page and summary reads. The summary already uses five aggregation queries, which still read index entries. | Local candidate caches selected first pages and aggregates. |
| Lead scores | Each bulk refresh performs one lead access lookup and one score lookup per requested lead, plus configuration and policy reads. At 100 loaded leads, the old 30-second interval could trigger about 24,000 point lookups per visible tab-hour. | Local candidate pauses hidden polling and changes the visible interval to 60 seconds. The initial lookup remains. |
| Inbox | Up to 100 rows plus visibility checks on the minute poll. Page navigation and updates previously restarted the poll. | Local candidate keeps one poll across page navigation, limits focus-driven polling to at most once per 30 seconds and honors inbox events immediately when idle. Follow up with a scoped unread indicator that preserves older unread and assignment semantics. |
| MCP/PAT | Every accepted token request transaction updates both token and owner rate counters. A first use in a minute can also update token metadata. | Keep durable rate limits. Measure request volume before proposing changes. Prefer a scoped aggregate over paging a full collection for a count. |
| Background work | Four minute schedules incur idle queries, retries and telemetry/outbox writes. | Measure idle versus busy work separately. Verify due-time and delivery SLAs before changing schedules. |
| Cloud Run ingress | Separate request hop, its own runtime and container artifacts. | Request-based billing and zero minimum instances. Compare billable instance time and request volume before and after rollout. Measure Cloud Build and Artifact Registry separately from Firestore. |

The score example is a modeled operation count, including missing-document lookups. It is neither invoice data nor proof that this path caused the reported spike.

## Browser cache contract

The in-app tab memory stores up to 24 recent entries. First-page lead/task lists can be reused for 15 seconds, summary/dashboard for 30 seconds, and field options for 45 seconds. Identical in-flight reads share a request. The cache is scoped by the authenticated user, active session epoch, membership and access policy versions and scope. Successful writes, manual refresh, focus, account change and access errors clear cache entries. An old in-flight request cannot refill a cleared cache. External changes can take up to the relevant TTL to appear on repeat navigation. Full reload fetches from the server.

Searches, cursor pages, lead details, activity, inbox, attachments, authorization and tokens use fresh requests. This cache adds no IndexedDB, localStorage, Service Worker or CDN caching for private API data. Existing HTTP no-store, App Check and deny-all Firestore client rules remain. Every server request still performs its current authorization. Reassignment and policy changes invalidate saved data on the usual authority refresh; if immediate display revocation is required for a surface, exclude that surface from the cache.

## Measure and set a budget

1. Compare seven matched baseline days with seven days after an approved rollout. Use Firestore usage/Cloud Monitoring for document counts, billing SKU totals for charges, and sanitized Dynatrace route/worker metrics for traffic. Align day boundaries with Firestore billing, and separate releases/import days and distinct caller types.
2. Reproduce the high-volume paths with synthetic data. Count requests and store operations for login, opening each screen, revisiting before and after TTL, manual refresh, one hour of idle foreground/background tabs, a representative MCP query, and scheduled workers with an empty and full queue. Use Query Explain for suspected expensive Firestore queries with bounded examples.
3. Start with review thresholds of 40,000 reads and 16,000 writes per day (80% of the Standard free quota). Review rolling daily counters and rising spend against the user's agreed limit. Budget alerts notify; they do not stop spending. Assign someone to investigate bursts before tightening production throttles.
4. Prioritize measured high-volume routes: an authorized unread indicator, denormalized score summaries only if measured reads outweigh added writes and invalidation cost, and targeted MCP filters/aggregates. Preserve mutation audit and authorization even when reducing amplification.

Terminal reminder retention shares the existing scheduled invocation. At most one indexed pass per scheduled UTC hour selects up to ten old terminal jobs and reads up to 21 receipts per job. A full pass deletes at most 210 documents. No additional task or notification-path reads are needed. Measure cleanup separately from the one-minute delivery scan, including empty and retried queries.

## Move off the standalone Cloud Run ingress

Target the existing Firebase Hosting, Cloud Functions, Auth/App Check, Firestore, Storage and FCM runtime. Functions v2 runs on Cloud Run infrastructure, so removing the independently deployed ingress is a reduction in managed services and one HTTP hop. It will not by itself reduce Firestore operations. Keep Dynatrace and GitHub as operational integrations and Gemini as the approved AI provider while separately assessing Firebase AI support and feature equivalence. [Functions version comparison](https://firebase.google.com/docs/functions/version-comparison)

1. Inventory the standalone ingress, its dedicated service account, build/source bucket, artifact repository, GitHub WIF permissions, Hosting rewrites and monitoring. Distinguish these from resources managed by Firebase Functions.
2. Prove a Hosting rewrite directly to the existing Firebase HTTP function on a test project or an isolated preview channel. Test API routing, JSON/strict/compressed and malformed body behavior, upload/download bytes, request/version headers, authorization, PAT scope, retries, CORS, CSP, timeouts and trace propagation. Hosting has a 60-second ceiling. Preserve the existing public host and path. [Firebase Hosting rewrites](https://firebase.google.com/docs/hosting/serverless-overview)
3. The current ingress is the fix for #30. The Functions Framework may reject invalid JSON before the app runs. An HTTPS function wrapper or Express middleware cannot intercept that outer parser. If the staged environment confirms the difference, obtain approval for provider-owned malformed-body errors and explicitly revise the supported API contract before cutover, or keep the ingress until a Firebase-only design can preserve the behavior. Keep valid-request compatibility and test MCP handling of non-JSON platform errors. [Current ingress contract](API-INGRESS.md)
4. Run the checked PR and Functions-before-Hosting release with the current ingress available for rollback. Verify custom host, default host, authorized synthetic traffic, parser/denial probes, trace/telemetry receipts and usage. Only after the agreed observation window should a separate reviewed change remove unused ingress resources and IAM grants. No production route, service or billing setting was changed during the Settings preview.
