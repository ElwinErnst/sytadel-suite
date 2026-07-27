import { env } from './env';
import { requestJson } from './http';
import type {
  ClientAppRecord,
  CreatedServiceAccountRecord,
  MembershipRecord,
  SessionUser,
  ServiceAccountRecord,
  TenantEntitlements,
  TenantSummary,
  TokenPair,
} from './types';

export type LoginInput = {
  email: string;
  password: string;
  tenantSlug: string;
};

export async function login(input: LoginInput) {
  return requestJson<TokenPair>(`${env.authApiUrl}/auth/login`, {
    method: 'POST',
    body: input,
  });
}

export async function logout(tokenOrSession: {
  refreshToken?: string;
  sessionId?: string | null;
}) {
  return requestJson<void>(`${env.authApiUrl}/auth/logout`, {
    method: 'POST',
    body: tokenOrSession,
  });
}

export async function logoutAll(accessToken: string) {
  return requestJson<void>(`${env.authApiUrl}/auth/logout-all`, {
    method: 'POST',
    token: accessToken,
  });
}

export async function me(accessToken: string) {
  return requestJson<{
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
    };
    tenant: {
      id: string;
      name: string;
      slug: string;
      planCode: string | null;
      billingBypass?: boolean;
      entitlements: TenantEntitlements;
    };
    roles: Array<'OWNER' | 'ADMIN' | 'MEMBER'>;
    sessionId: string | null;
  }>(`${env.authApiUrl}/auth/me`, {
    method: 'GET',
    token: accessToken,
  });
}

export async function getTenant(accessToken: string, tenantId: string) {
  return requestJson<TenantSummary>(`${env.authApiUrl}/tenants/${tenantId}`, {
    method: 'GET',
    token: accessToken,
  });
}

export async function listTenantMemberships(accessToken: string, tenantId: string) {
  return requestJson<MembershipRecord[]>(
    `${env.authApiUrl}/tenants/${tenantId}/memberships`,
    {
      method: 'GET',
      token: accessToken,
    },
  );
}

export async function listUserMemberships(accessToken: string, userId: string) {
  return requestJson<MembershipRecord[]>(
    `${env.authApiUrl}/users/${userId}/memberships`,
    {
      method: 'GET',
      token: accessToken,
    },
  );
}

export async function createUser(
  accessToken: string,
  input: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  },
) {
  return requestJson<SessionUser>(`${env.authApiUrl}/users`, {
    method: 'POST',
    token: accessToken,
    body: input,
  });
}

export async function createTenant(
  accessToken: string,
  input: {
    name: string;
    slug: string;
    planCode?: string;
    ztPoliciesEnabled?: boolean;
    vaultsEnabled?: boolean;
    maxVaults?: number;
    billingBypass?: boolean;
  },
) {
  return requestJson<TenantSummary>(`${env.authApiUrl}/tenants`, {
    method: 'POST',
    token: accessToken,
    body: input,
  });
}

export async function createMembership(
  accessToken: string,
  input: { userId: string; tenantId: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' },
) {
  return requestJson<MembershipRecord>(`${env.authApiUrl}/memberships`, {
    method: 'POST',
    token: accessToken,
    body: input,
  });
}

export async function updateTenant(
  accessToken: string,
  tenantId: string,
  input: {
    name?: string;
    slug?: string;
    planCode?: string;
    ztPoliciesEnabled?: boolean;
    vaultsEnabled?: boolean;
    maxVaults?: number;
    isActive?: boolean;
    billingBypass?: boolean;
  },
) {
  return requestJson<TenantSummary>(`${env.authApiUrl}/tenants/${tenantId}`, {
    method: 'PATCH',
    token: accessToken,
    body: input,
  });
}

export async function updateUser(
  accessToken: string,
  userId: string,
  input: {
    firstName?: string;
    lastName?: string;
    isActive?: boolean;
  },
) {
  return requestJson<SessionUser>(`${env.authApiUrl}/users/${userId}`, {
    method: 'PATCH',
    token: accessToken,
    body: input,
  });
}

export async function updateMembership(
  accessToken: string,
  membershipId: string,
  input: { role?: 'OWNER' | 'ADMIN' | 'MEMBER'; isActive?: boolean },
) {
  return requestJson<MembershipRecord>(
    `${env.authApiUrl}/memberships/${membershipId}`,
    {
      method: 'PATCH',
      token: accessToken,
      body: input,
    },
  );
}

export async function listClientApps(accessToken: string, tenantId: string) {
  return requestJson<ClientAppRecord[]>(
    `${env.authApiUrl}/tenants/${tenantId}/client-apps`,
    {
      method: 'GET',
      token: accessToken,
    },
  );
}

export async function createClientApp(
  accessToken: string,
  tenantId: string,
  input: {
    name: string;
    slug: string;
    description?: string;
  },
) {
  return requestJson<ClientAppRecord>(
    `${env.authApiUrl}/tenants/${tenantId}/client-apps`,
    {
      method: 'POST',
      token: accessToken,
      body: input,
    },
  );
}

export async function updateClientApp(
  accessToken: string,
  tenantId: string,
  clientAppId: string,
  input: {
    name?: string;
    slug?: string;
    description?: string;
    isActive?: boolean;
  },
) {
  return requestJson<ClientAppRecord>(
    `${env.authApiUrl}/tenants/${tenantId}/client-apps/${clientAppId}`,
    {
      method: 'PATCH',
      token: accessToken,
      body: input,
    },
  );
}

export async function createServiceAccount(
  accessToken: string,
  tenantId: string,
  clientAppId: string,
  input: {
    name: string;
    description?: string;
  },
) {
  return requestJson<CreatedServiceAccountRecord>(
    `${env.authApiUrl}/tenants/${tenantId}/client-apps/${clientAppId}/service-accounts`,
    {
      method: 'POST',
      token: accessToken,
      body: input,
    },
  );
}

export async function listServiceAccounts(
  accessToken: string,
  tenantId: string,
  clientAppId: string,
) {
  return requestJson<ServiceAccountRecord[]>(
    `${env.authApiUrl}/tenants/${tenantId}/client-apps/${clientAppId}/service-accounts`,
    {
      method: 'GET',
      token: accessToken,
    },
  );
}

export async function updateServiceAccount(
  accessToken: string,
  tenantId: string,
  serviceAccountId: string,
  input: {
    name?: string;
    description?: string;
    isActive?: boolean;
  },
) {
  return requestJson<ServiceAccountRecord>(
    `${env.authApiUrl}/tenants/${tenantId}/service-accounts/${serviceAccountId}`,
    {
      method: 'PATCH',
      token: accessToken,
      body: input,
    },
  );
}

export async function rotateServiceAccountSecret(
  accessToken: string,
  tenantId: string,
  serviceAccountId: string,
) {
  return requestJson<CreatedServiceAccountRecord>(
    `${env.authApiUrl}/tenants/${tenantId}/service-accounts/${serviceAccountId}/rotate-secret`,
    {
      method: 'POST',
      token: accessToken,
    },
  );
}
