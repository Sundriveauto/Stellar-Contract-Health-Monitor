import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, qs } from '@/lib/api';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
afterEach(() => fetchMock.mockReset());

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('api client', () => {
  it('sends JSON only when there is a body', async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true }));
    await api('/alerts/a1/acknowledge', { method: 'POST' });
    const [, bare] = fetchMock.mock.calls[0]!;
    expect(bare.headers).toBeUndefined();
    expect(bare.body).toBeUndefined();

    await api('/contracts', { method: 'POST', body: { label: 'x' } });
    const [url, withBody] = fetchMock.mock.calls[1]!;
    expect(url).toBe('/api/proxy/contracts');
    expect(withBody.headers).toEqual({ 'content-type': 'application/json' });
    expect(withBody.body).toBe('{"label":"x"}');
  });

  it('maps API errors and handles 204', async () => {
    fetchMock.mockResolvedValueOnce(json(403, { error: { code: 'FORBIDDEN', message: 'nope' } }));
    const err = await api('/x', { method: 'DELETE' }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'nope' });

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(api('/x', { method: 'DELETE' })).resolves.toBeUndefined();
  });
});

describe('qs', () => {
  it('drops empty values', () => {
    expect(qs({ a: 'x', b: '', c: null, d: undefined, e: 0, f: false })).toBe('?a=x&e=0&f=false');
    expect(qs({})).toBe('');
  });
});
