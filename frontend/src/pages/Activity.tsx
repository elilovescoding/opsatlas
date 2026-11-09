import { useState } from 'react';
import { ActivityList } from '../components/records';
import { useData } from '../state';
import type { AuditEvent, Slice } from '../types';
import { Empty, Feedback, PageHeading, Pagination, Panel } from '../ui';
export function ActivityPage() {
  const [page, setPage] = useState(0);
  const query = useData<Slice<AuditEvent>>(`/activity?page=${page}`, true);
  return (
    <>
      <PageHeading
        eyebrow="AN ACCOUNTABLE WORKSPACE"
        title="Activity log"
        description="Who changed what, and when. Important actions, recorded with their context."
      />
      <Panel
        title="Workspace history"
        description="Application-level audit records; not a tamper-proof compliance log."
      >
        <Feedback loading={query.loading && !query.data} error={query.error} />
        {query.data &&
          (query.data.total ? (
            <ActivityList items={query.data.items} />
          ) : (
            <Empty
              title="No activity yet"
              description="Registry, release, incident, and access changes will appear here."
            />
          ))}
        {query.data && <Pagination {...query.data} onChange={setPage} />}
      </Panel>
    </>
  );
}
