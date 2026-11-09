import { ArrowUpRight, ChartNoAxesCombined, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useData } from '../state';
import type { PublicStatus } from '../types';
import { Badge, date, Empty, Feedback, label, Panel, relative } from '../ui';
export function StatusPage() {
  const query = useData<PublicStatus>('/public/status', true);
  const d = query.data;
  const allHealthy = d?.services.length && d.services.every((s) => s.state === 'HEALTHY');
  return (
    <div className="status-page">
      <header>
        <Link className="brand" to="/">
          <span className="brand-mark">
            <ChartNoAxesCombined size={23} />
          </span>
          OpsAtlas
        </Link>
        <Link className="text-link" to="/">
          Workspace
          <ArrowUpRight size={15} />
        </Link>
      </header>
      <div className="status-hero">
        <div className="eyebrow">PUBLIC SERVICE STATUS</div>
        <h1>Clarity for everyone.</h1>
        <p>The latest measured health of services shared by this workspace.</p>
      </div>
      <Feedback loading={query.loading && !d} error={query.error} retry={query.retry} />
      {d && (
        <>
          <div className={`status-banner ${allHealthy ? 'healthy' : ''}`}>
            <Radio size={23} />
            <div>
              <strong>
                {d.services.length
                  ? allHealthy
                    ? 'All shared services are healthy'
                    : 'Some services need attention or are awaiting checks'
                  : 'No services are shared yet'}
              </strong>
              <p>Observed health · refreshed {date(d.generatedAt)}</p>
            </div>
          </div>
          {d.demonstration && (
            <div className="callout">
              Local demonstration workspace. Demo targets deliberately include slow and unavailable
              responses.
            </div>
          )}
          <Panel
            title="Service availability"
            description="Checks older than three minutes are shown as unknown. Health is independent of manually recorded incidents."
          >
            {d.services.map((s) => (
              <div className="public-service" key={s.id}>
                <div>
                  <strong>{s.name}</strong>
                  <small>
                    {label(s.environment)}
                    {s.demo ? ' · Demo target' : ''} · {relative(s.checkedAt)}
                  </small>
                </div>
                <Badge value={s.state} />
              </div>
            ))}
            {!d.services.length && (
              <Empty
                title="Nothing published yet"
                description="An operator can choose which services appear on this page."
              />
            )}
          </Panel>
        </>
      )}
      <footer>
        <span>Powered by OpsAtlas</span>
        <span>Read-only · No account required</span>
      </footer>
    </div>
  );
}
