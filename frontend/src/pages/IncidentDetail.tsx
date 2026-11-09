import { canWrite } from '../permissions';
import { ArrowLeft, Box, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ServiceLink } from '../components/records';
import { IncidentForm } from '../forms';
import { useData, useSession } from '../state';
import type { Incident, IncidentUpdate, Slice } from '../types';
import { Badge, date, Feedback, Modal, PageHeading, Pagination, Panel } from '../ui';
export function IncidentDetail() {
  const { id } = useParams();
  const { user, refresh } = useSession();
  const query = useData<Incident>(`/incidents/${id}`, true);
  const [page, setPage] = useState(0);
  const updates = useData<Slice<IncidentUpdate>>(`/incidents/${id}/updates?page=${page}`, true);
  const [modal, setModal] = useState(false);
  const i = query.data;
  return (
    <>
      <Link className="back-link" to="/incidents">
        <ArrowLeft size={15} />
        Incident history
      </Link>
      <Feedback loading={query.loading && !i} error={query.error} />
      {i && (
        <>
          <PageHeading
            eyebrow={`INC-${i.id.slice(0, 6).toUpperCase()} / INCIDENT RESPONSE`}
            title={i.title}
            description={`Opened ${date(i.createdAt)}${i.resolvedAt ? ` · Resolved ${date(i.resolvedAt)}` : ''}`}
          >
            {canWrite(user) && i.status !== 'RESOLVED' && (
              <button className="button primary" onClick={() => setModal(true)}>
                <Plus size={16} />
                Post update
              </button>
            )}
          </PageHeading>
          <div className="detail-summary">
            <div>
              <small>Status</small>
              <Badge value={i.status} />
            </div>
            <div>
              <small>Severity</small>
              <Badge value={i.severity} />
            </div>
            <div>
              <small>Responsibility</small>
              <strong>{i.assignee}</strong>
            </div>
            <div>
              <small>Affected services</small>
              <div className="affected-links">
                {i.serviceIds.map((s) => (
                  <ServiceLink key={s} id={s} />
                ))}
              </div>
            </div>
          </div>
          {i.deploymentId && (
            <div className="callout">
              <Box size={17} />
              <span>
                Linked deployment:{' '}
                <Link to="/deployments" className="mono">
                  {i.deploymentId.slice(0, 8)}
                </Link>
              </span>
            </div>
          )}
          <Panel
            title="Incident timeline"
            description="Updates are append-only. Each entry records its author and status."
          >
            <Feedback error={updates.error} />
            <div className="timeline">
              {updates.data?.items.map((u) => (
                <article key={u.id}>
                  <span className="timeline-dot" />
                  <div className="timeline-meta">
                    <Badge value={u.status} />
                    <time dateTime={u.createdAt}>{date(u.createdAt)}</time>
                  </div>
                  <p className="preserve">{u.message}</p>
                  <small>{u.author}</small>
                </article>
              ))}
            </div>
            {updates.data && <Pagination {...updates.data} onChange={setPage} />}
          </Panel>
          {(i.rootCause || i.resolution) && (
            <Panel title="Post-incident review">
              <div className="review-grid">
                <div>
                  <h3>Root cause</h3>
                  <p className="preserve">{i.rootCause || 'Not documented yet.'}</p>
                </div>
                <div>
                  <h3>Resolution</h3>
                  <p className="preserve">{i.resolution || 'Not documented yet.'}</p>
                </div>
              </div>
            </Panel>
          )}
          {modal && (
            <Modal title="Post an incident update" onClose={() => setModal(false)}>
              <IncidentForm
                incident={i}
                onDone={() => {
                  setModal(false);
                  refresh();
                }}
              />
            </Modal>
          )}
        </>
      )}
    </>
  );
}
