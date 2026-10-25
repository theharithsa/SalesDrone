import PipelineFunnel from '../components/PipelineFunnel';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock,
  PhoneCall,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
  ChevronRight,
} from 'lucide-react';
import { Entity, Lead, Task, displayDate } from '../lib/types';
import { ErrorMessage, Loading } from '../components/UI';
const colors = [
  '#2284d2',
  '#34a5c0',
  '#65b5d7',
  '#8ec5e7',
  '#abc9de',
  '#6a829a',
];
const sum = (values: any[]) => values.reduce((n, v) => n + v.value, 0);
function Ring({ data, label }: { data: any[]; label: string }) {
  const total = sum(data),
    r = 66,
    c = 2 * Math.PI * r;
  let used = 0;
  return (
    <div className="ring-chart">
      <svg
        viewBox="0 0 180 180"
        role="img"
        aria-label={label + ': ' + total + ' leads'}
      >
        <circle
          cx="90"
          cy="90"
          r={r}
          className="chart-track"
          fill="none"
          strokeWidth="21"
        />
        {data.map((d, i) => {
          const length = total ? (d.value / total) * c : 0,
            offset = -used;
          used += length;
          return (
            <circle
              key={d.label}
              cx="90"
              cy="90"
              r={r}
              fill="none"
              stroke={
                d.label.includes('risk') ? '#ce7568' : colors[i % colors.length]
              }
              strokeWidth="21"
              strokeDasharray={`${Math.max(0, length - 2)} ${c}`}
              strokeDashoffset={offset}
              transform="rotate(-90 90 90)"
            >
              <title>
                {d.label}: {d.value}
              </title>
            </circle>
          );
        })}
        <text x="90" y="88" textAnchor="middle" className="ring-total">
          {total}
        </text>
        <text x="90" y="109" textAnchor="middle" className="ring-caption">
          LEADS
        </text>
      </svg>
      <div className="chart-legend">
        {data.map((d, i) => (
          <div key={d.label}>
            <i
              style={{
                background: d.label.includes('risk')
                  ? '#ce7568'
                  : colors[i % colors.length],
              }}
            />
            <span>{d.label}</span>
            <strong>{d.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
function Bars({ data, kind }: { data: any[]; kind?: string }) {
  const top = data.slice(0, 6),
    rest = data.slice(6).reduce((n, d) => n + d.value, 0),
    values = rest ? [...top, { label: 'Other', value: rest }] : top,
    max = Math.max(1, ...values.map((v) => v.value));
  return (
    <div className="chart-bars">
      {values.length ? (
        values.map((d, i) => (
          <div key={d.label}>
            <div>
              <span>{d.label}</span>
              <strong>{d.value}</strong>
            </div>
            <span className="bar-track">
              <i
                style={{
                  width: `${(d.value / max) * 100}%`,
                  background:
                    kind === 'work' && i === 0
                      ? '#ce7568'
                      : colors[i % colors.length],
                }}
              />
            </span>
          </div>
        ))
      ) : (
        <p className="chart-empty">
          No records yet. Your next update will appear here.
        </p>
      )}
    </div>
  );
}
function Trend({ data }: { data: any[] }) {
  const gradient = useId().replaceAll(':', ''),
    [metric, setMetric] = useState<'calls' | 'newLeads'>('calls'),
    [active, setActive] = useState<number | null>(null),
    max = Math.max(
      2,
      Math.ceil(Math.max(0, ...data.map((d) => d[metric])) / 2) * 2,
    ),
    points = data.map((d, i) => ({
      x: 30 + (i / Math.max(1, data.length - 1)) * 560,
      y: 168 - (d[metric] / max) * 130,
    })),
    line = points.map((p) => `${p.x},${p.y}`).join(' '),
    selected = data[active ?? data.length - 1];
  return (
    <>
      <div className="chart-switch" role="group" aria-label="Trend metric">
        <button
          aria-pressed={metric === 'calls'}
          onClick={() => setMetric('calls')}
        >
          Calls
        </button>
        <button
          aria-pressed={metric === 'newLeads'}
          onClick={() => setMetric('newLeads')}
        >
          Leads added
        </button>
      </div>
      <svg
        className="trend-chart"
        viewBox="0 0 620 210"
        role="img"
        aria-label={
          metric === 'calls'
            ? 'Your calls over the last 14 days'
            : 'Leads added to the visible pipeline over 14 days'
        }
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2b93dd" stopOpacity=".32" />
            <stop offset="100%" stopColor="#2b93dd" stopOpacity=".02" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line
              x1="30"
              y1={168 - v * 130}
              x2="590"
              y2={168 - v * 130}
              className="chart-grid-line"
            />
            <text
              x="16"
              y={172 - v * 130}
              className="chart-axis"
              textAnchor="end"
            >
              {Math.round(max * v)}
            </text>
          </g>
        ))}
        {points.length ? (
          <>
            <polygon
              points={`30,168 ${line} 590,168`}
              fill={`url(#${gradient})`}
            />
            <polyline
              points={line}
              fill="none"
              stroke="#2b93dd"
              strokeWidth="3.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((p, i) => (
              <g key={i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={active === i ? 6 : 4}
                  fill="#2b93dd"
                />
                <circle
                  tabIndex={0}
                  role="button"
                  aria-label={`${data[i].date}: ${data[i][metric]} ${metric === 'calls' ? 'calls' : 'leads added'}`}
                  cx={p.x}
                  cy={p.y}
                  r="13"
                  fill="transparent"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActive(i);
                    }
                  }}
                />
              </g>
            ))}
          </>
        ) : null}
        <text x="30" y="198" className="chart-axis">
          {data[0]?.date.slice(5)}
        </text>
        <text x="590" y="198" className="chart-axis" textAnchor="end">
          {data.at(-1)?.date.slice(5)}
        </text>
      </svg>
      <div className="trend-caption">
        <span>{selected?.date}</span>
        <strong>
          {selected?.[metric] || 0} {metric === 'calls' ? 'calls' : 'added'}
        </strong>
        {metric === 'calls' ? (
          <span>{selected?.connected || 0} connected</span>
        ) : (
          <span>Includes imported enquiries</span>
        )}
      </div>
    </>
  );
}
const grouped = (items: any[], field: string) =>
  Object.entries(
    items.reduce((m, v) => {
      const key = v[field] || 'Not recorded';
      m[key] = (m[key] || 0) + 1;
      return m;
    }, {}),
  ).map(([label, value]) => ({ label, value }));
function demoSnapshot(
  sample: { leads: Lead[]; tasks: Task[]; activities: Entity[] },
  timezone: string,
) {
  const now = new Date(),
    day = (i: number) =>
      new Date(now.getTime() + i * 86400000).toISOString().slice(0, 10),
    pending = sample.tasks.filter((t) => t.state === 'Pending'),
    trend = Array.from({ length: 14 }, (_, i) => {
      const date = day(i - 13),
        calls = sample.activities.filter(
          (a) => a.type === 'call' && a.createdAt.slice(0, 10) === date,
        );
      return {
        date,
        calls: calls.length,
        connected: calls.filter((a) => a.outcome === 'Connected').length,
        newLeads: sample.leads.filter((l) => l.createdAt?.slice(0, 10) === date)
          .length,
      };
    });
  const overdue = pending.filter(
    (t) => Date.parse(t.dueAt) < now.getTime(),
  ).length;
  return {
    asOf: now.toISOString(),
    timezone,
    facts: {
      overdueTasks: overdue,
      dueToday: pending.filter(
        (t) =>
          Date.parse(t.dueAt) >= now.getTime() &&
          t.dueAt.slice(0, 10) === day(0),
      ).length,
      pendingTasks: pending.length,
      calls14: sample.activities.filter((a) => a.type === 'call').length,
      connected14: sample.activities.filter((a) => a.outcome === 'Connected')
        .length,
      knownScores: 0,
      highPriorityLeads: 0,
      unscoredLeads: sample.leads.length,
    },
    coverage: {
      leadsScanned: sample.leads.length,
      totalLeads: sample.leads.length,
    },
    stages: grouped(sample.leads, 'stage'),
    sectors: grouped(sample.leads, 'zone'),
    cities: grouped(sample.leads, 'location'),
    outcomes: grouped(sample.activities, 'outcome'),
    trend,
    workload: [
      { label: 'Overdue', value: overdue },
      { label: 'Upcoming', value: pending.length - overdue },
    ],
    scoreDistribution: [
      { label: 'Not scored / unknown', value: sample.leads.length },
    ],
    priority: [],
    tasks: pending.map((t) => ({
      ...t,
      leadName: sample.leads.find((l) => l.id === t.leadId)?.name,
    })),
  };
}
export default function DashboardPage({
  request,
  demo,
  firstName,
  timezone,
  sample,
  refreshKey,
  onNew,
  onLead,
  onTask,
  onTasks,
  stageOrder,
  onStage,
}: {
  request: (p: string, m?: string, b?: any) => Promise<any>;
  demo: boolean;
  firstName: string;
  timezone: string;
  sample: { leads: Lead[]; tasks: Task[]; activities: Entity[] };
  refreshKey: number;
  onNew?: () => void;
  onLead: (id: string) => Promise<void>;
  onTask: (id: string) => Promise<void>;
  onTasks: () => void;
  stageOrder: string[];
  onStage: (stage: string) => void;
}) {
  const [snapshot, setSnapshot] = useState<any>(null),
    [brief, setBrief] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [briefBusy, setBriefBusy] = useState(false),
    [error, setError] = useState(''),
    [briefError, setBriefError] = useState(''),
    [geography, setGeography] = useState<'sectors' | 'cities'>('sectors');
  const loadEpoch = useRef(0);
  const load = useCallback(async () => {
    const epoch = ++loadEpoch.current;
    setBusy(true);
    setError('');
    try {
      const d = demo
        ? demoSnapshot(sample, timezone)
        : await request('/dashboard');
      if (epoch === loadEpoch.current) setSnapshot(d);
    } catch (e) {
      if (epoch === loadEpoch.current) setError((e as Error).message);
    } finally {
      if (epoch === loadEpoch.current) setBusy(false);
    }
  }, [
    request,
    demo,
    timezone,
    demo ? sample.leads : null,
    demo ? sample.tasks : null,
    demo ? sample.activities : null,
  ]);
  useEffect(() => {
    void load();
    return () => {
      loadEpoch.current++;
    };
  }, [load, refreshKey]);
  const briefInFlight = useRef(false);
  const briefEpoch = useRef(0);
  useEffect(
    () => () => {
      briefEpoch.current++;
    },
    [],
  );
  const refreshBrief = useCallback(async () => {
    if (demo || briefInFlight.current) return;
    briefInFlight.current = true;
    const epoch = ++briefEpoch.current;
    setBriefBusy(true);
    setBriefError('');
    try {
      const result = await request('/dashboard/insights', 'POST', {});
      if (epoch === briefEpoch.current) setBrief(result);
    } catch (e) {
      if (epoch === briefEpoch.current) setBriefError((e as Error).message);
    } finally {
      briefInFlight.current = false;
      if (epoch === briefEpoch.current) setBriefBusy(false);
    }
  }, [request, demo]);
  const autoRequested = useRef(false);
  const automaticInsights = !demo && snapshot?.insightMode === 'automatic';
  useEffect(() => {
    if (!automaticInsights) {
      autoRequested.current = false;
      return;
    }
    if (autoRequested.current) return;
    autoRequested.current = true;
    void refreshBrief();
  }, [automaticInsights, refreshBrief]);
  async function open(action: () => Promise<void>) {
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const facts = snapshot?.facts || {},
    b = brief?.status === 'Ready' ? brief.brief : null;
  return (
    <div className="page-body dashboard-page">
      <div className="page-title">
        <div>
          <span className="eyebrow">SIGNALS INTO MOMENTUM</span>
          <h1>Your pipeline, in perspective.</h1>
          <p>
            {firstName}, here’s where your next conversation can make a
            difference.
          </p>
        </div>
        <div className="dashboard-title-actions">
          <button
            className="button"
            disabled={busy}
            onClick={() => void load()}
          >
            <RefreshCw size={16} className={busy ? 'spin' : ''} />
            Refresh
          </button>
          {onNew ? (
            <button className="button primary" onClick={onNew}>
              <Plus size={16} />
              New enquiry
            </button>
          ) : null}
        </div>
      </div>
      <ErrorMessage error={error} />
      {!snapshot ? (
        <Loading />
      ) : (
        <>
          <section className="dashboard-brief">
            <div className="brief-orbit" aria-hidden="true">
              <span />
              <span />
              <Sparkles size={30} />
            </div>
            <div className="brief-main">
              <div className="brief-heading-row">
                <span className="eyebrow">
                  <Sparkles size={13} />
                  {demo
                    ? 'DEMO WORKSPACE SNAPSHOT'
                    : b
                      ? 'AI INSIGHTS'
                      : briefBusy
                        ? 'WORKING ON IT'
                        : 'YOUR SNAPSHOT'}
                </span>
                {!demo && !automaticInsights ? (
                  <button
                    className="insights-action"
                    disabled={briefBusy}
                    onClick={() => void refreshBrief()}
                  >
                    <Sparkles size={15} />
                    {briefBusy
                      ? 'Working…'
                      : b
                        ? 'Refresh insights'
                        : 'Get insights'}
                  </button>
                ) : null}
              </div>
              <h2>
                {briefBusy
                  ? 'Connecting the dots…'
                  : b?.headline || 'Make room for the next right move.'}
              </h2>
              <p>
                {briefBusy
                  ? 'Reading your outstanding reminders and outreach snapshot.'
                  : b?.summary ||
                    `${facts.overdueTasks || 0} overdue reminders and ${facts.unscoredLeads || 0} leads still need qualification context. Start with a clear next step.`}
              </p>
              <div className="brief-source-line">
                {demo
                  ? 'Sample data · no AI request'
                  : brief?.asOf || snapshot.asOf
                    ? (b ? 'Summary snapshot ' : 'Snapshot ') +
                      displayDate(brief?.asOf || snapshot.asOf, timezone)
                    : ''}
              </div>
              {!demo && !automaticInsights && !b && !briefBusy ? (
                <p className="field-hint">
                  Insights are ready when you need them.
                </p>
              ) : null}
              {briefError ? (
                <p className="brief-error" role="status">
                  AI summary unavailable: {briefError}. Your charts remain
                  available.{' '}
                  {automaticInsights
                    ? 'Reopen the dashboard to try again.'
                    : ''}
                </p>
              ) : null}
              {brief?.status === 'Processing' ? (
                <p className="field-hint">
                  {automaticInsights
                    ? 'Insights are being prepared in another session. Reopen the dashboard shortly.'
                    : 'A summary is being prepared in another session. Try again in a moment.'}
                </p>
              ) : null}
            </div>
          </section>
          {b?.insights?.length ? (
            <div className="insight-grid">
              {b.insights.map((insight: any, i: number) => (
                <article
                  className={'insight-card insight-' + insight.type}
                  key={i}
                >
                  <span className="insight-index">0{i + 1}</span>
                  <h3>{insight.title}</h3>
                  <p>{insight.detail}</p>
                  <div>
                    {insight.taskIds?.slice(0, 1).map((id: string) => (
                      <button
                        className="text-button"
                        key={id}
                        onClick={() => void open(() => onTask(id))}
                      >
                        Open reminder <ArrowUpRight size={13} />
                      </button>
                    ))}
                    {insight.leadIds?.slice(0, 1).map((id: string) => (
                      <button
                        className="text-button"
                        key={id}
                        onClick={() => void open(() => onLead(id))}
                      >
                        View lead <ArrowUpRight size={13} />
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
          <div className="dashboard-kpis">
            {[
              {
                label: 'Visible pipeline',
                value: snapshot.coverage.totalLeads,
                icon: UsersRound,
                note: 'Within your access',
              },
              {
                label: 'Open reminders',
                value: facts.pendingTasks,
                icon: Clock,
                note: facts.overdueTasks + ' overdue',
              },
              {
                label: 'Calls · 14 days',
                value: facts.calls14,
                icon: PhoneCall,
                note: facts.connected14 + ' connected',
              },
              {
                label: 'Scored leads',
                value: facts.knownScores,
                icon: Target,
                note: facts.highPriorityLeads + ' high priority',
              },
            ].map((k) => (
              <div key={k.label}>
                <div>
                  <span>{k.label}</span>
                  <k.icon size={18} />
                </div>
                <strong>{k.value ?? 0}</strong>
                <small>{k.note}</small>
              </div>
            ))}
          </div>
          <PipelineFunnel
            counts={snapshot.stages}
            order={snapshot.stageOrder || stageOrder}
            onStage={onStage}
          />
          <div className="dashboard-chart-grid">
            <section className="panel chart-panel">
              <div className="chart-heading">
                <div>
                  <span className="eyebrow">PIPELINE COMPOSITION</span>
                  <h2>A view of every stage</h2>
                </div>
                <BarChart3 size={21} />
              </div>
              <Ring data={snapshot.stages} label="Pipeline stages" />
              <p className="chart-note">
                Stage distribution across {snapshot.coverage.leadsScanned}{' '}
                visible leads. This is a snapshot, not a conversion funnel.
              </p>
            </section>
            <section className="panel chart-panel">
              <div className="chart-heading">
                <div>
                  <span className="eyebrow">14-DAY PULSE</span>
                  <h2>Keep the conversation moving</h2>
                </div>
                <TrendingUp size={21} />
              </div>
              <Trend data={snapshot.trend} />
              <p className="chart-note">
                Calls are your recorded outreach; leads added covers the
                pipeline you can access.
              </p>
            </section>
            <section className="panel chart-panel">
              <div className="chart-heading">
                <div>
                  <span className="eyebrow">YOUR REMINDERS</span>
                  <h2>Where attention is due</h2>
                </div>
                <Clock size={21} />
              </div>
              <Bars data={snapshot.workload} kind="work" />
              <button className="text-button" onClick={onTasks}>
                Plan your follow-ups <ArrowUpRight size={14} />
              </button>
            </section>
            <section className="panel chart-panel">
              <div className="chart-heading">
                <div>
                  <span className="eyebrow">KNOW YOUR MARKET</span>
                  <h2>
                    {geography === 'sectors'
                      ? 'Your sector mix'
                      : 'Where your leads are'}
                  </h2>
                </div>
              </div>
              <div
                className="chart-switch"
                role="group"
                aria-label="Market breakdown"
              >
                <button
                  aria-pressed={geography === 'sectors'}
                  onClick={() => setGeography('sectors')}
                >
                  Sectors
                </button>
                <button
                  aria-pressed={geography === 'cities'}
                  onClick={() => setGeography('cities')}
                >
                  Cities
                </button>
              </div>
              <Bars data={snapshot[geography]} />
              <p className="chart-note">
                Missing values stay visible as “Not recorded.”
              </p>
            </section>
            <section className="panel chart-panel">
              <div className="chart-heading">
                <div>
                  <span className="eyebrow">QUALIFICATION COVERAGE</span>
                  <h2>Potential, with perspective</h2>
                </div>
                <Target size={21} />
              </div>
              <Ring
                data={snapshot.scoreDistribution}
                label="Lead score distribution"
              />
              <p className="chart-note">
                Scores reflect reported evidence under your admin’s model.
                Unknown leads are not scored as zero.
              </p>
            </section>
            <section className="panel chart-panel">
              <div className="chart-heading">
                <div>
                  <span className="eyebrow">OUTREACH OUTCOMES</span>
                  <h2>What conversations tell you</h2>
                </div>
                <CheckCircle2 size={21} />
              </div>
              <Bars data={snapshot.outcomes} />
              <p className="chart-note">
                Your visible call outcomes in the last 14 days.
              </p>
            </section>
          </div>
          <div className="dashboard-bottom-grid">
            <section className="panel dashboard-next">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">NEXT ON YOUR RADAR</span>
                  <h2>Close the loop</h2>
                </div>
                <button className="text-button" onClick={onTasks}>
                  All tasks <ArrowUpRight size={14} />
                </button>
              </div>
              {snapshot.tasks.length ? (
                snapshot.tasks.slice(0, 5).map((t: any) => (
                  <button
                    className="dashboard-task"
                    key={t.id}
                    onClick={() => void open(() => onTask(t.id))}
                  >
                    <span
                      className={
                        Date.parse(t.dueAt) < Date.now()
                          ? 'due-marker overdue'
                          : 'due-marker'
                      }
                    >
                      <Clock size={16} />
                    </span>
                    <span>
                      <strong>{t.title}</strong>
                      <small>
                        {t.leadName || 'Personal reminder'} ·{' '}
                        {displayDate(t.dueAt, timezone)}
                      </small>
                    </span>
                    <ChevronRight size={17} />
                  </button>
                ))
              ) : (
                <p className="chart-empty">
                  No open reminders. Add a dated next step after your next
                  conversation.
                </p>
              )}
            </section>
            <section className="panel dashboard-next">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">LEADS TO REVIEW</span>
                  <h2>Leads to look closer at</h2>
                </div>
                <Target size={21} />
              </div>
              {snapshot.priority.length ? (
                snapshot.priority.map((p: any) => (
                  <button
                    className="dashboard-task"
                    key={p.leadId}
                    onClick={() => void open(() => onLead(p.leadId))}
                  >
                    <span className="priority-score">{p.score}</span>
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        {p.band}
                        {p.hasRisk ? ' · Reported risk' : ''}
                      </small>
                    </span>
                    <ChevronRight size={17} />
                  </button>
                ))
              ) : (
                <p className="chart-empty">
                  Lead scores populate in the background. Open a lead to refresh
                  its score and review the evidence.
                </p>
              )}
            </section>
          </div>
          <p className="dashboard-coverage">
            {snapshot.coverage.leadsScanned}/{snapshot.coverage.totalLeads}{' '}
            permitted leads included · Reminders are personal to you ·{' '}
            {timezone}
            {snapshot.coverage.leadsTruncated ||
            snapshot.coverage.tasksTruncated ||
            snapshot.coverage.callsTruncated
              ? ' · Bounded snapshot: some records are not included.'
              : ''}
            . AI insights are suggestions, not automatic actions.
          </p>
        </>
      )}
    </div>
  );
}
