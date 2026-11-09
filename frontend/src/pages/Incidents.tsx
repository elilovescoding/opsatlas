import { canWrite } from '../permissions';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { IncidentTable } from '../components/records';
import { IncidentForm } from '../forms';
import { useData, useSession } from '../state';
import type { Incident, Slice } from '../types';
import { Empty, Feedback, label, Modal, PageHeading, Pagination, Panel } from '../ui';
export function IncidentsPage() {
  const { user, refresh } = useSession();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState(false);
  const query = useData<Slice<Incident>>(
    `/incidents?page=${page}${status ? `&status=${status}` : ''}`,
    true,
  );
  return (
    <>
      <PageHeading
        eyebrow="CONTEXT FOR EVERY RESPONSE"
        title="Incidents"
        description="From the first signal to the final resolution. Keep everyone in the loop."
      >
        {canWrite(user) && (
          <button className="button primary" onClick={() => setModal(true)}>
            <Plus size={16} />
            Open incident
          </button>
        )}
      </PageHeading>
      <div className="tabs" role="group" aria-label="Filter incident status">
        {['', 'INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED'].map((s) => (
          <button
            className={status === s ? 'selected' : ''}
            key={s}
            onClick={() => {
              setStatus(s);
              setPage(0);
            }}
          >
            {s ? label(s) : 'All incidents'}
          </button>
        ))}
      </div>
      <Panel title="Incident history">
        <Feedback loading={query.loading && !query.data} error={query.error} />
        {query.data &&
          (query.data.total ? (
            <IncidentTable items={query.data.items} />
          ) : (
            <Empty
              title="Nothing to investigate here"
              description="No incidents match this filter. New incidents will appear as they are recorded."
            />
          ))}
        {query.data && <Pagination {...query.data} onChange={setPage} />}
      </Panel>
      {modal && (
        <Modal title="Open an incident" onClose={() => setModal(false)}>
          <IncidentForm
            onDone={() => {
              setModal(false);
              refresh();
            }}
          />
        </Modal>
      )}
    </>
  );
}
