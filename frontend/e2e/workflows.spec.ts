import { test, expect, type Page } from '@playwright/test';
const email = process.env.BOOTSTRAP_EMAIL;
const password = process.env.BOOTSTRAP_PASSWORD;
test.beforeEach(() => {
  if (!email || !password)
    throw new Error('Set bootstrap credentials in the environment before running E2E.');
});
async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email!);
  await page.getByLabel('Password', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page.getByRole('heading', { name: 'System overview' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Incident pulse' })).toBeVisible();
  await expect(page.getByText('Invalid Date', { exact: true })).toHaveCount(0);
}
async function navigate(page: Page, name: string) {
  const menu = page.getByRole('button', { name: 'Open menu' });
  if (await menu.isVisible()) await menu.click();
  await page.locator('aside').getByRole('link', { name, exact: true }).click();
}
test('service → deployment → incident → resolution → archive', async ({ page }, info) => {
  const suffix = `${info.project.name}-${Date.now()}`;
  const name = `Workflow ${suffix}`;
  await signIn(page);
  await navigate(page, 'Service registry');
  await page.getByRole('button', { name: 'Register service', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Service name').fill(name);
  await dialog
    .getByLabel('Description', { exact: true })
    .fill('Created by a real browser workflow.');
  await dialog.getByLabel('Service owner').fill('QA demonstration');
  await dialog.getByLabel('Health check target').selectOption('DEMO_API');
  await dialog.getByLabel(/Publish name/).check();
  await dialog.getByRole('button', { name: 'Register service', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('link', { name, exact: true }).click();
  await page.getByRole('button', { name: 'Record deployment', exact: true }).click();
  await dialog.getByLabel('Version or release identifier').fill(`v-${suffix}`);
  await dialog.getByLabel('Deployment status').selectOption('SUCCEEDED');
  await dialog.getByLabel('Release notes').fill('Browser-tested release record');
  await dialog.getByRole('button', { name: 'Record deployment', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText(`v-${suffix}`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open incident', exact: true }).click();
  await dialog.getByLabel('Incident title').fill(`Latency investigation ${suffix}`);
  await dialog.getByLabel('Responsible person or team').fill('QA on-call');
  await dialog.getByLabel('Initial timeline update').fill('Investigating a local demonstration.');
  await dialog
    .getByLabel('Related deployment (optional)')
    .selectOption({ label: `v-${suffix} · Staging · Succeeded` });
  await dialog.getByRole('button', { name: 'Open incident', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('link', { name: `Latency investigation ${suffix}`, exact: true }).click();
  await page.getByRole('button', { name: 'Post update', exact: true }).click();
  await dialog.getByLabel('Incident status').selectOption('RESOLVED');
  await dialog.getByLabel('Timeline update', { exact: true }).fill('Verified recovery.');
  await dialog.getByLabel('Root cause').fill('Deliberately simulated fault');
  await dialog
    .getByLabel('Resolution', { exact: true })
    .fill('Completed a browser-driven incident exercise');
  await dialog.getByRole('button', { name: 'Post incident update' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Post-incident review' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Verified recovery.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name, exact: true }).click();
  await page.getByRole('button', { name: 'Archive service', exact: true }).click();
  await dialog.getByRole('button', { name: 'Archive service', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText(/This service is archived/)).toBeVisible();
  await navigate(page, 'Activity log');
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
});
test('public status is read-only and fits the viewport', async ({ page }) => {
  await page.goto('/status');
  await expect(page.getByRole('heading', { name: 'Clarity for everyone.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Service availability' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.getByRole('button', { name: 'Register service' })).toHaveCount(0);
});
test('registration, viewer protection, and logout', async ({ page }, info) => {
  await page.goto('/register');
  // Exercise persistence past Spring Session JDBC's default 100-character principal limit.
  const viewerEmail = `viewer-${info.project.name}-${Date.now()}@${'a'.repeat(48)}.${'b'.repeat(48)}.test`;
  await page.getByLabel('Display name').fill('Browser viewer');
  await page.getByLabel('Email address').fill(viewerEmail);
  await page.getByLabel('Password', { exact: true }).fill('browser-viewer-password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('status')).toContainText('Account created');
  await page.getByRole('link', { name: 'Sign in', exact: true }).first().click();
  await page.getByLabel('Email address').fill(viewerEmail);
  await page.getByLabel('Password', { exact: true }).fill('browser-viewer-password');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page.getByRole('heading', { name: 'System overview' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Register service' })).toHaveCount(0);
  const result = await page.evaluate(async () => {
    const csrf = await fetch('/api/auth/csrf').then((r) => r.json());
    return (
      await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf.token },
        body: JSON.stringify({
          name: 'blocked',
          description: '',
          environment: 'STAGING',
          owner: 'x',
          healthTarget: 'NONE',
          publicVisible: false,
        }),
      })
    ).status;
  });
  expect(result).toBe(403);
  const menu = page.getByRole('button', { name: 'Open menu' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
});
