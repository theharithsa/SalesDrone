import ScoreRing from './ScoreRing';
import { scoreDisplay } from '../lib/score-display';
import { useEffect, useState } from 'react';
import { RefreshCw, ChevronDown, ShieldAlert } from 'lucide-react';
import { Entity, displayDate } from '../lib/types';
import { ErrorMessage } from './UI';
export function ScoreBadge({ score }: { score?: any }) {
  const display = scoreDisplay(
    score?.status === 'Disabled' ? null : score?.score,
  );
  return (
    <span
      className={
        'score-badge ' +
        (score?.hasRisk
          ? 'score-risk'
          : display.score !== null && display.score >= 70
            ? 'score-high'
            : '')
      }
      role="img"
      aria-label={
        'Lead score: ' +
        display.label +
        (score?.hasRisk ? ' · Reported risk' : '')
      }
      title={
        display.score === null
          ? 'Not scored yet or not enough reported evidence'
          : `${score?.hasRisk ? 'Reported risk · ' : ''}${score.band} · ${score.knownFactors || 0}/${score.totalFactors || 0} factors have reported evidence`
      }
    >
      <ScoreRing value={display.score} />
      {score?.hasRisk ? <ShieldAlert size={12} aria-hidden="true" /> : null}
      {display.score === null ? '—' : display.score}
      <small>{display.score === null ? 'Unscored' : '/100'}</small>
    </span>
  );
}
export default function LeadScore({
  leadId,
  version,
  request,
  canRefresh,
  timezone,
  demo = false,
  onReport,
}: {
  leadId: string;
  version: number;
  request: (p: string, m?: string, b?: any) => Promise<any>;
  canRefresh: boolean;
  timezone: string;
  demo?: boolean;
  onReport?: (leadId: string, report: any) => void;
}) {
  const [report, setReport] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    if (demo) {
      const placeholder = {
        status: 'Ready',
        score: null,
        factors: [],
        knownFactors: 0,
        totalFactors: 14,
      };
      setReport(placeholder);
      onReport?.(leadId, placeholder);
      return;
    }
    let alive = true;
    setReport(null);
    onReport?.(leadId, null);
    setError('');
    const get = () =>
      request('/leads/' + leadId + '/score')
        .then((r) => {
          if (alive) {
            setReport(r);
            onReport?.(leadId, r);
          }
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    void get();
    const timer = setInterval(() => void get(), 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [leadId, version, request, demo, onReport]);
  async function refresh() {
    setBusy(true);
    setError('');
    try {
      const result = await request(
        '/leads/' + leadId + '/score/refresh',
        'POST',
        {},
      );
      setReport(result);
      onReport?.(leadId, result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="detail-section lead-score-panel">
      <div className="score-section-heading">
        <h3>LEAD SCORE</h3>
        {canRefresh && !demo ? (
          <button
            className="icon-button"
            aria-label="Refresh lead score"
            disabled={busy}
            onClick={() => void refresh()}
          >
            <RefreshCw size={15} className={busy ? 'spin' : ''} />
          </button>
        ) : null}
      </div>
      <div className="lead-score-number">
        <ScoreRing value={report?.score} />
        <strong>{report?.score ?? '—'}</strong>
        <span>
          {report?.score === null || report?.score === undefined
            ? report?.status === 'Ready'
              ? 'Unscored'
              : 'Evidence pending'
            : '/100'}
        </span>
        {report?.hasRisk ? <ShieldAlert size={22} /> : null}
      </div>
      <p className="score-band">
        {busy
          ? 'Reading the latest evidence…'
          : report?.status === 'Disabled'
            ? 'Scoring disabled'
            : report?.status === 'Failed'
              ? 'Analysis unavailable · retry later'
              : report?.status === 'Processing'
                ? 'Analysis in progress'
                : report?.status === 'Stale'
                  ? 'Notes changed · refreshing in the background'
                  : report?.band ||
                    'Scores build from reported business evidence.'}
      </p>
      {report?.status === 'Ready' ? (
        <>
          <div className="score-components">
            <span>
              Fit <b>{report.score == null ? '—' : report.fit || 0}</b>
            </span>
            <span>
              Intent <b>{report.score == null ? '—' : report.intent || 0}</b>
            </span>
            <span>
              Risk <b>{report.score == null ? '—' : report.penalty ? `−${report.penalty}` : 0}</b>
            </span>
          </div>
          <p className="field-hint">
            {report.knownFactors || 0}/{report.totalFactors || 0} factors have
            reported evidence. Missing information is not a negative signal.
          </p>
          {report.factors?.length ? (
            <details className="score-evidence">
              <summary>
                Factors & evidence <ChevronDown size={14} />
              </summary>
              {report.factors.map((f: Entity) => (
                <div key={f.id} className="score-factor">
                  <div className="score-factor-heading">
                    <strong>{f.label}</strong>
                    {['present', 'not_met'].includes(f.state) ? <b>
                      {f.points > 0 ? '+' : ''}
                      {f.points}
                    </b> : null}
                  </div>
                  <small>
                    {f.state === 'present'
                      ? 'Reported match'
                      : f.state === 'not_met'
                        ? 'Reported as not met'
                        : f.state === 'conflict'
                          ? 'Conflicting reports · review'
                          : 'Not recorded'}
                  </small>
                  {f.evidence?.map((e: any, i: number) => (
                    <blockquote key={i}>{e.quote}</blockquote>
                  ))}
                </div>
              ))}
            </details>
          ) : null}
          {report.scoredAt ? (
            <p className="field-hint">
              Evidence read {displayDate(report.scoredAt, timezone)} ·{' '}
              {report.notesIncluded || 0} recent notes
              {report.sourcesTruncated ? ' · partial history' : ''}.
            </p>
          ) : null}
        </>
      ) : (
        <p className="field-hint">
          Scores update in the background.{' '}
          {canRefresh && !demo ? 'Use Refresh to analyse this lead now.' : ''}
        </p>
      )}
      <p className="field-hint">
        For sales prioritization. Credit, licensing and distance claims are not
        independently verified.
      </p>
      <ErrorMessage error={error} />
    </section>
  );
}
