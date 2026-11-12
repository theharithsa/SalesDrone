---
name: salesdrone-finops
description: "Review SalesDrone Firebase usage, browser caching, Firestore read/write amplification and service cost. Apply to every feature review, with deeper measurement for queries, polling, jobs, MCP or infrastructure changes."
---

# SalesDrone cost and capacity

Read [SHARED](../SHARED.md) and [the cost and migration plan](../../docs/FINOPS.md). Review alongside the feature owner and release readiness. This skill does not authorize cloud changes or disabling safeguards.

1. Record current traffic by route, source and function, then actual daily Firestore reads, writes and deletes and billable SKUs. Separate project totals, modeled operations, query/index charges and costs. Ask for the missing usage window or export when attribution is unavailable.
2. Estimate reads, writes, scans and fan-out per interaction and per scheduled run. Multiply by page visits, active tabs, polling, retries and distinct callers. Include auth lookups, PAT rate counters, audit/outbox writes and TTL deletes. Give proposed changes a read/write budget and measure repeat visits, idle traffic and peak work.
3. Avoid redundant requests before optimizing execution. Use indexed filters, bounded projection/cursors and scoped aggregates. Reuse only safe short-lived reads in tab memory. Preserve auth, assignment, versions, manual refresh and foreground recovery. Keep contact responses out of persistent storage and shared HTTP caches.
4. Test cold, warm, failed, stale and changed-access paths. Count operations against synthetic fixtures and check production usage separately after approval. Keep logs and metrics low-cardinality and free of data values, IDs, URLs and tokens.
5. Prefer Firebase-managed runtime services for SalesDrone. Retiring the separately deployed ingress requires the parser/authorization tests in [API ingress](../salesdrone-api-ingress/SKILL.md), a reviewed compatibility decision where needed, staged cutover and rollback. Keep Dynatrace, GitHub and explicitly approved providers documented as integrations. Firebase Functions v2 still uses Cloud Run underneath.
6. Keep provider quotas and user budget separate. Set budget alert thresholds and owner response plans before usage grows. Review actual usage before promising savings or declaring a quota met.

## Primary API ownership

None. The route's domain module owns its HTTP contract. Coordinate pagination and limits with [API integrations](../salesdrone-api-integrations/SKILL.md) and [MCP](../salesdrone-mcp/SKILL.md).

Dashboard AI and push-test TTL add one eventual billed delete per expired document and no new request-path operation. Attribute those deletes separately from reads and writes.

Compare ingress billable instance time per request and SKU totals before and after request-based billing. Confirm both service and revision minimums are zero. Tenant searchability of ingress signals is a separate gate from cost measurement.
