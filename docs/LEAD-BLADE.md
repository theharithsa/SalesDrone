# Lead overlay and workspace

Desktop lead inspection uses a fixed overlay above the table. Opening it does not resize the list, hide columns or change filters. It is non-modal: the underlying list stays available. Back to leads closes it; Escape inside the overlay closes it unless a native select is handling Escape. Focus returns to the originating control where available.

Drag its left edge to widen leftwards. Keyboard Left/Right changes width, Shift doubles the step, Home/End select limits and double-click resets to 420px. Width is remembered only in the browser and clamped to available space. A journey at least 500px wide runs horizontally, with internal overflow for long paths. Top stage/assignment controls stay outside the scrolling body.

Open full lead page changes to /leads/{id}, retaining authentication and current scope checks. Browser Back/Forward restores route state. Mobile also offers this action, while quick details use the existing full-width presentation. Details and score are collapsed initially on the dedicated page; Comments, Tasks and Review organize the working area. Comments preserve line breaks, timestamps, source columns, revisions and paginated earlier activity.

Tasks queries GET /tasks with leadId and optional state, limit and cursor. It only exposes the current recipient’s tasks, including completed/cancelled work. Open a card for existing task actions; Refresh tasks after editing, and Load more tasks for subsequent pages. No new endpoint or broader administrator access is added.

Review filters loaded activities with Pending, Failed and NeedsReview automatic-reminder states, alongside contact review/suppression information. It is not a global approval system. Earlier activity must be loaded to check older entries. Existing reminder Edit/Undo/Retry/manual-date actions retain their revision and owner checks.

The main navigation uses consistent 20px icon cells and smooth explicit desktop collapse/expansion, with reduced-motion fallback. Documentation above Settings opens the complete public handbook. No pointer positions, customer contents or invented business events are emitted for these presentation changes.

Full-page identity uses an inline first/family name with natural wrapping. Avatar, company and badge occupy independent grid cells; narrow containers put the badge below the name. Long unbroken and non-Latin names must remain readable without horizontal overflow.

Full-page Comments starts with an inline Write a comment field, followed by left-aligned cards. Drafts survive tab switches for the same lead, but are memory-only and disappear when leaving the lead/account or reloading. Successful posts clear the field; failed posts retain it. Posting uses existing version/idempotency policy. Stale pagination and late form callbacks must not replace the active lead or close another dialog.
