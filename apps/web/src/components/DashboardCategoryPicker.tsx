import { ErrorMessage } from './UI';

type Visualization = {
  requested: string;
  label: string;
  unavailable: boolean;
  availableFields: { field: string; label: string }[];
};
export default function DashboardCategoryPicker({
  visualization, busy, error, onChange,
}: {
  visualization?: Visualization;
  busy: boolean;
  error: string;
  onChange: (value: string) => void;
}) {
  return (
    <section className="panel dashboard-category-control">
      <div><h2>Pipeline visualization</h2><p>Choose the category for your pipeline charts. Saved for your account.</p></div>
      <label>
        Group leads by
        <select
          aria-label="Dashboard visualization field"
          value={visualization?.unavailable ? 'auto' : visualization?.requested || 'auto'}
          disabled={busy || !visualization?.availableFields.length}
          onChange={e => onChange(e.target.value)}
        >
          <option value="auto">Automatic</option>
          {visualization?.availableFields.map(({ field, label }) => <option key={field} value={field}>{label}</option>)}
        </select>
        <small>Currently using {visualization?.label}</small>
      </label>
      {visualization?.unavailable ? <p role="status">Your saved field is unavailable. Showing {visualization.label}; choose another field to save a replacement.</p> : null}
      <ErrorMessage error={error} />
    </section>
  );
}
