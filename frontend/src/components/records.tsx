import { Activity, ArrowUpRight, Box, Layers3, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { mutate } from '../api';
import { useData } from '../state';
import type { AuditEvent, Deployment, Incident, Service } from '../types';
import { Badge, Feedback, date, label, relative } from '../ui';
export function ServiceLink({ id }: { id: string }) {
  const q = useData<Service>(`/services/${id}`);
  return (
    <Link className="service-link" to={`/services/${id}`}>
      {q.data?.name ?? id.slice(0, 8)}
    </Link>
  );
}
export function ServiceTable({ items }: { items: Service[] }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Environment</th>
            <th>Health</th>
            <th>Response time</th>
            <th>Last check</th>
            <th>
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id}>
              <td>
                <div className="service-cell">
                  <span className="service-icon">
                    <Layers3 size={17} />
                  </span>
                  <div>
                    <Link className="row-title" to={`/services/${s.id}`}>
                      {s.name}
                    </Link>
                    <small>
                      {s.owner}
                      {s.demo && <span className="demo-mini">DEMO</span>}
                    </small>
                  </div>
                </div>
              </td>
              <td>
                <span className={`env env-${s.environment.toLowerCase()}`}>
                  {label(s.environment)}
                </span>
              </td>
              <td>
                <Badge value={s.healthState} />
                {s.checkedAt && now - new Date(s.checkedAt).getTime() > 180000 && (
                  <small className="stale">Stale result</small>
                )}
              </td>
              <td className="mono">
                {s.responseMs !== null ? (
                  <>
                    {s.responseMs}
                    <span className="muted"> ms</span>
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td className="muted nowrap">{relative(s.checkedAt)}</td>
              <td>
                <Link
                  to={`/services/${s.id}`}
                  className="icon-button"
                  aria-label={`View ${s.name}`}
                >
                  <ArrowUpRight size={17} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function IncidentTable({ items }: { items: Incident[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Incident</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Responsibility</th>
            <th>Opened</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td>
                <Link className="row-title" to={`/incidents/${i.id}`}>
                  {i.title}
                </Link>
                <small className="record-id">
                  INC-{i.id.slice(0, 6).toUpperCase()} · {i.serviceIds.length} affected service
                  {i.serviceIds.length !== 1 ? 's' : ''}
                </small>
              </td>
              <td>
                <Badge value={i.severity} />
              </td>
              <td>
                <Badge value={i.status} />
              </td>
              <td>{i.assignee}</td>
              <td className="muted nowrap">{date(i.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function DeploymentTable({
  items,
  write = false,
  onChanged,
}: {
  items: Deployment[];
  write?: boolean;
  onChanged?: () => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  async function transition(d: Deployment, status: string) {
    setBusy(d.id);
    setError('');
    try {
      await mutate(`/deployments/${d.id}`, 'PATCH', { status });
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed.');
    } finally {
      setBusy('');
    }
  }
  return (
    <>
      <Feedback error={error} />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Release</th>
              <th>Service</th>
              <th>Status</th>
              <th>Recorded</th>
              {write && <th>Update</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id}>
                <td>
                  <strong className="mono">{d.version}</strong>
                  <small>{label(d.environment)}</small>
                  {d.notes && <small className="release-note">{d.notes}</small>}
                </td>
                <td>
                  <ServiceLink id={d.serviceId} />
                </td>
                <td>
                  <Badge value={d.status} />
                </td>
                <td className="muted nowrap">{date(d.createdAt)}</td>
                {write && (
                  <td>
                    <div className="inline-actions">
                      {d.status === 'PENDING' && (
                        <>
                          <button
                            disabled={busy === d.id}
                            className="small-button"
                            onClick={() => void transition(d, 'SUCCEEDED')}
                          >
                            Succeed
                          </button>
                          <button
                            disabled={busy === d.id}
                            className="small-button danger"
                            onClick={() => void transition(d, 'FAILED')}
                          >
                            Fail
                          </button>
                        </>
                      )}
                      {d.status === 'SUCCEEDED' && (
                        <button
                          disabled={busy === d.id}
                          className="small-button"
                          onClick={() => void transition(d, 'ROLLED_BACK')}
                        >
                          Mark rolled back
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
export function ActivityList({ items }: { items: AuditEvent[] }) {
  return (
    <div className="activity-list">
      {items.map((a) => (
        <div className="activity-item" key={a.id}>
          <div className={`activity-icon ${a.action.includes('INCIDENT') ? 'amber' : ''}`}>
            {a.action.includes('DEPLOYMENT') ? (
              <Box size={16} />
            ) : a.action.includes('INCIDENT') ? (
              <TriangleAlert size={16} />
            ) : (
              <Activity size={16} />
            )}
          </div>
          <div>
            <strong>{label(a.action)}</strong>
            <p>{a.detail}</p>
            <small>
              {a.actor} <span>·</span> {relative(a.createdAt)}
            </small>
          </div>
        </div>
      ))}
    </div>
  );
}
