import { canWrite } from '../permissions';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  HeartPulse,
  Layers3,
  Plus,
  RefreshCw,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';
import { useState } from 'react';
import { ActivityList, DeploymentTable, IncidentTable, ServiceTable } from '../components/records';
import { IncidentForm, ServiceForm } from '../forms';
import { useData, useSession } from '../state';
import type { AuditEvent, Dashboard, Deployment, Incident, Service, Slice } from '../types';
import {
  date,
  Empty,
  Feedback,
  Modal,
  MoreLink,
  PageHeading,
  Panel,
  relative,
  Sparkline,
} from '../ui';
export function DashboardPage() {
  const { user, refresh } = useSession();
  const summary = useData<Dashboard>('/dashboard', true);
  const services = useData<Slice<Service>>('/services?size=5', true);
  const deployments = useData<Slice<Deployment>>('/deployments?size=4', true);
  const incidents = useData<Slice<Incident>>('/incidents?size=4', true);
  const activity = useData<Slice<AuditEvent>>('/activity?size=4', true);
  const [modal, setModal] = useState<'service' | 'incident' | null>(null);
  const d = summary.data;
  const done = () => {
    setModal(null);
    refresh();
  };
  return (
    <>
      <PageHeading
        eyebrow="YOUR OPERATIONS, AT A GLANCE"
        title="System overview"
        description="A little less noise. A clearer picture of what’s running."
      >
        <button className="button" onClick={refresh}>
          <RefreshCw size={15} />
          Refresh
        </button>
        {canWrite(user) && (
          <button className="button primary" onClick={() => setModal('service')}>
            <Plus size={16} />
            Register service
          </button>
        )}
      </PageHeading>
      <Feedback loading={summary.loading && !d} error={summary.error} retry={summary.retry} />
      {d && (
        <>
          <div className="context-banner">
            <span className="context-label">
              <span className="status-dot" />{' '}
              {d.demonstration ? 'LOCAL DEMONSTRATION' : 'WORKSPACE TELEMETRY'}
            </span>
            <span>
              {d.demonstration
                ? 'Fixture health is measured; deployments and incidents are your recorded actions.'
                : 'Counts and trends come from this workspace’s database.'}
            </span>
            <span className="banner-time">Updated {relative(d.generatedAt)}</span>
          </div>
          <div className="stat-grid">
            <Stat
              title="Registered services"
              value={d.services.total}
              icon={<Layers3 size={18} />}
              caption={`${d.services.unknown} awaiting observations`}
            />
            <Stat
              title="Healthy services"
              value={d.services.healthy}
              icon={<HeartPulse size={18} />}
              caption={`${d.services.unhealthy} degraded or unavailable`}
              tone="green"
            />
            <Stat
              title="Active incidents"
              value={d.incidents.active}
              icon={<TriangleAlert size={18} />}
              caption={`${d.incidents.resolved} resolved across the workspace`}
              tone={d.incidents.active ? 'amber' : ''}
            />
            <Stat
              title="Health observations"
              value={d.runtime.health_samples_24h}
              icon={<Activity size={18} />}
              caption={`${d.runtime.failed_samples_24h} unavailable checks · last 24h`}
            />
          </div>
          {d.services.stale > 0 && (
            <div className="callout warning">
              {d.services.stale} service result(s) are older than three minutes. Check the
              monitoring worker before trusting these counts.
            </div>
          )}
          <div className="dashboard-charts">
            <Panel
              title="Response time"
              description="Mean of recorded probe durations · last 24 hours"
              action={
                <span className="chart-legend">
                  <span />
                  Hourly average
                </span>
              }
            >
              <div className="chart-value">
                {d.latency.length ? Math.round(d.latency[d.latency.length - 1].ms) : '—'}
                <span> ms</span>
                <small>latest observed hour</small>
              </div>
              <div className="chart-wrap">
                <Sparkline
                  values={d.latency.map((p) => Number(p.ms))}
                  label="Hourly mean health check response times"
                />
              </div>
              <div className="chart-axis">
                <span>{d.latency.length ? date(d.latency[0].time) : 'No samples'}</span>
                <span>Includes timeout durations and local fixtures</span>
                <span>{d.latency.length ? date(d.latency[d.latency.length - 1].time) : 'Now'}</span>
              </div>
            </Panel>
            <Panel
              title="Incident pulse"
              description="Incidents opened · past seven days"
              action={<TrendingUp size={18} className="muted" />}
            >
              <div className="chart-value">
                {d.trends.reduce((sum, t) => sum + Number(t.opened), 0)}
                <small>incidents opened</small>
              </div>
              <div
                className="bar-chart"
                role="img"
                aria-label={d.trends.map((t) => `${t.day}: ${t.opened} incidents`).join(', ')}
              >
                {d.trends.map((t) => (
                  <div key={t.day} className="bar-col">
                    <span className="bar-number">{t.opened}</span>
                    <div
                      style={{
                        height: `${Math.max(3, (Number(t.opened) / Math.max(1, ...d.trends.map((v) => Number(v.opened)))) * 80)}px`,
                      }}
                    />
                    <small>
                      {new Date(`${t.day}T12:00:00`).toLocaleDateString(undefined, {
                        weekday: 'short',
                      })}
                    </small>
                  </div>
                ))}
              </div>
              <div className="pulse-foot">
                <Clock3 size={14} />
                <span>Mean time to resolve</span>
                <strong>
                  {d.incidents.mttr_minutes !== null
                    ? `${d.incidents.mttr_minutes} min`
                    : 'No resolved incidents'}
                </strong>
              </div>
            </Panel>
          </div>
        </>
      )}
      <Panel
        title="Service health"
        description="The latest observed state of your registered services"
        action={<MoreLink to="/services" />}
      >
        <Feedback loading={services.loading && !services.data} error={services.error} />
        {services.data &&
          (services.data.total ? (
            <ServiceTable items={services.data.items} />
          ) : (
            <Empty
              title="Your registry starts here"
              description="Register a service and select a local demonstration health target."
            />
          ))}
      </Panel>
      <div className="dashboard-bottom">
        <Panel
          title="Recent deployments"
          description="A record of what shipped"
          action={<MoreLink to="/deployments" />}
        >
          <Feedback error={deployments.error} />
          {deployments.data &&
            (deployments.data.total ? (
              <DeploymentTable items={deployments.data.items} />
            ) : (
              <Empty
                title="No deployments recorded"
                description="Record a release to start building your deployment history."
              />
            ))}
        </Panel>
        <Panel
          title="Workspace activity"
          description="The story behind the changes"
          action={<MoreLink to="/activity" />}
        >
          <Feedback error={activity.error} />
          {activity.data && <ActivityList items={activity.data.items} />}
        </Panel>
      </div>
      <Panel
        title="Recent incidents"
        description="Track the impact. Keep the context."
        action={
          canWrite(user) ? (
            <button className="text-link" onClick={() => setModal('incident')}>
              Open incident
              <Plus size={14} />
            </button>
          ) : (
            <MoreLink to="/incidents" />
          )
        }
      >
        <Feedback error={incidents.error} />
        {incidents.data &&
          (incidents.data.total ? (
            <IncidentTable items={incidents.data.items} />
          ) : (
            <Empty
              title="A quiet incident board"
              description="No incidents have been recorded. Open one when there is something to investigate."
            />
          ))}
      </Panel>
      {modal && (
        <Modal
          title={modal === 'service' ? 'Register a service' : 'Open an incident'}
          onClose={() => setModal(null)}
        >
          {modal === 'service' ? <ServiceForm onDone={done} /> : <IncidentForm onDone={done} />}
        </Modal>
      )}
    </>
  );
}
function Stat({
  title,
  value,
  icon,
  caption,
  tone = '',
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  caption: string;
  tone?: string;
}) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-top">
        <span>{title}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <div className="stat-value">
        {value.toLocaleString()}
        <span className="stat-trace">
          {tone === 'green' ? (
            <ArrowUpRight size={20} />
          ) : tone === 'amber' ? (
            <ArrowDownRight size={20} />
          ) : (
            <span>—</span>
          )}
        </span>
      </div>
      <p>{caption}</p>
    </div>
  );
}
