import { useEffect, useState } from 'react';
import { ErrorMessage } from '../components/UI';
type Config = {
  version: number;
  instructions: string;
  insightMode: 'manual' | 'automatic';
  defaultInstructions: string;
  usingDefault: boolean;
};
export default function AIPersonalizationSettings({
  request,
}: {
  request: (path: string, method?: string, body?: any) => Promise<any>;
}) {
  const [config, setConfig] = useState<Config | null>(null),
    [text, setText] = useState(''),
    [mode, setMode] = useState<'manual' | 'automatic'>('manual'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    request('/ai-settings')
      .then((c) => {
        if (active) {
          setConfig(c);
          setText(c.instructions);
          setMode(c.insightMode || 'manual');
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [request]);
  return (
    <section className="panel ai-personalization">
      <h3>Shape your workspace insights</h3>
      <p>
        Guide the focus, tone and language of dashboard insights for your team.
        Insights always use the current user’s permitted data.
      </p>
      <ErrorMessage error={error} />
      {error && config ? (
        <button
          className="button"
          type="button"
          disabled={busy}
          onClick={() => {
            setError('');
            request('/ai-settings')
              .then((c) => {
                setConfig(c);
                setText(c.instructions);
                setMode(c.insightMode || 'manual');
                setMessage('Saved preferences reloaded.');
              })
              .catch((e) => setError(e.message));
          }}
        >
          Reload saved preferences
        </button>
      ) : null}
      {config ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            setMessage('');
            try {
              const next = await request('/ai-settings', 'PATCH', {
                expectedVersion: config.version,
                instructions: text,
                insightMode: mode,
              });
              setConfig(next);
              setText(next.instructions);
              setMode(next.insightMode);
              setMessage(
                'AvinyaIntelligence preferences saved. The insight mode applies the next time the dashboard opens.',
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset className="insight-mode-choices" disabled={busy}>
            <legend>When to get insights</legend>
            <label className={mode === 'manual' ? 'selected' : ''}>
              <input
                type="radio"
                name="insightMode"
                value="manual"
                checked={mode === 'manual'}
                onChange={() => setMode('manual')}
              />
              <span>
                <strong>When I ask</strong>
                <small>
                  Show Get insights on the dashboard. Nothing is generated on
                  page load.
                </small>
              </span>
            </label>
            <label className={mode === 'automatic' ? 'selected' : ''}>
              <input
                type="radio"
                name="insightMode"
                value="automatic"
                checked={mode === 'automatic'}
                onChange={() => setMode('automatic')}
              />
              <span>
                <strong>When the dashboard opens</strong>
                <small>
                  Prepare insights automatically and hide the button. This can
                  use more AI requests; recent matching insights are reused.
                </small>
              </span>
            </label>
          </fieldset>
          <label>
            Instructions for insights
            <textarea
              rows={7}
              maxLength={4000}
              value={text}
              disabled={busy}
              placeholder={config.defaultInstructions}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <p className="field-hint">
            For example: “Focus on overdue callbacks and promising leads. Use
            short bullets and a supportive tone.” Leave blank to use the default
            guidance.
          </p>
          <details className="ai-default-guidance">
            <summary>Default guidance</summary>
            <p>{config.defaultInstructions}</p>
          </details>
          <p className="field-hint">
            Instructions can tailor the presentation. They cannot change access
            permissions, invent evidence or trigger outreach.
          </p>
          <div className="form-actions">
            <button
              className="button"
              type="button"
              disabled={busy}
              onClick={() => {
                setText('');
                setMessage(
                  config.usingDefault
                    ? 'Default guidance is already in use.'
                    : 'Save to apply the default guidance.',
                );
              }}
            >
              Use default
            </button>
            <button
              className="button primary"
              disabled={
                busy ||
                (text.trim() === config.instructions &&
                  mode === (config.insightMode || 'manual'))
              }
            >
              {busy ? 'Saving…' : 'Save preferences'}
            </button>
          </div>
        </form>
      ) : !error ? (
        <p role="status">Loading AI preferences…</p>
      ) : (
        <button
          className="button"
          onClick={() => {
            setError('');
            request('/ai-settings')
              .then((c) => {
                setConfig(c);
                setText(c.instructions);
                setMode(c.insightMode || 'manual');
              })
              .catch((e) => setError(e.message));
          }}
        >
          Try again
        </button>
      )}
      {message ? (
        <p className="success-message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
