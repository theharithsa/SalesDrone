# Correctness/security patch contract

Milestone 6 contains #4/#14/#15/#21/#27/#30. Keep a single 2.6.1 candidate through
implementation and PR review; all six remain open until verified delivery.

- Corrections require original actorUid or Admin, in addition to activities:write,
  current lead access and expectedRevision. Missing historic author permits Admin
  only. Revisions and automatic-reminder invalidation remain atomic.
- Archive/reassignment cancel only Pending outreach. Administrative tasks remain
  private and unchanged; current access/delivery eligibility still applies. DNC
  remains outreach-only. Never resurrect cancelled tasks.
- Restore adds POST /api/v1/leads/{id}/restore with leads:edit, current lead scope,
  expectedVersion and existing PAT leads:archive scope. Preserve suppression, stage,
  assignment and histories; no task rescheduling or invented stage transition.
  Keep archived contact ownership; repair missing self references atomically and
  reject newly acquired conflicting keys without disclosing other lead IDs.
- Existing archived duplicates return DUPLICATE_ARCHIVED only when every matched
  source record is currently accessible and archived; otherwise retain generic
  DUPLICATE. No count/ID disclosure. Archives provides a permission-aware restore
  action and explicit cancelled-outreach explanation.
- Roll out a compatible SPA CSP using observed sources, preserve managed HSTS and
  strict API-portal policy. No unsafe-eval; minimize inline allowances. Browser
  Auth/App Check/FCM/RUM compatibility and current fonts/zoom must be reviewed.
- #30 uses the supported ingress in API-INGRESS.md. Do not monkey-patch the managed
  parser or close the issue solely from inner Express tests.

Update OpenAPI, permissions, setting/handbook guidance, module skills, regression
cases, sanitized lifecycle signals and fresh affected synthetic captures. Verify
API/Firestore behaviour and ingress transport independently. PR, main CI, deployed
identities, protected/parser probes, public docs and telemetry receipts are separate
acceptance gates. No production customer records are test fixtures.
