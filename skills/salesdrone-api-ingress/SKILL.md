---
name: salesdrone-api-ingress
description: "Maintain SalesDrone's Cloud Run HTTP ingress, bounded body validation, upstream proxy, service IAM and rollout. Use for Hosting/API parser boundary failures; business authentication and policy stay in the existing API."
---

# API ingress service

Read [SHARED](../SHARED.md), [release readiness](../salesdrone-release-readiness/SKILL.md)
and [the ingress contract](../../docs/API-INGRESS.md) before changing transport.

## Primary API ownership

No new business endpoints. Existing /api/v1 routes remain owned by their domain
skills; the gateway forwards them to the existing api function. Its container health
route is operational, not a new lead-data API.

## Boundaries

The Firebase Functions Framework parses JSON before Express; an inner error handler
cannot normalize that outer rejection. Validate at the Cloud Run ingress, before
forwarding, without patching provider internals. Preserve auth/App Check, idempotency,
content types, binary bytes and backend error envelopes. Do not duplicate policy or
accept an identity derived from client-controlled forwarding headers.

Fixed HTTPS upstream only; never derive a target from Host, URL, query or body.
Bound JSON/binary/decoded payloads and timeouts. Stop forwarding malformed/oversized
bodies. Do not log headers, URLs/queries, names, contacts or request/response bodies.

The service account needs only its telemetry secret, not Firebase data or Gemini.
Keep runtime identity, build/deploy grants and secret bindings explicit. No keys.
Preserve the existing backend during the compatibility rollout; native provider URLs
are not the supported Hosting /api/v1 contract. Document that boundary honestly.

## Delivery

Stage the service and verify its revision before Hosting cutover. Retain five existing
Functions and publish ingress metadata separately. Index/function/Hosting/ingress,
public docs, signal acceptance and tenant searches are distinct checks. Failure must
not silently re-route traffic or label a partial deployment successful.

Keep tests for malformed/compressed/oversized JSON, binary forwarding, auth headers,
fixed-target enforcement, safe errors, upstream failures and no business side effects.
Use synthetic local fixtures and read-only live denial/parser probes. Preserve old
backend compatibility for rollback; never roll back customer data.

## Regression and rollout entry points

- [gateway transport cases](../../services/ingress/test/gateway.test.js): actual HTTP parser, compressed/raw limits, auth/binary preservation, stalled requests and safe upstream failures.
- [decoded OTel](../../services/ingress/test/telemetry.test.js): real client/server context, finite error categories and private-value exclusion. Flush only after the forwarding operation settles; serialize subsequent flush requests.
- [live probes](../../scripts/ingress-checks.mjs): unauthenticated malformed/strict/compressed JSON, binary and oversized requests; never add customer credentials or IDs.
- [deployment](../../scripts/deploy-ingress.mjs) and [provisioning](../../scripts/provision-ingress.mjs): immutable images, least privilege, staged health/transport proof before Hosting.

Drain supported oversized wire bodies without buffering (up to the platform ceiling)
before returning 413. Keep the application deadline below Hosting's 60 seconds.
