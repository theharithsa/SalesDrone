# Shared task contract and production index correction

The task store orders dueAt pages by dueAt and then id. The v2.7.0 candidate added leadId/dueAt without id, while leadId/state/dueAt/id already existed. Real emulator tests do not enforce production composite indexes. The corrected source declares leadId/dueAt/id, reuses the existing state-filtered definition and adds explicit configuration coverage. A read-only production query using a nonexistent synthetic lead key will check the required ordering after the index is READY.

The initial v2.7.0 main run 41425656740 was cancelled after index readiness and during the Functions step; Hosting was skipped. Do not call it a completed publication or infer that a cancelled Functions step could not have started cloud operations. The normal forward v2.7.1 workflow deploys all affected components, verifies exact identities and preserves the cancelled-run evidence. Same-version candidate recovery or a recycled tag is not used.

Swagger now declares limit/cursor/state on the shared GET and required UUID Idempotency-Key on PATCH, preserving the typed Task page and strict mutation schema. No task permission or sharing policy changed. The visual UI is unchanged, so v2.7.0 synthetic capture metadata is retained rather than restamped.
