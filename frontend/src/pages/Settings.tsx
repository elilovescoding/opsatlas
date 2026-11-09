import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { mutate } from '../api';
import { useData, useSession } from '../state';
import type { Slice, User } from '../types';
import { Feedback, label, PageHeading, Pagination, Panel } from '../ui';
export function SettingsPage() {
  const { user, refresh } = useSession();
  const [page, setPage] = useState(0);
  return (
    <>
      <PageHeading
        eyebrow="PERMISSIONS WITH A PURPOSE"
        title="Team access"
        description="Viewers observe. Operators manage services and response. Administrators manage access."
      />
      <div className="role-cards">
        {[
          ['VIEWER', 'Read services, deployments, incidents, metrics, and workspace history.'],
          ['OPERATOR', 'All viewer permissions, plus registry, release, and incident changes.'],
          ['ADMIN', 'All operator permissions, plus grant and revoke operator access.'],
        ].map(([name, description]) => (
          <div className="stat-card" key={name}>
            <ShieldCheck size={21} />
            <h3>{label(name)}</h3>
            <p>{description}</p>
          </div>
        ))}
      </div>
      {user?.role === 'ADMIN' ? (
        <TeamUsers page={page} setPage={setPage} refresh={refresh} />
      ) : (
        <div className="callout">
          <ShieldCheck size={18} />
          <span>
            You are a {label(user?.role ?? 'VIEWER').toLowerCase()}. Ask your workspace
            administrator to change your role.
          </span>
        </div>
      )}
    </>
  );
}
function TeamUsers({
  page,
  setPage,
  refresh,
}: {
  page: number;
  setPage: (p: number) => void;
  refresh: () => void;
}) {
  const query = useData<Slice<User>>(`/admin/users?page=${page}`);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  async function change(u: User, role: string) {
    setBusy(u.id);
    setError('');
    try {
      await mutate(`/admin/users/${u.id}/role`, 'PATCH', { role });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to change role.');
    } finally {
      setBusy('');
    }
  }
  return (
    <Panel
      title="Workspace members"
      description="Role changes revoke existing sessions. The member must sign in again."
    >
      <Feedback loading={query.loading && !query.data} error={query.error || error} />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Email</th>
              <th>Role</th>
              <th>Access</th>
            </tr>
          </thead>
          <tbody>
            {query.data?.items.map((u) => (
              <tr key={u.id}>
                <td>{u.displayName}</td>
                <td>{u.email}</td>
                <td>{label(u.role)}</td>
                <td>
                  {u.role !== 'ADMIN' ? (
                    <button
                      disabled={busy === u.id}
                      className="small-button"
                      onClick={() => void change(u, u.role === 'VIEWER' ? 'OPERATOR' : 'VIEWER')}
                    >
                      {u.role === 'VIEWER' ? 'Grant operator' : 'Revoke operator'}
                    </button>
                  ) : (
                    <span className="muted">Bootstrap administrator</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {query.data && <Pagination {...query.data} onChange={setPage} />}
    </Panel>
  );
}
