import { env } from './env';
import { requestJson } from './http';

export type ServiceAccountSummary = {
  id: string;
  clientAppId: string;
  environmentId: string | null;
  name: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  secretPreview: string;
};

export type ClientAppSummary = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  serviceAccounts: ServiceAccountSummary[];
};

export type EnvironmentSummary = {
  id: string;
  clientAppId: string;
  name: 'development' | 'staging' | 'production';
  slug: string;
  isActive: boolean;
};

export async function listApplications(accessToken: string, tenantId: string) {
  return requestJson<ClientAppSummary[]>(
    `${env.authApiUrl}/tenants/${tenantId}/client-apps`,
    { method: 'GET', token: accessToken },
  );
}

export async function listEnvironments(
  accessToken: string,
  tenantId: string,
  clientAppId: string,
) {
  return requestJson<EnvironmentSummary[]>(
    `${env.authApiUrl}/tenants/${tenantId}/client-apps/${clientAppId}/environments`,
    { method: 'GET', token: accessToken },
  );
}

// The list endpoint already returns each app with its service accounts, so a
// single fetch gives everything the detail view needs; there is no single-app
// GET on auth-api.
export async function getApplication(
  accessToken: string,
  tenantId: string,
  clientAppId: string,
): Promise<ClientAppSummary | null> {
  const apps = await listApplications(accessToken, tenantId);
  return apps.find((app) => app.id === clientAppId) ?? null;
}

export async function createApplication(
  accessToken: string,
  tenantId: string,
  input: { name: string; slug: string; description?: string },
) {
  return requestJson<ClientAppSummary>(
    `${env.authApiUrl}/tenants/${tenantId}/client-apps`,
    { method: 'POST', token: accessToken, body: input },
  );
}
