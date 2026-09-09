import { env } from './env';
import { requestJson } from './http';
import type { PolicySet, TenantPolicyVersion } from './types/policy.type';

/**
 * Client for the tenant Zero Trust policy admin API. The source of truth is
 * auth-api (`tenants/:tenantId/policy`), NOT zerotrust-api: zerotrust-api reads
 * the published set from here, caches it, and enforces it. The console
 * configures policies here and shows the enforced state from the zt status.
 */

/** Current published policy. Throws ApiError 404 when the tenant has none. */
export async function getPublishedPolicy(accessToken: string, tenantId: string) {
  return requestJson<TenantPolicyVersion>(
    `${env.authApiUrl}/tenants/${tenantId}/policy`,
    { method: 'GET', token: accessToken },
  );
}

/** Version history: who published which version and when (config audit). */
export async function listPolicyVersions(accessToken: string, tenantId: string) {
  return requestJson<TenantPolicyVersion[]>(
    `${env.authApiUrl}/tenants/${tenantId}/policy/versions`,
    { method: 'GET', token: accessToken },
  );
}

/** Publish a new policy version. auth-api validates the set and records the
 * publisher; a new published row is created and the previous one archived. */
export async function publishPolicy(
  accessToken: string,
  tenantId: string,
  policySet: PolicySet,
) {
  return requestJson<TenantPolicyVersion>(
    `${env.authApiUrl}/tenants/${tenantId}/policy`,
    { method: 'PUT', token: accessToken, body: policySet },
  );
}
