# Assistant stale-history recovery

Live verification after an Admin-confirmed reporting-stage configuration exposed a rendering failure: the safe stale-response projection omitted createdAt, and the client sorted that entry alongside a new question. Restore the persisted original timestamp in the redacted projection. Preserve ownership/access checks and keep prior answers/plans/source values hidden. No UI layout, database migration or new business event is required. Existing API 1.24.0 already documents createdAt.

Regression coverage checks the actual server redaction and a mixed stale/current conversation rendering in chronological order. Required CI and production verification are separate evidence; confirm both before closure. Existing synthetic screenshots represent 2.6.4 and are not relabeled.
