import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, requestJson } from '@/lib/server/http';

describe('requestJson', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('serializa objetos JSON y devuelve la respuesta parseada', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      requestJson<{ ok: boolean }>('https://example.com', {
        method: 'POST',
        body: { hello: 'world' },
      }),
    ).resolves.toEqual({ ok: true });
  });

  it('eleva ApiError cuando la API responde con error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Invalid credentials' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(requestJson('https://example.com')).rejects.toBeInstanceOf(ApiError);
  });
});
