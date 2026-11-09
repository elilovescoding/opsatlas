import { canWrite } from '../permissions';
import { ArrowLeft, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { mutate } from '../api';
import { DeploymentTable, IncidentTable } from '../components/records';
import { DeploymentForm, IncidentForm, ServiceForm } from '../forms';
import { useData, useSession } from '../state';
import type { Deployment, HealthResult, Incident, Service, Slice } from '../types';
import {
  Badge,
  date,
  Empty,
  Feedback,
  label,
  Modal,
  MutationForm,
  PageHeading,
  Pagination,
  Panel,
  Sparkline,
} from '../ui';
export function ServiceDetail() {
  const { id } = useParams();
  const { user, refresh } = useSession();
  const query = useData<Service>(`/services/${id}`, true);
  const health = useData<Slice<HealthResult>>(`/services/${id}/health`, true);
  const [hp, setHp] = useState(0);
  const deploy = useData<Slice<Deployment>>(`/deployments?serviceId=${id}&page=${hp}&size=10`);
  const [ip, setIp] = useState(0);
  const incidents = useData<Slice<Incident>>(`/incidents?serviceId=${id}&page=${ip}&size=10`);
  const [modal, setModal] = useState<'edit' | 'deploy' | 'incident' | 'archive' | null>(null);
  const s = query.data;
  const done = () => {
    setModal(null);
    refresh();
  };
  return (
    <>
      <Link className="back-link" to="/services">
        <ArrowLeft size={15} />
        Service registry
      </Link>
      <Feedback loading={query.loading && !s} error={query.error} />
      {s && (
        <>
          <PageHeading
            eyebrow={`${label(s.environment).toUpperCase()} / ${s.demo ? 'LOCAL DEMONSTRATION' : 'REGISTERED SERVICE'}`}
            title={s.name}
            description={s.description || 'No description provided.'}
          >
            {canWrite(user) && !s.archived && (
              <>
                <button className="button" onClick={() => setModal('edit')}>
                  Edit service
                </button>
                <button className="button primary" onClick={() => setModal('deploy')}>
                  <Plus size={16} />
                  Record deployment
                </button>
              </>
            )}
          </PageHeading>
          <div className="detail-summary">
            <div>
              <small>Observed health</small>
              <Badge value={s.healthState} />
            </div>
            <div>
              <small>Response time</small>
              <strong className="mono">{s.responseMs ?? '—'} ms</strong>
            </div>
            <div>
              <small>Owner</small>
              <strong>{s.owner}</strong>
            </div>
            <div>
              <small>Last check</small>
              <strong>{date(s.checkedAt)}</strong>
            </div>
            <div>
              <small>Visibility</small>
              <strong>{s.publicVisible ? 'Public status' : 'Workspace only'}</strong>
            </div>
          </div>
          {s.archived && (
            <div className="callout">
              This service is archived. Its history is preserved and new changes are disabled.
            </div>
          )}
          {s.demo && (
            <div className="context-banner">
              <span className="context-label">LOCAL FIXTURE</span>
              <span>These are actual HTTP observations of a deliberately simulated target.</span>
            </div>
          )}
          <Panel title="Health history" description="Latest 60 observations · stored for 30 days">
            <Feedback error={health.error} />
            {health.data?.items.length ? (
              <>
                <Sparkline
                  values={[...health.data.items].reverse().map((h) => h.responseMs)}
                  label="Service probe durations in milliseconds"
                />
                <div className="health-strip" aria-label="Recent health outcomes">
                  {[...health.data.items].reverse().map((h) => (
                    <span
                      key={h.id}
                      className={`health-tick ${h.state.toLowerCase()}`}
                      title={`${date(h.checkedAt)} · ${label(h.state)} · ${h.responseMs}ms`}
                    />
                  ))}
                </div>
                <div className="chart-axis">
                  <span>Older observations</span>
                  <span>Latest · {health.data.items[0].httpStatus ?? 'no HTTP response'}</span>
                </div>
              </>
            ) : (
              <Empty
                title="No health observations yet"
                description={
                  s.healthTarget === 'NONE'
                    ? 'Monitoring is disabled. Edit the service to choose a fixed demo target.'
                    : 'The first observation will appear after the next scheduled check.'
                }
              />
            )}
          </Panel>
          <Panel
            title="Deployment history"
            action={
              canWrite(user) && !s.archived ? (
                <button className="text-link" onClick={() => setModal('deploy')}>
                  Record release
                  <Plus size={14} />
                </button>
              ) : undefined
            }
          >
            <Feedback error={deploy.error} />
            {deploy.data &&
              (deploy.data.total ? (
                <DeploymentTable
                  items={deploy.data.items}
                  write={canWrite(user) && !s.archived}
                  onChanged={refresh}
                />
              ) : (
                <Empty
                  title="No deployments yet"
                  description="Record a release to connect this service with its delivery history."
                />
              ))}
            {deploy.data && <Pagination {...deploy.data} onChange={setHp} />}
          </Panel>
          <Panel
            title="Related incidents"
            action={
              canWrite(user) && !s.archived ? (
                <button className="text-link" onClick={() => setModal('incident')}>
                  Open incident
                  <Plus size={14} />
                </button>
              ) : undefined
            }
          >
            <Feedback error={incidents.error} />
            {incidents.data &&
              (incidents.data.total ? (
                <IncidentTable items={incidents.data.items} />
              ) : (
                <Empty
                  title="No incidents recorded"
                  description="Incident history for this service will appear here."
                />
              ))}
            {incidents.data && <Pagination {...incidents.data} onChange={setIp} />}
          </Panel>
          {canWrite(user) && !s.archived && (
            <div className="danger-zone">
              <div>
                <h3>Archive service</h3>
                <p>Remove it from active monitoring and public status. History stays available.</p>
              </div>
              <button className="button danger" onClick={() => setModal('archive')}>
                Archive service
              </button>
            </div>
          )}
          {modal && (
            <Modal
              title={
                {
                  edit: 'Edit service',
                  deploy: 'Record a deployment',
                  incident: 'Open an incident',
                  archive: 'Archive this service?',
                }[modal]
              }
              onClose={() => setModal(null)}
            >
              {modal === 'edit' ? (
                <ServiceForm service={s} onDone={done} />
              ) : modal === 'deploy' ? (
                <DeploymentForm initialService={s} onDone={done} />
              ) : modal === 'incident' ? (
                <IncidentForm initialService={s} onDone={done} />
              ) : (
                <MutationForm
                  submit="Archive service"
                  onSave={async () => {
                    await mutate(`/services/${s.id}/archive`, 'POST');
                    done();
                  }}
                >
                  <p>
                    {s.name} will stop being monitored. Resolve its active incidents first. You can
                    still open this page to review its history.
                  </p>
                </MutationForm>
              )}
            </Modal>
          )}
        </>
      )}
    </>
  );
}
