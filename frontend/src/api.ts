let csrf: string | null = null;
let csrfRequest: Promise<{ token: string; registrationEnabled: boolean }> | null = null;
export function getCsrf() {
  // Share anonymous-session bootstrap; concurrent responses must not race cookies/tokens.
  csrfRequest ??= loadCsrf().finally(() => {
    csrfRequest = null;
  });
  return csrfRequest;
}
async function loadCsrf() {
  const response = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
  if (!response.ok) throw new Error('Unable to establish a secure session.');
  const result = (await response.json()) as { token: string; registrationEnabled: boolean };
  csrf = result.token;
  return result;
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method ?? 'GET';
  if (method !== 'GET' && !csrf) await getCsrf();
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(method !== 'GET' ? { 'X-CSRF-TOKEN': csrf! } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/'))
      window.dispatchEvent(new Event('session-expired'));
    const problem = await response.json().catch(() => ({}));
    throw new Error(problem.detail ?? `Request failed (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export async function mutate<T>(path: string, method: string, input?: unknown) {
  return api<T>(path, { method, ...(input !== undefined ? { body: JSON.stringify(input) } : {}) });
}
