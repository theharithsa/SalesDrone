# Operational reference

Use the current source and [shared contract](../../SHARED.md) when applying these module-specific recipes. Release dates, prior approvals and screenshot versions are historical evidence in [CHANGELOG](../../../CHANGELOG.md) and [release plans](../../../releases/); they never authorize a new deployment.

## Material 3 v2  guidance

Material v2 uses a plain Tasks heading, status chips, compact rows and shared action/menu styling. Keep task ownership, completion, edit/delete and date-entry behavior unchanged. Check long titles and wrapped dates/actions at phone widths before release.

### Local v2 form contract

TaskForm, TaskEditForm and RescheduleForm use persistent outlined labels, 56px
entry containers and grouped actions. Keep native date/time validation, field
names and localInstant conversion intact. `design:forms` checks real reminder/edit
markup. The isolated admin preview can open reminder/edit dialogs but never saves
a real task. Review required dates, focus and narrow dialogs in MATERIAL-05.

### Mobile action menus

Task menu triggers/actions retain compensated touch targets under saved zoom.
On opening, measure available viewport space excluding sticky header/bottom nav;
choose above/below and bound scrolling rather than letting actions fall behind the
bar. Closing the disclosure after an action must not alter the task handler or
authorization. review:mobile includes a bottom-edge anchor containment regression.

### Local  task list refinement

Tasks uses title/New on one phone row, a status picker below, a loaded count and
one timezone label. Desktop keeps Add reminder and pressed-state status buttons.
Rows group title, lead/company and due instant; completion uses a 22px symbol
inside a compensated target. Secondary actions share the row menu. Completed and
cancelled rows retain Edit task/Delete task, without pending scheduling actions.
Preserve existing handlers, capability guards and recipient privacy. Menus close
on Escape (restoring trigger focus), outside pointer, blur and action selection.

review:mobile checks full list width, aligned menu anchors, compact symbol/target
sizes, status empty/completed/cancelled states, edit/reschedule/delete dialogs and
completion/cancellation using in-memory demo tasks. Review five saved scales and
light/dark/Book palettes; this is no proof of server persistence or delivery.
No new API, permission, setting or business event is needed for this presentation.

## Lead-data reset

reminders advances bounded lead-reset batches before dispatch. When active, normal reminder/attachment cleanup is skipped; note/scoring workers also skip, and store guards stop in-flight domain writes. Reset removes lead-related tasks/deliveries/device receipts but retains standalone personal reminders and their retry receipts. Every producer must receive the guarded store; no independent unguarded write path.

## Task UI request lifecycle

LeadTaskTab pages the existing recipient-private GET tasks endpoint by leadId and optional state. Do not widen access for administrators. Include all supported states, loading/error/refresh/load-more and stale-request guards and refresh after successful task mutations without resetting its status filter; card selection opens existing edit/delete/reschedule/complete dialogs.

useSubmit supplies an isCurrent callback so a dismissed task form cannot close a replacement dialog after its request resolves. The synchronous submit lock blocks double-click writes before React commits busy state. Verify edit/delete/cancel and delayed completion in synthetic fixtures.

