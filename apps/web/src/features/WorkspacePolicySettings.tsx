import { useEffect, useState } from 'react';
import { ErrorMessage } from '../components/UI';
export type WorkspacePolicy = {
  version: number;
  exportsEnabled: boolean;
  assignedOnly: boolean;
};
export default function WorkspacePolicySettings({
  request,
  onChanged,
}: {
  request: (p: string, m?: string, b?: any) => Promise<any>;
  onChanged: () => void;
}) {
  const [config, setConfig] = useState<WorkspacePolicy | null>(null),
    [exportsEnabled, setExports] = useState(true),
    [assignedOnly, setAssigned] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  async function load() {
    setError('');
    try {
      const c = await request('/workspace-settings');
      setConfig(c);
      setExports(c.exportsEnabled);
      setAssigned(c.assignedOnly);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [request]);
  return (
    <section className="panel workspace-policy-settings">
      <h3>Reports & lead access</h3>
      <p>Workspace-wide controls. Individual member permissions still apply.</p>
      <ErrorMessage error={error} />
      {config ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            setMessage('');
            try {
              const c = await request('/workspace-settings', 'PATCH', {
                expectedVersion: config.version,
                exportsEnabled,
                assignedOnly,
              });
              setConfig(c);
              setMessage(
                'Workspace controls saved. Other sessions apply the policy on their next API request.',
              );
              onChanged();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="report-setting-option">
            <input
              type="checkbox"
              checked={exportsEnabled}
              disabled={busy}
              onChange={(e) => setExports(e.target.checked)}
            />
            <span>
              <strong>Allow Excel reports</strong>
              <small>
                Allow members with lead access to export matching leads and
                selected columns. Turning this off blocks the export API too.
              </small>
            </span>
          </label>
          <label className="report-setting-option">
            <input
              type="checkbox"
              checked={assignedOnly}
              disabled={busy}
              onChange={(e) => setAssigned(e.target.checked)}
            />
            <span>
              <strong>Non-admins see assigned leads only</strong>
              <small>
                Apply to lists, direct links, reports, dashboard insights and
                reminders. Admins keep their existing scope. When off, each
                member’s configured scope applies.
              </small>
            </span>
          </label>
          {!assignedOnly ? (
            <p className="field-hint">
              Members with “All leads” scope can access the full pipeline when
              this restriction is off.
            </p>
          ) : null}
          <button
            className="button primary"
            disabled={
              busy ||
              (exportsEnabled === config.exportsEnabled &&
                assignedOnly === config.assignedOnly)
            }
          >
            {busy ? 'Saving…' : 'Save workspace controls'}
          </button>
        </form>
      ) : (
        <button className="button" onClick={() => void load()}>
          Reload workspace controls
        </button>
      )}
      {message ? (
        <p role="status" className="success-message">
          {message}
        </p>
      ) : null}
    </section>
  );
}
