// Capture actual running software. No generated or fabricated UI images.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
});
const context = await browser.newContext({
  viewport: { width: 1512, height: 1100 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const base = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';
await mkdir('../docs/screenshots', { recursive: true });
try {
  await page.goto(`${base}/login`);
  await page.getByLabel('Email address').fill(process.env.BOOTSTRAP_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(process.env.BOOTSTRAP_PASSWORD);
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByRole('heading', { name: 'System overview' }).waitFor();
  const csrf = await page.request.get(`${base}/api/auth/csrf`).then((r) => r.json());
  async function get(path) {
    const r = await page.request.get(`${base}/api${path}`);
    if (!r.ok()) throw new Error(`GET ${path}: ${r.status()}`);
    return r.json();
  }
  async function change(path, method, data) {
    const r = await page.request.fetch(`${base}/api${path}`, {
      method,
      headers: { 'X-CSRF-TOKEN': csrf.token },
      ...(data ? { data } : {}),
    });
    if (!r.ok()) throw new Error(`${method} ${path}: ${r.status()}`);
    return r.status() === 204 ? null : r.json();
  }
  // Conclude failed browser test exercises through normal lifecycle operations; retain their history.
  const oldIncidents = await get('/incidents?size=100');
  for (const i of oldIncidents.items.filter(
    (i) => i.title.startsWith('Latency investigation ') && i.status !== 'RESOLVED',
  ))
    await change(`/incidents/${i.id}`, 'PATCH', {
      status: 'RESOLVED',
      severity: i.severity,
      assignee: i.assignee,
      message: 'Concluded local browser test exercise.',
      rootCause: 'Deliberate test exercise',
      resolution: 'Exercise finished; historical evidence retained',
    });
  let services = await get('/services?size=100');
  for (const s of services.items.filter((s) => s.name.startsWith('Workflow ')))
    await change(`/services/${s.id}/archive`, 'POST');
  services = await get('/services?size=100');
  const queue = services.items.find((s) => s.name === 'Event pipeline');
  const api = services.items.find((s) => s.name === 'Atlas API');
  const storage = services.items.find((s) => s.name === 'Artifact storage');
  const deployments = await get('/deployments?size=100');
  async function release(service, version, status, notes) {
    const existing = deployments.items.find(
      (d) => d.serviceId === service.id && d.version === version,
    );
    return (
      existing ??
      change('/deployments', 'POST', {
        serviceId: service.id,
        version,
        environment: service.environment,
        status,
        notes,
      })
    );
  }
  await release(
    api,
    'v1.4.0',
    'SUCCEEDED',
    'Local demonstration: API routing release recorded for the portfolio walkthrough.',
  );
  const qd = await release(
    queue,
    'v1.4.1',
    'SUCCEEDED',
    'Local demonstration: processing instrumentation release.',
  );
  const sd = await release(
    storage,
    'v0.9.3',
    'FAILED',
    'Local demonstration: intentionally unavailable storage fixture.',
  );
  const existing = await get('/incidents?size=100');
  if (!existing.items.some((i) => i.title === 'Elevated event-processing latency (demo)')) {
    const i = await change('/incidents', 'POST', {
      title: 'Elevated event-processing latency (demo)',
      severity: 'SEV3',
      serviceIds: [queue.id],
      assignee: 'Platform on-call',
      deploymentId: qd.id,
      message:
        'Local demonstration: observed probe duration exceeds the 500 ms threshold. This fixture deliberately responds slowly.',
    });
    await change(`/incidents/${i.id}`, 'PATCH', {
      status: 'MONITORING',
      severity: 'SEV3',
      assignee: 'Platform on-call',
      message:
        'The fixture consistently responds in approximately 750 ms. Monitoring continues for the response exercise; no production workload is affected.',
      rootCause: 'Deliberately delayed local HTTP fixture.',
      resolution: '',
    });
  }
  if (!existing.items.some((i) => i.title === 'Artifact availability exercise (demo)')) {
    const i = await change('/incidents', 'POST', {
      title: 'Artifact availability exercise (demo)',
      severity: 'SEV2',
      serviceIds: [storage.id],
      assignee: 'Developer experience',
      deploymentId: sd.id,
      message: 'Started an incident-response exercise against the fixture returning HTTP 503.',
    });
    await change(`/incidents/${i.id}`, 'PATCH', {
      status: 'RESOLVED',
      severity: 'SEV2',
      assignee: 'Developer experience',
      message:
        'Exercise concluded. The storage target intentionally remains unavailable for future demonstrations.',
      rootCause: 'Intentionally unavailable local fixture, not an external outage.',
      resolution:
        'Completed the response drill and documented the result; monitoring still reports the actual 503 response.',
    });
  }
  await page.reload();
  await page.getByRole('heading', { name: 'Service health' }).waitFor();
  await page.getByText('Atlas API', { exact: true }).first().waitFor();
  await page.getByRole('heading', { name: 'Incident pulse' }).waitFor();
  if ((await page.locator('main').innerText()).includes('Invalid Date'))
    throw new Error('Invalid chart date label');
  await page.screenshot({ path: '../docs/screenshots/dashboard-desktop.png', fullPage: true });
  await page.goto(`${base}/services/${queue.id}`);
  await page.getByRole('heading', { name: 'Event pipeline', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Deployment history' }).waitFor();
  await page.screenshot({ path: '../docs/screenshots/service-detail.png', fullPage: true });
  const incidents = await get('/incidents?size=100');
  const incident = incidents.items.find(
    (i) => i.title === 'Elevated event-processing latency (demo)',
  );
  await page.goto(`${base}/incidents/${incident.id}`);
  await page.getByRole('heading', { name: incident.title, exact: true }).waitFor();
  await page.getByText(/The fixture consistently responds/).waitFor();
  await page.screenshot({ path: '../docs/screenshots/incident-timeline.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page.getByRole('heading', { name: 'System overview' }).waitFor();
  await page.getByText('Atlas API', { exact: true }).first().waitFor();
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
    throw new Error('Dashboard overflows the mobile viewport');
  await page.screenshot({ path: '../docs/screenshots/dashboard-mobile.png', fullPage: true });
  await page.goto(`${base}/status`);
  await page.getByRole('heading', { name: 'Service availability' }).waitFor();
  await page.getByText('Atlas API', { exact: true }).waitFor();
  await page.screenshot({ path: '../docs/screenshots/status-mobile.png', fullPage: true });
  console.log(
    'Captured five real application screenshots; mobile dashboard has no document overflow.',
  );
} finally {
  await context.close();
  await browser.close();
}
