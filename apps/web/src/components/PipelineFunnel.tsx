import { ArrowUpRight, GitBranch } from 'lucide-react';
type StageCount = { label: string; value: number };
export function funnelStages(counts: StageCount[], order: string[]) {
  const values = new Map(counts.map((s) => [s.label, s.value]));
  return [...new Set([...order, ...counts.map((s) => s.label)])].map(
    (label) => ({ label, value: values.get(label) || 0 }),
  );
}
export default function PipelineFunnel({
  counts,
  order,
  onStage,
  groups,
  fieldLabel = 'Sales stage',
}: {
  counts: StageCount[];
  order: string[];
  onStage: (stage: string, empty?: boolean) => void;
  groups?: {key:string;label:string;value:number;empty:boolean;aggregate?:boolean;filterable?:boolean}[];
  fieldLabel?: string;
}) {
  const stages = groups || funnelStages(counts, order),
    total = stages.reduce((n, s) => n + s.value, 0),
    max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <section className="panel pipeline-funnel">
      <div className="funnel-heading">
        <div>
          <span className="eyebrow">PIPELINE FLOW</span>
          <h2>Where every lead stands</h2>
          <p>Current {fieldLabel.toLowerCase()} counts. Select a group to explore its leads.</p>
        </div>
        <GitBranch size={23} />
      </div>
      <div
        className="funnel-rows"
        role="list"
        aria-label={`Current lead counts by ${fieldLabel}`}
      >
        {stages.map((s, i) => (
          <div
            role="listitem"
            key={'key' in s ? String(s.key) : s.label}
            className="funnel-stage"
            style={
              {
                '--stage-delay': `${Math.min(i, 8) * 30}ms`,
              } as React.CSSProperties
            }
          >
            <span className="funnel-stage-index">
              {String(i + 1).padStart(2, '0')}
            </span>
            <button
              disabled={('aggregate' in s && Boolean(s.aggregate)) || ('filterable' in s && s.filterable===false)}
              onClick={() => onStage(s.label, 'empty' in s && Boolean(s.empty))}
              aria-label={`${s.label}: ${s.value} leads, ${total ? Math.round((s.value / total) * 100) : 0}% of included leads`}
            >
              <span className="funnel-label"><span className="category-label-text">{s.label}</span>{'empty' in s && s.empty ? <small>Missing value</small> : null}</span>
              <span className="funnel-volume">
                <span
                  className="funnel-bar"
                  style={
                    {
                      width: `${(s.value / max) * 100}%`,
                      '--stage-color': `hsl(${209 - i * 4} 64% ${42 + Math.min(i, 8) * 3}%)`,
                    } as React.CSSProperties
                  }
                />
              </span>
              <span className="funnel-count">
                {s.value}
                <small>
                  {total ? Math.round((s.value / total) * 100) : 0}%
                </small>
              </span>
              <ArrowUpRight size={16} />
            </button>
          </div>
        ))}
      </div>
      <p className="chart-note">
        {total} included leads · Width reflects each group’s current count.{' '}
        {groups?.some(g=>g.aggregate) ? 'The largest 20 groups are shown; Other values combines the rest and has no direct filter. ' : ''}{groups?.some(g=>g.filterable===false) ? 'Long-text groups have no direct filter. ' : ''}Groups may widen again; these are not conversion rates or a history of
        movement.
      </p>
    </section>
  );
}
