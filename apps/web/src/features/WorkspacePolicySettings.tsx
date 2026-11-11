import { useCallback, useEffect, useState } from 'react';
import { ErrorMessage } from '../components/UI';
export type WorkspacePolicy = {
  version: number;
  exportsEnabled: boolean;
  assignedOnly: boolean;
  memberExportsEnabled: boolean;
  memberIntelligenceEnabled: boolean;
};
export default function WorkspacePolicySettings({
  request,
  onChanged,
  featureAccess = false,
}: {
  request: (p: string, m?: string, b?: any) => Promise<any>;
  onChanged: () => void;
  featureAccess?: boolean;
}) {
  const [config, setConfig] = useState<WorkspacePolicy | null>(null),
    [exportsEnabled, setExports] = useState(true),
    [assignedOnly, setAssigned] = useState(true),
    [memberExportsEnabled, setMemberExports] = useState(true),
    [memberIntelligenceEnabled, setMemberIntelligence] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      const c = await request('/workspace-settings');
      setConfig(c);
      setExports(c.exportsEnabled);
      setAssigned(c.assignedOnly);
      setMemberExports(c.memberExportsEnabled !== false);
      setMemberIntelligence(c.memberIntelligenceEnabled !== false);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [request]);
  useEffect(() => { void load(); }, [load]);
  return (
    <section className="panel workspace-policy-settings">
      {!featureAccess && <h3>Reports & lead access</h3>}
      <p>{featureAccess
        ? 'These settings apply to non-Admin members with the required lead access and individual grants.'
        : 'Workspace-wide controls. Individual member permissions still apply.'}</p>
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
                ...(featureAccess ? { memberExportsEnabled, memberIntelligenceEnabled } : {}),
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
          {featureAccess ? <>
            <label className="report-setting-option" htmlFor="member-lead-export">
              <input id="member-lead-export" type="checkbox" checked={memberExportsEnabled} disabled={busy}
                onChange={(event) => setMemberExports(event.currentTarget.checked)} />
              <span>
                Export leads
                <small>Allow members to export leads they can access. The workspace-wide Excel reports switch must also be on.</small>
              </span>
            </label>
            <label className="report-setting-option" htmlFor="member-intelligence">
              <input id="member-intelligence" type="checkbox" checked={memberIntelligenceEnabled} disabled={busy}
                onChange={(event) => setMemberIntelligence(event.currentTarget.checked)} />
              <span>
                Use AvinyaIntelligence
                <small>Allow dashboard insights, lead scoring, reminders from notes, Lead Assistant and AI-assisted Lead Hygiene.</small>
              </span>
            </label>
          </> : <>
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
          </>}
          <button
            className="button primary"
            disabled={
              busy ||
              (featureAccess
                ? memberExportsEnabled === (config.memberExportsEnabled !== false) &&
                  memberIntelligenceEnabled === (config.memberIntelligenceEnabled !== false)
                : exportsEnabled === config.exportsEnabled && assignedOnly === config.assignedOnly)
            }
          >
            {busy ? 'Saving…' : featureAccess ? 'Save feature access' : 'Save workspace controls'}
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
