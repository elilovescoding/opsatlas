import { canWrite } from '../permissions';
import { Box, Plus } from 'lucide-react';
import { useState } from 'react';
import { DeploymentTable } from '../components/records';
import { DeploymentForm } from '../forms';
import { useData, useSession } from '../state';
import type { Deployment, Slice } from '../types';
import { Empty, Feedback, Modal, PageHeading, Pagination, Panel } from '../ui';
export function DeploymentsPage() {
  const { user, refresh } = useSession();
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState(false);
  const query = useData<Slice<Deployment>>(`/deployments?page=${page}`, true);
  return (
    <>
      <PageHeading
        eyebrow="EVERY RELEASE HAS A STORY"
        title="Deployments"
        description="A database-backed release ledger, connected to the services you operate."
      >
        {canWrite(user) && (
          <button className="button primary" onClick={() => setModal(true)}>
            <Plus size={16} />
            Record deployment
          </button>
        )}
      </PageHeading>
      <div className="callout">
        <Box size={17} />
        <span>
          This is a release record. Recording a deployment does not trigger infrastructure or ship
          code.
        </span>
      </div>
      <Panel
        title="Release history"
        description="Pending → succeeded or failed. Succeeded → rolled back."
      >
        <Feedback loading={query.loading && !query.data} error={query.error} />
        {query.data &&
          (query.data.total ? (
            <DeploymentTable items={query.data.items} write={canWrite(user)} onChanged={refresh} />
          ) : (
            <Empty
              title="Ready for the first release"
              description="Record a version, environment, and outcome for one of your registered services."
            />
          ))}
        {query.data && <Pagination {...query.data} onChange={setPage} />}
      </Panel>
      {modal && (
        <Modal title="Record a deployment" onClose={() => setModal(false)}>
          <DeploymentForm
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
