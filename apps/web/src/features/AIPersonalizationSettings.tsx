import { useEffect, useState } from 'react';
import { ErrorMessage } from '../components/UI';
type Config = {
  version: number;
  instructions: string;
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
        Insights still use the current user’s permitted data and only run when
        requested.
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
                setMessage('Saved instructions reloaded.');
              })
              .catch((e) => setError(e.message));
          }}
        >
          Reload saved instructions
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
              });
              setConfig(next);
              setText(next.instructions);
              setMessage(
                next.usingDefault
                  ? 'Default AI guidance restored.'
                  : 'AI instructions saved. Get insights to apply them.',
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
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
              disabled={busy || text.trim() === config.instructions}
            >
              {busy ? 'Saving…' : 'Save instructions'}
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
