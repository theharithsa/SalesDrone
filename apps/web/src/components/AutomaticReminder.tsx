import { useState } from "react";
import { Bell } from "lucide-react";
import { Entity, displayDate } from "../lib/types";
import { localInstant } from "../lib/dates";
import { ErrorMessage } from "./UI";
export default function AutomaticReminder({
  activity,
  timezone,
  canManage,
  onAction,
}: {
  activity: Entity;
  timezone: string;
  canManage: boolean;
  onAction: (body: any) => Promise<void>;
}) {
  const auto = activity.autoReminder;
  const [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!auto || ["NoAction", "Disabled"].includes(auto.status)) return null;
  async function act(body: any) {
    setBusy(true);
    setError("");
    try {
      await onAction({ ...body, expectedRevision: activity.revision });
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const actionable =
    ["Pending", "Failed", "NeedsReview", "Scheduled"].includes(auto.status) &&
    canManage;
  return (
    <div className="automatic-reminder" aria-busy={busy}>
      <div className="automatic-reminder-heading">
        <Bell size={14} />
        <strong>
          {auto.status === "Pending"
            ? "Checking for a follow-up"
            : auto.status === "NeedsReview"
              ? "Follow-up needs a date"
              : auto.status === "Failed"
                ? "Could not schedule follow-up"
                : auto.status === "Scheduled"
                  ? "Reminder from this note"
                  : auto.status === "Manual"
                    ? "Manual reminder"
                    : auto.status === "TaskChanged"
                      ? "Reminder updated"
                      : "Automatic scheduling stopped"}
        </strong>
      </div>
      <p role="status">
        {auto.dueAt && ["Scheduled", "Manual"].includes(auto.status)
          ? displayDate(auto.dueAt, auto.timezone || timezone) +
            " · " +
            (auto.timezone || timezone)
          : auto.message}
      </p>
      {actionable && !editing ? (
        <div className="automatic-reminder-actions">
          {auto.status === "Failed" ? (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void act({ action: "retry" })}
            >
              Retry
            </button>
          ) : null}
          <button
            className="text-button"
            disabled={busy}
            onClick={() => setEditing(true)}
          >
            {auto.status === "Scheduled" ? "Edit" : "Set date manually"}
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void act({ action: "dismiss" })}
          >
            {auto.status === "Scheduled" ? "Undo" : "Dismiss"}
          </button>
        </div>
      ) : null}
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            try {
              const dueAt = localInstant(String(d.get("dueAt")));
              void act({
                action: "schedule",
                task: {
                  title: String(d.get("title")),
                  dueAt,
                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  kind: "outreach",
                },
              });
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <label>
            Reminder
            <input
              name="title"
              defaultValue={auto.title || "Follow up with this lead"}
              maxLength={250}
              required
            />
          </label>
          <label>
            Date and time
            <input name="dueAt" type="datetime-local" required />
          </label>
          <p className="field-hint">
            Entered in {Intl.DateTimeFormat().resolvedOptions().timeZone}.
          </p>
          <div className="automatic-reminder-actions">
            <button className="text-button" type="submit" disabled={busy}>
              Save reminder
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      <ErrorMessage error={error} />
    </div>
  );
}
