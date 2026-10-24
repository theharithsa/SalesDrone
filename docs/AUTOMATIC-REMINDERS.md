# Automatic reminders from notes

New call comments and standalone lead notes are analyzed in the background using Gemini 3.5 Flash-Lite. Manual reminders remain available. New manual lead initial discussions/Comments now use the same analysis path. Imported comments and historical entries are not bulk-analyzed. An explicit correction to an activity creates a new analysis revision.

## User behavior

Saving an activity never waits for Gemini. The timeline shows “Checking for a follow-up”; it refreshes every 15 seconds while visible and pending. The scheduled worker runs every minute, so creation usually takes up to a minute plus analysis time, with longer delays during retries or backlogs.

- Clear dated instructions create one task linked to that activity revision. Edit and Undo are available in the timeline. Existing reminder inbox/push delivery is reused.
- Historical statements and requests not to contact create no reminder. Conditions, multiple actions, vague wording, invalid dates, explicit timezone labels/offsets requiring confirmation, missing/past times and daylight-saving gaps/folds require manual clarification.
- A manual reminder attached when saving a call takes priority. Choosing “Set date manually” on an analysis cancels its background job. An independent manual task elsewhere is not automatically deduplicated against unrelated notes.
- If a source note is corrected, an untouched generated task is cancelled and the new revision is analyzed. Completed, cancelled or manually edited tasks are preserved; the correction asks for review before creating another.
- AI failures have visible retry/manual controls. A user can disable automatic analysis in Settings; pending jobs recheck that preference before creating tasks. Existing scheduled tasks remain intact.

## Date rules

Settings defaults: enabled, account timezone (Asia/Kolkata initially), 10:00 for missing times, “next week” = seven calendar days after saving the note, no weekend movement. “Next week” can instead mean the next Monday. Relative dates without an explicit time can optionally move from a weekend to Monday. Explicit dates, explicit clock times and named weekdays retain the requested day. Relative minute/hour durations use elapsed time from the note revision save time, independent of default clock time. A correction uses its save time as a new reference.

The backend converts wall times to UTC and rejects DST gaps/folds instead of guessing an offset. A result already in the past when processing finishes needs review. Automatic follow-ups beyond one year need review. Existing manual date/time controls remain available.

## API and permissions

The generated OpenAPI contract is version 1.2.0, with 33 operations.

- `PATCH /api/v1/me` accepts optional `automaticReminders`, `reminderTime` (HH:mm), `nextWeekRule` (`seven_days` or `next_monday`), and `moveWeekends`, alongside timezone/appearance. Omitted fields are preserved.
- Existing activity endpoints return `autoReminder` with status, owner, source job id, task id, display message and, when scheduled, dueAt/timezone.
- `PATCH /api/v1/activities/{id}/automatic-reminder`: `action=retry|dismiss|schedule`, plus `expectedRevision`. Schedule includes a validated `task` object (no leadId; bound to the source lead). Only the analysis owner with tasks:write and current lead access may act. Retry also requires activities:write. Invalid transitions/stale revisions return 409; forbidden actions 403; invalid dates 400; excessive retries 429. Private responses are no-store with request IDs.
- Workers recheck active membership, activities:write/tasks:write/leads:read, assigned scope, assignment changes, suppression/archive/review state, user settings and source revision both before inference and before committing a task.
- Direct Firestore client access remains denied. Job identifiers and task identities prevent duplicate creation on retries/concurrent workers. Manual resolution uses a transaction/state transition to prevent repeated scheduling.

## Backend and secrets

`analyzeNotes` runs every minute in asia-south1 with a 120-second deadline and at most five notes per invocation. The Gemini request has an 18-second timeout. Jobs use three-minute leases, bounded exponential retries (three automatic attempts), and at most three user-triggered retry cycles. A stale worker cannot overwrite a newer lease/revision. Queue records live in workspaces/avinyatech/noteAnalyses; tasks and delivery records use the existing shared business layer. The new composite index covers status/nextAttemptAt/id.

`GEMINI_API_KEY` is in Firebase Secret Manager and bound only to the analysis function. `GEMINI_MODEL` is a non-secret Functions parameter. No Gemini key is included in frontend assets or provider errors. The relevant note, timezone and reference date/time are sent to Gemini; other lead history/contact profiles are not fetched into the prompt. Information explicitly written into the note is part of that transmission. Notes are treated as untrusted data; Gemini has no tools and cannot write directly to Firestore. Structured output is checked with Zod, evidence is matched to source text, and dates/policy are validated by the application.

Structured `note_analysis` logs contain counts only (claimed/scheduled/review/noAction/failed/cancelled). Audit events record the activity/task identity and disposition without note text. Monitor Failed jobs and queue age; configure company retention/cleanup and alerts separately. Inference is best effort, not a guarantee of semantic accuracy; the visible scheduled date, Edit and Undo provide correction controls.

## Verification

- 28 automated API/domain/date tests passed, including concurrency, idempotency, note corrections during inference, manual priority, Undo/manual resolution, permission/reassignment/settings changes, failures/retries, timezone/default/weekend behavior and DST gaps/folds.
- Real Firebase Auth/Firestore emulator integration passed through API note creation, persisted analysis, task/delivery transaction and Undo. Model responses in this integration are synthetic.
- Seven actual Gemini requests using synthetic notes passed: next week, ten minutes, tomorrow at 11, vague later, historical call, no-contact request and conditional follow-up. Run `node scripts/verify-gemini.mjs` using an authorized Firebase CLI operator account to repeat; it reads the secret in memory and never prints credentials.
- TypeScript and production build passed. Browser-control tools were unavailable for a final visual interaction pass. Production function/Hosting activation and real-user verification status are recorded in VERIFICATION.md.
