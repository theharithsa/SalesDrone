import WorkspacePageHeader from '../components/WorkspacePageHeader';
import { useEffect, useRef, useState } from "react";
import {
  Users,
  MessageSquare,
  PhoneCall,
  CheckCheck,
  RefreshCw,
  ArrowUpRight,
} from "lucide-react";
import { Avatar, ErrorMessage, Loading } from "../components/UI";
import "../material/team.css";
type Member = {
  id: string;
  name: string;
  role: string;
  active: boolean;
  assigned: number;
  comments: number;
  calls: number;
  connected: number;
  leadsWorked: number;
  stageChanges: number;
  pending: number;
  overdue: number;
  completed: number;
  lastActivityAt: string | null;
  stages: { label: string; value: number }[];
};
type Snapshot = {
  generatedAt: string;
  since: string;
  days: number;
  timezone: string;
  members: Member[];
  unassigned: number;
  unlistedAssigned: number;
  trend: { date: string; comments: number; calls: number }[];
};
type Activity = {
  id: string;
  type: string;
  notes: string;
  outcome: string | null;
  createdAt: string;
  revision: number;
  lead: { id: string; name: string };
};
export default function TeamPage({
  request,
  onLeads,
  demo = false,
}: {
  request: (p: string) => Promise<any>;
  onLeads: (member: string) => void;
  demo?: boolean;
}) {
  const [days, setDays] = useState("30"),
    [view, setView] = useState("overview"),
    [selected, setSelected] = useState(""),
    [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const [range, setRange] = useState({ from: '', to: '' });
  const [windowQuery, setWindowQuery] = useState('');
  const [rangeError, setRangeError] = useState('');
  const query = days === 'custom' || days === '24h' ? windowQuery : 'days=' + days;
  function selectPeriod(value: string) {
    setDays(value);
    setRangeError('');
    if (value === '24h') {
      const end = Date.now();
      setWindowQuery(new URLSearchParams({from: new Date(end - 86400000).toISOString(), to: new Date(end).toISOString()}).toString());
    } else setWindowQuery('');
  }
  const activityEpoch = useRef(0);
  const [activity, setActivity] = useState<Activity[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [activityBusy, setActivityBusy] = useState(false),
    [activityError, setActivityError] = useState("");
  useEffect(() => {
    let alive = true;
    setSnapshot(null);
    setBusy(!!query);
    setError("");
    if (!query) return;
    request("/team?" + query)
      .then((r) => {
        if (alive) setSnapshot(r);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [request, query, refresh]);
  useEffect(() => {
    let alive = true;
    const epoch = ++activityEpoch.current;
    setActivity([]);
    setCursor(null);
    setActivityError("");
    if (!query || view !== "activity" || !selected) {
      setActivityBusy(false);
      return;
    }
    setActivityBusy(true);
    request(
      "/team/members/" +
        encodeURIComponent(selected) +
        "/activities?" +
        query +
        "&limit=20",
    )
      .then((r) => {
        if (alive) {
          setActivity(r.items);
          setCursor(r.nextCursor);
        }
      })
      .catch((e) => {
        if (alive) setActivityError(e.message);
      })
      .finally(() => {
        if (alive) setActivityBusy(false);
      });
    return () => {
      alive = false;
      if (activityEpoch.current === epoch) activityEpoch.current = epoch + 1;
    };
  }, [request, query, selected, view, refresh]);
  const member = snapshot?.members.find((m) => m.id === selected),
    total = (field: keyof Member) =>
      snapshot?.members.reduce((n, m) => n + Number(m[field] || 0), 0) || 0;
  const max = Math.max(1, ...(snapshot?.members.map((m) => m.assigned) || [])),
    trendMax = Math.max(
      1,
      ...(snapshot?.trend.map((t) => t.calls + t.comments) || []),
    );
  const date = (v: string) =>
    new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(new Date(v));
  return (
    <div className="page-body team-page" data-private="true">
      <WorkspacePageHeader
        title="Team"
        description="Review current workload and recorded activity across your workspace."
      />
      <div className="team-controls">
        <div className="team-toolbar">
          <label>
            Activity period
            <select
              aria-label="Team activity period"
              value={days}
              onChange={(e) => selectPeriod(e.target.value)}
            >
              <option value="24h">Last 24 hours</option>
              {["7", "30"].map((d) => (
                <option key={d} value={d}>
                  Last {d} days
                </option>
              ))}
              <option value="custom">Custom dates</option>
            </select>
          </label>
          <button
            className="icon-button"
            aria-label="Refresh team"
            disabled={busy}
            onClick={() => { if (days === "24h") selectPeriod(days); setRefresh((v) => v + 1); }}
          >
            <RefreshCw size={18} />
          </button>
        </div>
        {days === 'custom' ? (
          <form className="team-toolbar team-custom-range" onSubmit={(event) => {
            event.preventDefault();
            const from = range.from + 'T00:00:00.000Z', to = range.to + 'T23:59:59.999Z';
            const duration = Date.parse(to) - Date.parse(from);
            if (!Number.isFinite(duration) || duration <= 0 || duration > 90 * 86400000) {
              setRangeError('Choose up to 90 days in chronological order.');
              return;
            }
            setRangeError('');
            setWindowQuery(new URLSearchParams({from, to}).toString());
          }}>
            <label>From (UTC)<input required type="date" value={range.from} onChange={(e) => setRange({...range, from:e.target.value})} /></label>
            <label>Through (UTC)<input required type="date" min={range.from} value={range.to} onChange={(e) => setRange({...range, to:e.target.value})} /></label>
            <button className="button tonal" type="submit">Apply dates</button>
            <ErrorMessage error={rangeError} />
          </form>
        ) : null}
      </div>
      <div className="team-view-switch" role="group" aria-label="Team views">
        <button
          className={"button " + (view === "overview" ? "tonal" : "")}
          aria-pressed={view === "overview"}
          onClick={() => setView("overview")}
        >
          Overview
        </button>
        <button
          className={"button " + (view === "activity" ? "tonal" : "")}
          aria-pressed={view === "activity"}
          onClick={() => setView("activity")}
        >
          Member activity
        </button>
      </div>
      {demo ? (
        <p className="field-hint">Demo data · Fictional people and activity.</p>
      ) : null}
      <ErrorMessage error={error} />
      {busy ? <Loading /> : null}
      {snapshot ? (
        <>
          <p className="team-snapshot-note">
            Updated {date(snapshot.generatedAt)} UTC · Activity covers{" "}
            {date(snapshot.since)} UTC onward. Workload shows current
            assignment.
          </p>
          {view === "overview" ? (
            <>
              <div className="team-kpis">
                {[
                  {
                    label: "Assigned leads",
                    value: total("assigned"),
                    icon: Users,
                  },
                  {
                    label: "Comments added",
                    value: total("comments"),
                    icon: MessageSquare,
                  },
                  {
                    label: "Calls recorded",
                    value: total("calls"),
                    icon: PhoneCall,
                  },
                  {
                    label: "Assigned tasks completed",
                    value: total("completed"),
                    icon: CheckCheck,
                  },
                ].map((k) => (
                  <article className="team-kpi" key={k.label}>
                    <k.icon size={19} />
                    <strong>{k.value.toLocaleString()}</strong>
                    <span>{k.label}</span>
                  </article>
                ))}
              </div>
              <div className="team-chart-grid">
                <section className="card team-chart">
                  <h2>Current workload</h2>
                  <p>
                    {snapshot.unassigned} unassigned leads
                    {snapshot.unlistedAssigned
                      ? ` · ${snapshot.unlistedAssigned} assigned to unavailable members`
                      : ""}
                  </p>
                  <div className="team-workload">
                    {snapshot.members.map((m) => (
                      <button key={m.id} onClick={() => onLeads(m.id)}>
                        <span>{m.name}</span>
                        <span className="team-bar-track">
                          <span
                            style={{ width: (100 * m.assigned) / max + "%" }}
                          />
                        </span>
                        <strong>{m.assigned}</strong>
                        <ArrowUpRight size={14} />
                      </button>
                    ))}
                  </div>
                </section>
                <section className="card team-chart">
                  <h2>Recorded outreach</h2>
                  <p>Comments and calls · UTC calendar days</p>
                  <div className="team-trend-frame">
                    <div className="team-trend-axis" aria-hidden="true">
                      <span>{trendMax}</span>
                      <span>0</span>
                    </div>
                    <div
                      className="team-trend"
                      role="img"
                      aria-label={snapshot.trend
                        .map(
                          (t) =>
                            `${t.date}: ${t.comments} comments, ${t.calls} calls`,
                        )
                        .join("; ")}
                    >
                      {snapshot.trend.map((t) => (
                        <div
                          key={t.date}
                          title={`${t.date}: ${t.comments} comments, ${t.calls} calls`}
                        >
                          <span
                            className="team-trend-comments"
                            style={{
                              height: (120 * t.comments) / trendMax + "px",
                            }}
                          />
                          <span
                            className="team-trend-calls"
                            style={{
                              height: (120 * t.calls) / trendMax + "px",
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="team-trend-labels">
                    <span>{snapshot.trend[0]?.date}</span>
                    <span>{snapshot.trend.at(-1)?.date}</span>
                  </div>
                  <div className="team-legend">
                    <span>● Comments</span>
                    <span>● Calls</span>
                  </div>
                </section>
              </div>
              <section className="card team-members">
                <h2>People & progress</h2>
                <p>
                  Recorded work in the selected period, attributed to its
                  author. Task totals follow the responsible person.
                </p>
                <div className="team-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Assigned</th>
                        <th>Leads worked</th>
                        <th>Comments</th>
                        <th>Calls</th>
                        <th>Stage changes</th>
                        <th>Pending / overdue</th>
                        <th>Completed tasks</th>
                        <th>Last recorded work</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.members.map((m) => (
                        <tr key={m.id}>
                          <th scope="row">
                            <button
                              className="team-person"
                              onClick={() => {
                                setSelected(m.id);
                                setView("activity");
                              }}
                            >
                              <Avatar small name={m.name} />
                              <span>
                                <strong>{m.name}</strong>
                                <small>
                                  {m.role} ·{" "}
                                  {m.active
                                    ? "Active member"
                                    : "Inactive member"}
                                </small>
                              </span>
                            </button>
                          </th>
                          <td>
                            <button
                              className="text-button"
                              aria-label={`View ${m.name}'s assigned leads`}
                              onClick={() => onLeads(m.id)}
                            >
                              {m.assigned}
                            </button>
                          </td>
                          <td>{m.leadsWorked}</td>
                          <td>{m.comments}</td>
                          <td>
                            {m.calls}
                            <small>{m.connected} connected</small>
                          </td>
                          <td>{m.stageChanges}</td>
                          <td>
                            {m.pending} / {m.overdue}
                          </td>
                          <td>{m.completed}</td>
                          <td>
                            {m.lastActivityAt
                              ? date(m.lastActivityAt) + " UTC"
                              : "No recorded work in period"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="team-mobile-members">
                  {snapshot.members.map((m) => (
                    <article key={m.id}>
                      <button
                        className="team-person"
                        aria-label={`Explore ${m.name}'s activity`}
                        onClick={() => {
                          setSelected(m.id);
                          setView("activity");
                        }}
                      >
                        <Avatar small name={m.name} />
                        <span>
                          <strong>{m.name}</strong>
                          <small>
                            {m.role} ·{" "}
                            {m.active ? "Active member" : "Inactive member"}
                          </small>
                        </span>
                        <ArrowUpRight size={16} />
                      </button>
                      <dl>
                        {[
                          { label: "Assigned leads", value: m.assigned },
                          { label: "Leads worked", value: m.leadsWorked },
                          { label: "Comments", value: m.comments },
                          { label: "Calls", value: m.calls },
                          { label: "Overdue tasks", value: m.overdue },
                          { label: "Completed tasks", value: m.completed },
                        ].map((k) => (
                          <div key={k.label}>
                            <dt>{k.label}</dt>
                            <dd>{k.value}</dd>
                          </div>
                        ))}
                      </dl>
                      <p>
                        Last recorded work:{" "}
                        {m.lastActivityAt
                          ? date(m.lastActivityAt) + " UTC"
                          : "None in period"}
                      </p>
                      <button
                        className="text-button"
                        onClick={() => onLeads(m.id)}
                      >
                        View assigned leads
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <section className="card team-member-detail">
              <div className="team-member-heading">
                <label>
                  Member
                  <select
                    aria-label="Team member"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    <option value="">Choose a member</option>
                    {snapshot.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                        {m.active ? "" : " (inactive)"}
                      </option>
                    ))}
                  </select>
                </label>
                {member ? (
                  <button className="button" onClick={() => onLeads(member.id)}>
                    View assigned leads <ArrowUpRight size={16} />
                  </button>
                ) : null}
              </div>
              {member ? (
                <>
                  <h2>{member.name}</h2>
                  <p>
                    {member.leadsWorked} leads worked · {member.comments}{" "}
                    comments · {member.calls} calls · {member.stageChanges}{" "}
                    stage changes
                  </p>
                  <div
                    className="team-stage-chips"
                    aria-label="Current assigned lead stages"
                  >
                    {member.stages.map((s) => (
                      <span key={s.label}>
                        {s.label}
                        <strong>{s.value}</strong>
                      </span>
                    ))}
                  </div>
                  <h3>Comments & calls</h3>
                  <ErrorMessage error={activityError} />
                  {activityBusy && !activity.length ? <Loading /> : null}
                  {!activityBusy && !activity.length ? (
                    <p>
                      {cursor
                        ? "No matching activity on this page. Load more to continue."
                        : "No recorded comments or calls in this period."}
                    </p>
                  ) : null}
                  <ol className="team-activity-list">
                    {activity.map((a) => (
                      <li key={a.id}>
                        <div>
                          <a href={"/leads/" + encodeURIComponent(a.lead.id)}>
                            {a.lead.name}
                          </a>
                          <span>
                            {a.type === "call"
                              ? `Call${a.outcome ? " · " + a.outcome : ""}`
                              : "Comment"}{" "}
                            · {date(a.createdAt)} UTC
                            {a.revision > 1 ? " · Corrected" : ""}
                          </span>
                        </div>
                        <p>{a.notes || "No comment text recorded."}</p>
                      </li>
                    ))}
                  </ol>
                  {cursor ? (
                    <button
                      className="button"
                      disabled={activityBusy}
                      onClick={async () => {
                        const key = selected,
                          period = query,
                          epoch = activityEpoch.current;
                        setActivityBusy(true);
                        setActivityError("");
                        try {
                          const r = await request(
                            "/team/members/" +
                              encodeURIComponent(key) +
                              "/activities?" +
                              period +
                              "&limit=20&cursor=" +
                              encodeURIComponent(cursor),
                          );
                          if (epoch !== activityEpoch.current) return;
                          setActivity((old) => [
                            ...old,
                            ...r.items.filter(
                              (a: Activity) => !old.some((b) => b.id === a.id),
                            ),
                          ]);
                          setCursor(r.nextCursor);
                        } catch (e) {
                          if (epoch === activityEpoch.current)
                            setActivityError((e as Error).message);
                        } finally {
                          if (epoch === activityEpoch.current)
                            setActivityBusy(false);
                        }
                      }}
                    >
                      {activityBusy ? "Loading…" : "Load more activity"}
                    </button>
                  ) : null}
                </>
              ) : (
                <div className="empty-state">
                  <Users size={30} />
                  <h2>Explore a member’s work</h2>
                  <p>
                    Choose a person to see recorded conversations and their
                    current lead stages.
                  </p>
                </div>
              )}
            </section>
          )}
          <details className="team-definitions">
            <summary>How these figures are counted</summary>
            <p>
              Leads worked are distinct accessible leads with an authored
              comment, call or recorded stage change in this period, including
              leads reassigned later. Imported workbook text is excluded.
              Corrections do not create extra comments. Stage distribution and
              assigned counts show current unarchived leads; stage changes are
              recorded changes, not conversions. Task completion is credited to
              the responsible person even if a teammate closed it. Personal
              reminders are excluded. Active means workspace membership, not
              online presence. A count of zero means no matching recorded
              activity.
            </p>
          </details>
        </>
      ) : null}
    </div>
  );
}
