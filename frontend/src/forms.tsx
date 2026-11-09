import { useState } from 'react';
import { mutate } from './api';
import { useData } from './state';
import { Field, Feedback, MutationForm, label, text } from './ui';
import type { Deployment, Incident, Service, Slice } from './types';
const environments = ['DEVELOPMENT', 'STAGING', 'PRODUCTION'];
export function ServiceForm({ service, onDone }: { service?: Service; onDone: () => void }) {
  return (
    <MutationForm
      submit={service ? 'Save service' : 'Register service'}
      onSave={async (data) => {
        await mutate(service ? `/services/${service.id}` : '/services', service ? 'PUT' : 'POST', {
          name: text(data, 'name'),
          description: text(data, 'description'),
          environment: text(data, 'environment'),
          owner: text(data, 'owner'),
          healthTarget: text(data, 'healthTarget'),
          publicVisible: data.has('publicVisible'),
        });
        onDone();
      }}
    >
      <Field label="Service name">
        <input
          name="name"
          required
          maxLength={80}
          defaultValue={service?.name}
          placeholder="e.g. Payments API"
        />
      </Field>
      <Field label="Description">
        <textarea
          name="description"
          maxLength={1000}
          defaultValue={service?.description ?? ''}
          placeholder="What does this service do?"
        />
      </Field>
      <div className="form-grid">
        <Field label="Environment">
          <select name="environment" defaultValue={service?.environment ?? 'STAGING'}>
            {environments.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </Field>
        <Field label="Service owner">
          <input
            name="owner"
            required
            maxLength={80}
            defaultValue={service?.owner}
            placeholder="e.g. Platform team"
          />
        </Field>
      </div>
      <Field
        label="Health check target"
        hint="Fixed local fixtures only. Demo API is healthy, queue is deliberately slow, storage returns 503."
      >
        <select name="healthTarget" defaultValue={service?.healthTarget ?? 'NONE'}>
          <option value="NONE">Disabled — no health check</option>
          <option value="DEMO_API">Demo · API (healthy)</option>
          <option value="DEMO_QUEUE">Demo · Queue (slow)</option>
          <option value="DEMO_STORAGE">Demo · Storage (unavailable)</option>
        </select>
      </Field>
      <label className="check">
        <input
          name="publicVisible"
          type="checkbox"
          defaultChecked={service?.publicVisible ?? false}
        />
        Publish name, environment, and health on the public status page
      </label>
    </MutationForm>
  );
}
function ServiceOptions({
  selected,
  onSelect,
  multiple = false,
}: {
  selected: string[];
  onSelect: (ids: string[]) => void;
  multiple?: boolean;
}) {
  const [search, setSearch] = useState('');
  const query = useData<Slice<Service>>(`/services?size=100&q=${encodeURIComponent(search)}`);
  return (
    <div className="field">
      <span>Affected service{multiple ? 's' : ''}</span>
      <input
        aria-label="Find a service"
        placeholder="Find a service…"
        value={search}
        maxLength={80}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Feedback error={query.error} />
      <div className="service-options">
        {query.data?.items.map((s) => (
          <label className="check" key={s.id}>
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name="serviceChoice"
              checked={selected.includes(s.id)}
              onChange={() =>
                onSelect(
                  multiple
                    ? selected.includes(s.id)
                      ? selected.filter((id) => id !== s.id)
                      : [...selected, s.id]
                    : [s.id],
                )
              }
            />
            <span>
              {s.name}
              <small>{label(s.environment)}</small>
            </span>
          </label>
        ))}
        {query.data?.total === 0 && <small>No matching services. Register a service first.</small>}
      </div>
      {selected.length > 0 && (
        <small>
          {selected.length} selected{multiple ? ' (maximum 20)' : ''}
        </small>
      )}
    </div>
  );
}
export function DeploymentForm({
  initialService,
  onDone,
}: {
  initialService?: Service;
  onDone: () => void;
}) {
  const [ids, setIds] = useState<string[]>(initialService ? [initialService.id] : []);
  const service = useData<Service>(`/services/${ids[0] ?? '00000000-0000-0000-0000-000000000000'}`);
  return (
    <MutationForm
      submit="Record deployment"
      onSave={async (data) => {
        if (!ids[0]) throw new Error('Select a service.');
        await mutate('/deployments', 'POST', {
          serviceId: ids[0],
          version: text(data, 'version'),
          environment: service.data?.environment,
          status: text(data, 'status'),
          notes: text(data, 'notes'),
        });
        onDone();
      }}
    >
      {initialService ? (
        <p className="callout">
          {initialService.name} · {label(initialService.environment)}
        </p>
      ) : (
        <ServiceOptions selected={ids} onSelect={setIds} />
      )}
      <Field label="Version or release identifier">
        <input name="version" required maxLength={80} placeholder="v1.4.0 or commit SHA" />
      </Field>
      <Field label="Deployment status">
        <select name="status">
          <option value="PENDING">Pending</option>
          <option value="SUCCEEDED">Succeeded</option>
          <option value="FAILED">Failed</option>
          <option value="ROLLED_BACK">Rolled back</option>
        </select>
      </Field>
      <Field label="Release notes">
        <textarea
          name="notes"
          maxLength={2000}
          placeholder="Changes, rollout context, or rollback details"
        />
      </Field>
      <p className="muted">This records a deployment; it does not run a release pipeline.</p>
    </MutationForm>
  );
}
export function IncidentForm({
  incident,
  initialService,
  onDone,
}: {
  incident?: Incident;
  initialService?: Service;
  onDone: () => void;
}) {
  const [ids, setIds] = useState<string[]>(
    incident?.serviceIds ?? (initialService ? [initialService.id] : []),
  );
  const deployments = useData<Slice<Deployment>>(
    `/deployments?size=100${ids.length === 1 ? `&serviceId=${ids[0]}` : ''}`,
  );
  return (
    <MutationForm
      submit={incident ? 'Post incident update' : 'Open incident'}
      onSave={async (data) => {
        if (incident)
          await mutate(`/incidents/${incident.id}`, 'PATCH', {
            status: text(data, 'status'),
            severity: text(data, 'severity'),
            assignee: text(data, 'assignee'),
            message: text(data, 'message'),
            rootCause: text(data, 'rootCause'),
            resolution: text(data, 'resolution'),
          });
        else {
          if (ids.length < 1 || ids.length > 20)
            throw new Error('Select between 1 and 20 services.');
          await mutate('/incidents', 'POST', {
            title: text(data, 'title'),
            severity: text(data, 'severity'),
            serviceIds: ids,
            assignee: text(data, 'assignee'),
            deploymentId: text(data, 'deploymentId') || null,
            message: text(data, 'message'),
          });
        }
        onDone();
      }}
    >
      {!incident && (
        <>
          <Field label="Incident title">
            <input
              name="title"
              required
              maxLength={160}
              placeholder="e.g. Elevated API response times"
            />
          </Field>
          <ServiceOptions multiple selected={ids} onSelect={setIds} />
        </>
      )}
      <div className="form-grid">
        <Field label="Severity">
          <select name="severity" defaultValue={incident?.severity ?? 'SEV3'}>
            {['SEV1', 'SEV2', 'SEV3', 'SEV4'].map((s, i) => (
              <option key={s} value={s}>
                {s} · {['Critical', 'Major', 'Minor', 'Low'][i]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Responsible person or team">
          <input
            name="assignee"
            required
            maxLength={80}
            defaultValue={incident?.assignee}
            placeholder="Platform on-call"
          />
        </Field>
      </div>
      {incident ? (
        <Field label="Incident status">
          <select name="status" defaultValue={incident.status}>
            {['INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED'].map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <Field label="Related deployment (optional)">
          <select name="deploymentId">
            <option value="">No linked deployment</option>
            {deployments.data?.items
              .filter((d) => ids.includes(d.serviceId))
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.version} · {label(d.environment)} · {label(d.status)}
                </option>
              ))}
          </select>
        </Field>
      )}
      <Field label={incident ? 'Timeline update' : 'Initial timeline update'}>
        <textarea
          name="message"
          required
          maxLength={4000}
          placeholder="What happened? What is the current impact?"
        />
      </Field>
      {incident && (
        <>
          <Field label="Root cause" hint="Required to resolve the incident.">
            <textarea name="rootCause" maxLength={4000} defaultValue={incident.rootCause} />
          </Field>
          <Field label="Resolution" hint="Required to resolve the incident.">
            <textarea name="resolution" maxLength={4000} defaultValue={incident.resolution} />
          </Field>
        </>
      )}
    </MutationForm>
  );
}
