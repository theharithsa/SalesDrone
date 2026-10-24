import { useState } from 'react';
import { UserPlus, ShieldCheck, Mail, Users } from 'lucide-react';
import { Entity } from '../lib/types';
import {
  Avatar,
  Modal,
  Empty,
  ErrorMessage,
  SaveButton,
  useSubmit,
} from '../components/UI';
const grants = [
  'leads:read',
  'leads:create',
  'leads:edit',
  'activities:write',
  'tasks:write',
];
const presets: Record<string, string[]> = {
  Viewer: ['leads:read'],
  SDR: grants,
};
export default function MembersPage({
  members,
  invitations,
  request,
  onRefresh,
  embedded = false,
}: {
  embedded?: boolean;
  members: Entity[];
  invitations: Entity[];
  request: (p: string, m?: string, b?: any, k?: string) => Promise<any>;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false),
    [editing, setEditing] = useState<Entity | null>(null),
    [role, setRole] = useState('SDR'),
    [scope, setScope] = useState('assigned'),
    [capabilities, setCapabilities] = useState(grants),
    [error, setError] = useState('');
  const submit = useSubmit(async (data, key) => {
    if (editing)
      await request('/members/' + editing.uid, 'PATCH', {
        role,
        scope,
        capabilities,
        active: data.active,
        expectedVersion: editing.version,
      });
    else
      await request(
        '/invitations',
        'POST',
        { email: data.email, role, scope, capabilities },
        key,
      );
    setOpen(false);
    onRefresh();
  });
  function add() {
    setEditing(null);
    setRole('SDR');
    setScope('assigned');
    setCapabilities(grants);
    setOpen(true);
  }
  function edit(m: Entity) {
    setEditing(m);
    setRole(m.role);
    setScope(m.scope);
    setCapabilities(m.capabilities);
    setOpen(true);
  }
  async function revoke(id: string) {
    setError('');
    try {
      await request('/invitations/' + id, 'DELETE');
      onRefresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className={embedded ? 'members-settings' : 'page-body'}>
      <div className="page-title">
        <div>
          <span className="eyebrow">THE RIGHT PEOPLE. THE RIGHT ACCESS.</span>
          {embedded ? <h3>Workspace people</h3> : <h1>People & permissions</h1>}
          <p>Keep your pipeline shared with purpose.</p>
        </div>
        <button className="button primary" onClick={add}>
          <UserPlus size={16} /> Grant access
        </button>
      </div>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Workspace members</h2>
            <p>Both bootstrap administrators have equal access.</p>
          </div>
          <Users size={20} />
        </div>
        {members.map((m) => (
          <div className="member-row" key={m.id}>
            <Avatar name={m.name || m.email} small />
            <div className="member-name">
              <strong>{m.name || m.email}</strong>
              <small>{m.email}</small>
            </div>
            <span className="role-label">
              {m.role === 'Admin' ? <ShieldCheck size={13} /> : null}
              {m.role}
            </span>
            <span className="scope-label">
              {m.role === 'Admin'
                ? 'All leads'
                : m.scope === 'all'
                  ? 'All leads'
                  : 'Assigned leads'}
              {!m.active ? ' · Suspended' : ''}
            </span>
            {m.role !== 'Admin' ? (
              <button className="button" onClick={() => edit(m)}>
                Edit access
              </button>
            ) : (
              <span className="bootstrap-tag">Bootstrap admin</span>
            )}
          </div>
        ))}
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Pending access grants</h2>
            <p>
              Users accept their grant after signing in with the matching Google
              account. No email is sent.
            </p>
          </div>
        </div>
        {invitations.filter(
          (i) => i.active && i.expiresAt > new Date().toISOString(),
        ).length ? (
          invitations
            .filter((i) => i.active && i.expiresAt > new Date().toISOString())
            .map((i) => (
              <div className="member-row" key={i.id}>
                <Mail size={18} />
                <div className="member-name">
                  <strong>{i.email}</strong>
                  <small>
                    {i.role} ·{' '}
                    {i.scope === 'all' ? 'All leads' : 'Assigned leads'}
                  </small>
                </div>
                <button
                  className="text-button danger"
                  onClick={() => revoke(i.id)}
                >
                  Revoke grant
                </button>
              </div>
            ))
        ) : (
          <Empty title="No pending grants">
            New people can explore the demo until you grant live access.
          </Empty>
        )}
        <ErrorMessage error={error} />
      </section>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit access' : 'Grant workspace access'}
        description="Permissions are enforced by the server for every live request."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.currentTarget));
            submit.run({ ...data, active: data.active === 'on' });
          }}
        >
          <div className="form-grid">
            {!editing ? (
              <label className="full">
                Google account email
                <input
                  type="email"
                  name="email"
                  autoFocus
                  required
                  placeholder="colleague@gmail.com"
                />
              </label>
            ) : (
              <p className="full">{editing.email}</p>
            )}
            <label>
              Permission preset
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setCapabilities(presets[e.target.value]);
                }}
              >
                <option>SDR</option>
                <option>Viewer</option>
              </select>
            </label>
            <label>
              Lead visibility
              <select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="assigned">Assigned leads only</option>
                <option value="all">All leads</option>
              </select>
            </label>
            <fieldset className="full permission-list">
              <legend>Capabilities</legend>
              {grants.map((c) => (
                <label className="check" key={c}>
                  <input
                    type="checkbox"
                    checked={capabilities.includes(c)}
                    onChange={(e) =>
                      setCapabilities(
                        e.target.checked
                          ? [...capabilities, c]
                          : capabilities.filter((x) => x !== c),
                      )
                    }
                  />
                  {
                    (
                      {
                        'leads:read': 'View leads and activity',
                        'leads:create': 'Create enquiries',
                        'leads:edit': 'Edit lead details and stages',
                        'activities:write': 'Log calls and notes',
                        'tasks:write': 'Manage own follow-ups',
                      } as Record<string, string>
                    )[c]
                  }
                </label>
              ))}
            </fieldset>
            {editing ? (
              <label className="check full">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={editing.active}
                />{' '}
                Active live access
              </label>
            ) : null}
          </div>
          <ErrorMessage error={submit.error} />
          <div className="form-footer">
            <span />
            <SaveButton
              busy={submit.busy}
              label={editing ? 'Save permissions' : 'Grant access'}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
