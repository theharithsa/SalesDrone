import { useEffect, useState } from "react";
import { ErrorMessage, SaveButton } from "../components/UI";
import { FieldOptions } from "../lib/field-options";
export default function ResearchSettings({
  request,
  fieldOptions,
}: {
  request: (p: string, m?: string, b?: any) => Promise<any>;
  fieldOptions: FieldOptions;
}) {
  const [index, setIndex] = useState<any>(null);
  const [config, setConfig] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    let alive = true;
    request("/lead-research-settings")
      .then((c) => {
        if (alive) setConfig(c);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [request]);
  useEffect(() => {
    let alive = true;
    request("/lead-assistant/index")
      .then((value) => {
        if (alive) setIndex(value);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [request]);
  const choose = (key: string, value: string, checked: boolean) =>
    setConfig((c: any) => ({
      ...c,
      [key]: checked
        ? [...c[key], value]
        : c[key].filter((s: string) => s !== value),
    }));
  return (
    <section className="panel research-settings">
      <h3>Lead research</h3>
      <p>
        Define what outcomes mean for this workspace. Blank groups show Setup
        required in the Assistant.
      </p>
      <ErrorMessage error={error} />
      {config ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            setMessage("");
            try {
              const { version, ...values } = config;
              setConfig(
                await request("/lead-research-settings", "PATCH", {
                  expectedVersion: version,
                  ...values,
                }),
              );
              setMessage(
                "Research settings saved. Previous results may need to be refreshed.",
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="research-stage-groups">
            {[
              ["convertedStages", "Converted stages"],
              ["failedStages", "Failed stages"],
              ["archiveReviewStages", "Stages eligible for archive review"],
            ].map(([key, label]) => (
              <fieldset key={key}>
                <legend>{label}</legend>
                {[
                  ...new Set([...fieldOptions.values.stage, ...config[key]]),
                ].map((value) => (
                  <label className="report-setting-option" key={value}>
                    <input
                      type="checkbox"
                      checked={config[key].includes(value)}
                      disabled={busy}
                      onChange={(e) => choose(key, value, e.target.checked)}
                    />
                    <span>
                      {value}
                      {!fieldOptions.values.stage.includes(value)
                        ? " (retired — remove or restore)"
                        : ""}
                    </span>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
          <label>
            Days since last recorded contact for archive review
            <input
              type="number"
              min="1"
              max="3650"
              value={config.inactivityDays ?? ""}
              placeholder="Not configured"
              onChange={(e) =>
                setConfig({
                  ...config,
                  inactivityDays:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
          <p className="muted">
            A lead also needs an eligible stage and no pending task. Missing
            contact history is not evidence of inactivity. Reports never archive
            leads automatically.
          </p>
          <label>
            Reporting timezone
            <input
              value={config.timezone}
              onChange={(e) =>
                setConfig({ ...config, timezone: e.target.value })
              }
              required
            />
          </label>
          <label
            className="report-setting-option"
            htmlFor="research-index"
            aria-label="Enable the lead knowledge index"
          >
            <input
              id="research-index"
              type="checkbox"
              checked={config.indexingEnabled}
              onChange={(e) =>
                setConfig({ ...config, indexingEnabled: e.target.checked })
              }
            />
            <span>
              <strong>Enable the lead knowledge index</strong>
              <small>
                Build and incrementally maintain searchable evidence using
                Gemini embeddings. Source notes are processed in bounded
                batches. Contact tokens are masked where detected. This uses the
                configured AI provider and may incur usage charges.
              </small>
            </span>
          </label>
          <p>
            Counts use the complete accessible lead list. Monthly conversions
            count distinct leads with recorded changes into a converted stage,
            within calendar-month boundaries. Imported history may be
            incomplete.
          </p>
          {index ? (
            <div className="panel">
              <h3>Knowledge index</h3>
              <p>
                {index.enabled ? "Enabled" : "Disabled"} ·{" "}
                {index.status || "Not started"}
              </p>
              {index.canManage ? (
                <>
                  <p>
                    {index.pending || 0} pending jobs · {index.failed || 0}{" "}
                    failed jobs
                  </p>
                  <button
                    className="button"
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        setIndex(await request("/lead-assistant/index"));
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Refresh index status
                  </button>{" "}
                  <button
                    className="button"
                    type="button"
                    disabled={busy || !index.enabled}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        await request("/lead-assistant/index", "POST", {});
                        setIndex(await request("/lead-assistant/index"));
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Rebuild index
                  </button>
                </>
              ) : (
                <p>
                  Workspace-wide Admin lead access is required to manage the
                  index.
                </p>
              )}
            </div>
          ) : null}
          <SaveButton busy={busy} label="Save research settings" />
          {message ? <p role="status">{message}</p> : null}
        </form>
      ) : (
        <p role="status">Loading research settings…</p>
      )}
    </section>
  );
}
