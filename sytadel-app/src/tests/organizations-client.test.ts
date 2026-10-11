import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '@/lib/server/env';
import {
  listOrganizationTenants,
  listOrganizations,
} from '@/lib/server/auth-client';

describe('organization Auth API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lists the signed-in user organizations with the access token', async () => {
    const rows = [{ organizationId: 'org-1', role: 'OWNER' }];
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(rows), { status: 200 }),
    );

    await expect(listOrganizations('access-token')).resolves.toEqual(rows);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe(`${env.authApiUrl}/organizations`);
    expect(options?.method).toBe('GET');
    expect((options?.headers as Headers).get('authorization')).toBe(
      'Bearer access-token',
    );
    expect(options?.cache).toBe('no-store');
  });

  it('lists only the linked tenants for the requested organization', async () => {
    const rows = [{ tenantId: 'tenant-1', tenant: { id: 'tenant-1' } }];
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(rows), { status: 200 }),
    );

    await expect(
      listOrganizationTenants('access-token', 'org-1'),
    ).resolves.toEqual(rows);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe(`${env.authApiUrl}/organizations/org-1/tenants`);
    expect(options?.method).toBe('GET');
    expect((options?.headers as Headers).get('authorization')).toBe(
      'Bearer access-token',
    );
  });
});
