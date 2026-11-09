import { canWrite } from '../permissions';
import { Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { ServiceTable } from '../components/records';
import { ServiceForm } from '../forms';
import { useData, useSession } from '../state';
import type { Service, Slice } from '../types';
import { Empty, Feedback, label, Modal, PageHeading, Pagination, Panel } from '../ui';
export function ServicesPage() {
  const { user, refresh } = useSession();
  const [q, setQ] = useState('');
  const [env, setEnv] = useState('');
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState(false);
  const query = useData<Slice<Service>>(
    `/services?page=${page}&q=${encodeURIComponent(q)}${env ? `&environment=${env}` : ''}`,
    true,
  );
  return (
    <>
      <PageHeading
        eyebrow="THE FOUNDATION OF YOUR WORKSPACE"
        title="Service registry"
        description="Know what you run, who owns it, and how it’s doing."
      >
        {canWrite(user) && (
          <button className="button primary" onClick={() => setModal(true)}>
            <Plus size={16} />
            Register service
          </button>
        )}
      </PageHeading>
      <div className="toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Search services"
            placeholder="Find a service…"
            maxLength={80}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <select
          aria-label="Filter environment"
          value={env}
          onChange={(e) => {
            setEnv(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All environments</option>
          {['PRODUCTION', 'STAGING', 'DEVELOPMENT'].map((e) => (
            <option key={e} value={e}>
              {label(e)}
            </option>
          ))}
        </select>
        <span className="toolbar-note">Health checks run on a schedule</span>
      </div>
      <Panel
        title="Registered services"
        description="Archived services retain history and are excluded from this list."
      >
        <Feedback loading={query.loading && !query.data} error={query.error} retry={query.retry} />
        {query.data &&
          (query.data.total ? (
            <ServiceTable items={query.data.items} />
          ) : (
            <Empty
              title="No matching services"
              description="Try a different search or register your first service."
            />
          ))}
        {query.data && <Pagination {...query.data} onChange={setPage} />}
      </Panel>
      {modal && (
        <Modal title="Register a service" onClose={() => setModal(false)}>
          <ServiceForm
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
