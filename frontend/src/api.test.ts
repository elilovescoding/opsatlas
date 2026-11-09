import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, getCsrf } from './api';
afterEach(() => vi.unstubAllGlobals());
describe('API boundary', () => {
  it('shares concurrent CSRF bootstrap to prevent session-cookie races', async () => {
    let complete!: (response: Response) => void;
    const request = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          complete = resolve;
        }),
    );
    vi.stubGlobal('fetch', request);
    const first = getCsrf();
    const second = getCsrf();
    expect(request).toHaveBeenCalledTimes(1);
    complete(new Response(JSON.stringify({ token: 'test-csrf', registrationEnabled: true })));
    expect(await first).toEqual(await second);
  });
  it('surfaces safe server error details', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ detail: 'Record not found.' }), { status: 404 }),
        ),
    );
    await expect(api('/services/missing')).rejects.toThrow('Record not found.');
  });
  it('handles a proxy error without exposing HTML', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<h1>bad gateway</h1>', { status: 502 })),
    );
    await expect(api('/dashboard')).rejects.toThrow('Request failed (502).');
  });
  it('notifies the app when an authenticated session expires', async () => {
    const expired = vi.fn();
    window.addEventListener('session-expired', expired);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    await expect(api('/services')).rejects.toThrow();
    expect(expired).toHaveBeenCalledTimes(1);
    window.removeEventListener('session-expired', expired);
  });
});
