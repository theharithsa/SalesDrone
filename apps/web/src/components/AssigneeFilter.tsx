export type Assignee = { id: string; name: string; active: boolean };
export default function AssigneeFilter({
  value,
  onChange,
  members,
  loading = false,
}: {
  value: string;
  onChange: (v: string) => void;
  members: Assignee[];
  loading?: boolean;
}) {
  return (
    <label className="assignee-filter">
      Assigned to
      <select
        aria-label="Filter assigned to"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
      >
        <option value="">{loading ? "Loading team…" : "All assignees"}</option>
        <option value="__unassigned__">Unassigned</option>
        {value &&
        value !== "__unassigned__" &&
        !members.some((m) => m.id === value) ? (
          <option value={value}>Member unavailable</option>
        ) : null}
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
            {m.active ? "" : " (inactive)"}
          </option>
        ))}
      </select>
    </label>
  );
}
