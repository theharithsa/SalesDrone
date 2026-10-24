import { useEffect, useState } from 'react';
import { KeyRound, ExternalLink, Copy, Plus, ShieldCheck } from 'lucide-react';
import { ErrorMessage } from '../components/UI';
type Token = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  active: boolean;
  revokedAt: string | null;
};
type Scope = { id: string; description: string };
type Request = (
  path: string,
  method?: string,
  body?: any,
  key?: string,
) => Promise<any>;
export default function DeveloperSettings({ request }: { request: Request }) {
  const [tokens, setTokens] = useState<Token[]>([]),
    [scopes, setScopes] = useState<Scope[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [name, setName] = useState(''),
    [days, setDays] = useState(30),
    [selected, setSelected] = useState(['leads:read']),
    [secret, setSecret] = useState(''),
    [confirm, setConfirm] = useState<string | null>(null),
    [showCreate, setShowCreate] = useState(false);
  useEffect(() => {
    let current = true;
    setLoading(true);
    request('/personal-access-tokens')
      .then((r) => {
        if (current) {
          setTokens(r.items);
          setScopes(r.availableScopes);
          setCursor(r.nextCursor);
        }
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [request]);
  useEffect(() => {
    const clear = () => setSecret('');
    window.addEventListener('pagehide', clear);
    return () => window.removeEventListener('pagehide', clear);
  }, []);
  async function refresh() {
    const r = await request('/personal-access-tokens');
    setTokens(r.items);
    setScopes(r.availableScopes);
    setCursor(r.nextCursor);
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await request('/personal-access-tokens', 'POST', {
        name,
        scopes: selected,
        expiresInDays: days,
      });
      setSecret(r.token);
      setTokens((t) => [r.personalAccessToken, ...t]);
      setName('');
      setSelected(['leads:read']);
      setShowCreate(false);
    } catch (e) {
      setError(
        (e as Error).message +
          ' If the response was interrupted, refresh the list and revoke the unused token before retrying.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    setBusy(true);
    setError('');
    try {
      await request('/personal-access-tokens/' + id, 'DELETE', {});
      setConfirm(null);
      await refresh();
      setMessage('Token revoked. Further requests will be rejected.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function more() {
    setBusy(true);
    try {
      const r = await request(
        '/personal-access-tokens?cursor=' + encodeURIComponent(cursor!),
      );
      setTokens((t) => {
        const existing = new Set(t.map((item) => item.id));
        return [
          ...t,
          ...r.items.filter((item: Token) => !existing.has(item.id)),
        ];
      });
      setCursor(r.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const date = (v: string | null) =>
    v ? new Date(v).toLocaleString() : 'Not used yet';
  return (
    <section className="developer-settings">
      <div className="panel developer-intro">
        <div className="section-heading">
          <div>
            <span className="eyebrow">INTEGRATIONS</span>
            <h3>
              <KeyRound size={20} /> Personal Access Tokens
            </h3>
            <p>
              Connect your own tools to SalesDrone with only the access they
              need.
            </p>
          </div>
          <a
            className="button"
            href="/api/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            Swagger API portal <ExternalLink size={16} />
          </a>
        </div>
        <div className="notice subtle">
          <ShieldCheck size={20} />
          <p>
            Tokens act as you and follow your current permissions and lead
            access. They expire after 7, 30 or 90 days. They cannot manage
            people, security settings or other tokens. Keep them on a trusted
            server, outside browser apps and shared workbooks.
          </p>
        </div>
      </div>
      <ErrorMessage error={error} />
      {message && (
        <p role="status" className="success-message">
          {message}
        </p>
      )}
      {secret && (
        <div className="panel token-reveal" data-dtrum-mask="" data-dt-mask="">
          <h3>Copy your token now</h3>
          <p>
            This is its only display. SalesDrone stores a hash and cannot
            recover the original. Save it in your integration’s secret manager.
          </p>
          <code aria-label="New personal access token">{secret}</code>
          <div className="form-actions">
            <button
              className="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(secret);
                  setMessage('Token copied. Store it securely.');
                } catch {
                  setError(
                    'Clipboard unavailable. Select and copy the token manually.',
                  );
                }
              }}
            >
              <Copy size={16} /> Copy token
            </button>
            <button
              className="button primary"
              onClick={() => {
                setSecret('');
                setMessage(
                  'Token hidden. You can revoke it in the list below.',
                );
              }}
            >
              I saved it — hide token
            </button>
          </div>
        </div>
      )}
      <div className="panel">
        <div className="section-heading">
          <div>
            <h3>Your tokens</h3>
            <p>
              Up to 20 unexpired tokens. Revocation takes effect on subsequent
              authorization checks.
            </p>
          </div>
          <button
            className="button primary"
            disabled={loading || busy || !!secret}
            onClick={() => setShowCreate(!showCreate)}
          >
            <Plus size={16} />
            {showCreate ? 'Cancel creation' : 'Generate token'}
          </button>
        </div>
        {showCreate && (
          <form className="token-create" onSubmit={create}>
            <div className="token-form-row">
              <label>
                Token name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  required
                  placeholder="For example, reporting integration"
                  autoComplete="off"
                />
              </label>
              <label>
                Expires after
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                >
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                </select>
              </label>
            </div>
            <fieldset>
              <legend>Permission scopes</legend>
              <p className="field-hint">
                Choose only what this integration needs. At least one scope is
                required.
              </p>
              <div className="token-scope-grid">
                {scopes.map((s) => (
                  <label key={s.id} className="token-scope">
                    <input
                      type="checkbox"
                      checked={selected.includes(s.id)}
                      onChange={(e) =>
                        setSelected((v) =>
                          e.target.checked
                            ? [...v, s.id]
                            : v.filter((id) => id !== s.id),
                        )
                      }
                    />
                    <span>
                      <strong>{s.id}</strong>
                      <small>{s.description}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              className="button primary"
              disabled={busy || !name.trim() || !selected.length}
              type="submit"
            >
              {busy ? 'Generating…' : 'Generate personal access token'}
            </button>
          </form>
        )}
        {loading ? (
          <p role="status">Loading your tokens…</p>
        ) : !tokens.length ? (
          <div className="empty-state">
            <KeyRound size={28} />
            <h3>No tokens yet</h3>
            <p>
              Start with read-only access for a reporting tool. Add write scopes
              only when the integration needs them.
            </p>
          </div>
        ) : (
          <div className="token-list">
            {tokens.map((t) => {
              const expired = t.expiresAt <= new Date().toISOString();
              return (
                <article className="token-card" key={t.id}>
                  <div className="token-card-heading">
                    <div>
                      <h4>{t.name}</h4>
                      <code>{t.prefix}</code>
                    </div>
                    <span className="status-pill">
                      {t.revokedAt
                        ? 'Revoked'
                        : expired
                          ? 'Expired'
                          : t.active
                            ? 'Active'
                            : 'Inactive'}
                    </span>
                  </div>
                  <p className="token-scope-summary">{t.scopes.join(' · ')}</p>
                  <dl className="token-dates">
                    <div>
                      <dt>Created</dt>
                      <dd>{date(t.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>Expires</dt>
                      <dd>{date(t.expiresAt)}</dd>
                    </div>
                    <div>
                      <dt>Last used</dt>
                      <dd>{date(t.lastUsedAt)}</dd>
                    </div>
                  </dl>
                  {t.active &&
                    !expired &&
                    (confirm === t.id ? (
                      <div className="token-revoke-confirm">
                        <p>
                          This immediately stops integrations using “{t.name}”.
                        </p>
                        <button
                          className="button danger"
                          disabled={busy}
                          onClick={() => revoke(t.id)}
                        >
                          Confirm revoke
                        </button>
                        <button
                          className="button"
                          disabled={busy}
                          onClick={() => setConfirm(null)}
                        >
                          Keep token
                        </button>
                      </div>
                    ) : (
                      <button
                        className="text-button danger"
                        disabled={busy}
                        onClick={() => setConfirm(t.id)}
                      >
                        Revoke {t.name}
                      </button>
                    ))}
                </article>
              );
            })}
          </div>
        )}
        {cursor && (
          <button className="button" disabled={busy} onClick={more}>
            Load earlier tokens
          </button>
        )}
      </div>
      <div className="panel">
        <h3>Use a token</h3>
        <p>
          Send it in the Authorization header over HTTPS. No App Check header is
          required for a valid personal access token.
        </p>
        <pre className="api-example">
          <code>{`curl 'https://sales-drone-avinya.firebaseapp.com/api/v1/leads?limit=10' \\\n  -H "Authorization: Bearer $SALESDRONE_TOKEN"`}</code>
        </pre>
        <p className="field-hint">
          The Swagger portal documents all supported methods, scopes, request
          bodies, version checks and errors. Token creation requires Google
          sign-in and cannot be performed using another token.
        </p>
      </div>
    </section>
  );
}
