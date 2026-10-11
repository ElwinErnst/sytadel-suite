import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/server/http';
import type {
  OrganizationMembershipRecord,
  OrganizationTenantRecord,
} from '@/lib/server/types';

const { authMocks, sessionMocks } = vi.hoisted(() => ({
  authMocks: {
    listOrganizations: vi.fn(),
    listOrganizationTenants: vi.fn(),
  },
  sessionMocks: {
    requireSession: vi.fn(),
    withSessionToken: vi.fn(),
  },
}));

vi.mock('@/lib/server/auth-client', () => authMocks);
vi.mock('@/lib/server/session', () => sessionMocks);

import OrganizationsPage from '@/app/app/organizations/page';

function organization(
  id: string,
  name: string,
  role: 'OWNER' | 'ADMIN' = 'OWNER',
): OrganizationMembershipRecord {
  return {
    id: `membership-${id}`,
    organizationId: id,
    userId: 'user-1',
    role,
    isActive: true,
    createdAt: '2026-10-01T12:00:00.000Z',
    organization: { id, name, slug: id },
  };
}

function tenant(
  organizationId: string,
  id: string,
  name: string,
  isActive: boolean,
): OrganizationTenantRecord {
  return {
    id: `link-${id}`,
    organizationId,
    tenantId: id,
    createdAt: '2026-10-01T12:00:00.000Z',
    tenant: { id, name, slug: id, isActive, planCode: 'FREE' },
  };
}

async function renderPage() {
  return renderToStaticMarkup(await OrganizationsPage());
}

function organizationCards(markup: string) {
  return [...markup.matchAll(/<article class="panel">([\s\S]*?)<\/article>/g)].map(
    (match) => match[1],
  );
}

describe('Organizations page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMocks.requireSession.mockResolvedValue({});
    sessionMocks.withSessionToken.mockImplementation(
      (callback: (token: string) => Promise<unknown>) => callback('test-token'),
    );
  });

  it('keeps tenant rows associated with their organization cards', async () => {
    const memberships = [organization('org-alpha', 'Alpha'), organization('org-beta', 'Beta', 'ADMIN')];
    authMocks.listOrganizations.mockResolvedValue(memberships);
    authMocks.listOrganizationTenants.mockImplementation(
      async (_token: string, organizationId: string) =>
        organizationId === 'org-alpha'
          ? [tenant('org-alpha', 'tenant-alpha', 'Alpha tenant', true)]
          : [tenant('org-beta', 'tenant-beta', 'Beta tenant', false)],
    );

    const markup = await renderPage();
    const cards = organizationCards(markup);

    expect(cards).toHaveLength(2);
    expect(cards[0]).toContain('Alpha');
    expect(cards[0]).toContain('Alpha tenant');
    expect(cards[0]).not.toContain('Beta tenant');
    expect(cards[1]).toContain('Beta');
    expect(cards[1]).toContain('Beta tenant');
    expect(cards[1]).not.toContain('Alpha tenant');
    expect(authMocks.listOrganizationTenants).toHaveBeenNthCalledWith(
      1,
      'test-token',
      'org-alpha',
    );
    expect(authMocks.listOrganizationTenants).toHaveBeenNthCalledWith(
      2,
      'test-token',
      'org-beta',
    );
  });

  it('shows the organization empty state when the member has no organizations', async () => {
    authMocks.listOrganizations.mockResolvedValue([]);

    const markup = await renderPage();

    expect(markup).toContain('Todavía no pertenecés a una organización');
    expect(authMocks.listOrganizationTenants).not.toHaveBeenCalled();
  });

  it('shows the tenant empty state when an organization has no linked tenants', async () => {
    authMocks.listOrganizations.mockResolvedValue([organization('org-empty', 'Empty org')]);
    authMocks.listOrganizationTenants.mockResolvedValue([]);

    const markup = await renderPage();

    expect(organizationCards(markup)[0]).toContain('Todavía no hay tenants vinculados.');
    expect(markup).not.toContain('Reintentar carga');
  });

  it('renders active and inactive tenant labels', async () => {
    authMocks.listOrganizations.mockResolvedValue([organization('org-status', 'Status org')]);
    authMocks.listOrganizationTenants.mockResolvedValue([
      tenant('org-status', 'tenant-active', 'Active tenant', true),
      tenant('org-status', 'tenant-inactive', 'Inactive tenant', false),
    ]);

    const markup = await renderPage();
    const card = organizationCards(markup)[0];

    expect(card).toContain('Active tenant');
    expect(card).toContain('Inactive tenant');
    expect(card).toContain('>Activo</span>');
    expect(card).toContain('>Inactivo</span>');
  });

  it('keeps healthy organizations visible and offers a retry when one tenant list fails', async () => {
    authMocks.listOrganizations.mockResolvedValue([
      organization('org-unavailable', 'Unavailable org'),
      organization('org-healthy', 'Healthy org'),
    ]);
    authMocks.listOrganizationTenants.mockImplementation(
      async (_token: string, organizationId: string) => {
        if (organizationId === 'org-unavailable') {
          throw new ApiError('Auth API unavailable', 503);
        }
        return [tenant('org-healthy', 'tenant-healthy', 'Healthy tenant', true)];
      },
    );

    const markup = await renderPage();
    const cards = organizationCards(markup);

    expect(cards).toHaveLength(2);
    expect(cards[0]).toContain('Unavailable org');
    expect(cards[0]).toContain('No se pudieron cargar los tenants de esta organización.');
    expect(cards[0]).toContain('href="/app/organizations"');
    expect(cards[1]).toContain('Healthy org');
    expect(cards[1]).toContain('Healthy tenant');
  });

  it.each([401, 403])(
    'does not swallow authorization failures (%i) from tenant-list requests',
    async (status) => {
      const membership = organization('org-private', 'Private org');
      const authorizationFailure = new ApiError('Not authorized', status);
      authMocks.listOrganizations.mockResolvedValue([membership]);
      authMocks.listOrganizationTenants.mockRejectedValue(authorizationFailure);

      await expect(renderPage()).rejects.toBe(authorizationFailure);
    },
  );

  it('runs the session guard before making organization requests', async () => {
    const sessionFailure = new Error('Session redirect');
    sessionMocks.requireSession.mockRejectedValue(sessionFailure);

    await expect(renderPage()).rejects.toBe(sessionFailure);
    expect(authMocks.listOrganizations).not.toHaveBeenCalled();
  });
});
