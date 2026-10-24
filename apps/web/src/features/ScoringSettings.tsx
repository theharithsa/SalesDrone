import { useEffect, useState } from 'react';
import { Plus, Trash2, Target, Save } from 'lucide-react';
import { ErrorMessage, Loading } from '../components/UI';
export type ScoringFactor = {
  id: string;
  label: string;
  group: 'fit' | 'intent' | 'risk';
  weight: number;
  description: string;
  enabled: boolean;
};
export type ScoringConfig = {
  version: number;
  enabled: boolean;
  factors: ScoringFactor[];
};
export default function ScoringSettings({
  request,
}: {
  request: (p: string, m?: string, b?: any) => Promise<any>;
}) {
  const [config, setConfig] = useState<ScoringConfig | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  useEffect(() => {
    let alive = true;
    request('/scoring-settings')
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
  function change(id: string, values: Partial<ScoringFactor>) {
    setConfig((c) =>
      c
        ? {
            ...c,
            factors: c.factors.map((f) =>
              f.id === id ? { ...f, ...values } : f,
            ),
          }
        : c,
    );
    setMessage('');
  }
  async function save() {
    if (!config) return;
    setBusy(true);
    setError('');
    try {
      const updated = await request('/scoring-settings', 'PATCH', {
        expectedVersion: config.version,
        enabled: config.enabled,
        factors: config.factors,
      });
      setConfig(updated);
      setMessage(
        'Scoring factors saved. Scores update using the new rules; weight-only changes apply immediately.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel scoring-settings">
      <div className="section-heading">
        <div>
          <h3>Qualification model</h3>
          <p>Define the evidence that matters to your business.</p>
        </div>
        <Target size={23} />
      </div>
      <ErrorMessage error={error} />
      {!config ? (
        <Loading />
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={config.enabled}
              disabled={busy}
              onChange={(e) =>
                setConfig({ ...config, enabled: e.target.checked })
              }
            />
            Enable AI-assisted lead scoring
          </label>
          <div className="score-method-note">
            <strong>Fit + Intent − Red flags</strong>
            <p>
              Matched Fit and Intent points are normalized to 100. Red-flag
              weights are subtracted, then the result is limited to 0–100.
              Unknown evidence adds no points and is shown separately. Notes are
              reported claims, not credit or licence verification.
            </p>
          </div>
          {(['fit', 'intent', 'risk'] as const).map((group) => (
            <fieldset key={group} className="factor-group">
              <legend>
                {group === 'fit'
                  ? '01 · Fit'
                  : group === 'intent'
                    ? '02 · Intent'
                    : '03 · Red flags'}
              </legend>
              {config.factors
                .filter((f) => f.group === group)
                .map((f) => (
                  <div className="factor-editor" key={f.id}>
                    <div className="factor-editor-top">
                      <label>
                        Factor name
                        <input
                          value={f.label}
                          required
                          maxLength={80}
                          disabled={busy}
                          onChange={(e) =>
                            change(f.id, { label: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        {group === 'risk' ? 'Penalty' : 'Weight'}
                        <input
                          type="number"
                          min={1}
                          max={100}
                          required
                          value={f.weight}
                          disabled={busy}
                          onChange={(e) =>
                            change(f.id, { weight: Number(e.target.value) })
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="icon-button danger"
                        aria-label={'Remove factor ' + f.label}
                        disabled={busy}
                        onClick={() =>
                          setConfig({
                            ...config,
                            factors: config.factors.filter(
                              (v) => v.id !== f.id,
                            ),
                          })
                        }
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                    <label>
                      Evidence condition
                      <textarea
                        rows={3}
                        maxLength={600}
                        minLength={10}
                        required
                        value={f.description}
                        disabled={busy}
                        onChange={(e) =>
                          change(f.id, { description: e.target.value })
                        }
                      />
                    </label>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={f.enabled}
                        disabled={busy}
                        onChange={(e) =>
                          change(f.id, { enabled: e.target.checked })
                        }
                      />
                      Use this factor
                    </label>
                  </div>
                ))}
              <button
                type="button"
                className="button"
                disabled={busy || config.factors.length >= 30}
                onClick={() =>
                  setConfig({
                    ...config,
                    factors: [
                      ...config.factors,
                      {
                        id: 'factor_' + crypto.randomUUID().replaceAll('-', ''),
                        label: '',
                        group,
                        weight: 10,
                        description: '',
                        enabled: true,
                      },
                    ],
                  })
                }
              >
                <Plus size={16} />
                Add {group === 'risk' ? 'red flag' : group + ' factor'}
              </button>
            </fieldset>
          ))}
          <p className="field-hint">
            Up to 30 factors. Describe explicit business evidence; never ask the
            model to guess missing facts. Relevant lead notes and business
            fields are sent to Gemini. Free-text notes may contain information
            entered by your team. Removing a factor changes the model, not lead
            history.
          </p>
          <ErrorMessage error={error} />
          {message ? (
            <p role="status" className="success-message">
              {message}
            </p>
          ) : null}
          <button className="button primary" disabled={busy}>
            <Save size={16} />
            {busy ? 'Saving…' : 'Save scoring model'}
          </button>
        </form>
      )}
    </section>
  );
}
