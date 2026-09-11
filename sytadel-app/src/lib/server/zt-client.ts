import { env } from './env';
import { requestJson } from './http';
import type { AuditEventsPage } from './types/audit-event.type';

export type ZeroTrustApiStatus = {
  tenantId: string;
  actorType: 'user' | 'service_account';
  policiesRules: number;
  upstreams: number;
};

export async function getZeroTrustApiStatus(accessToken: string) {
  return requestJson<ZeroTrustApiStatus>(`${env.ztApiUrl}/api/zt/status`, {
    method: 'GET',
    token: accessToken,
  });
}

/** Zero Trust decision log (allow/deny). Tenant is derived from the token. */
export async function listZtAuditEvents(
  accessToken: string,
  query: { page?: number; limit?: number } = {},
) {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  const suffix = params.toString();

  return requestJson<AuditEventsPage>(
    `${env.ztApiUrl}/api/zt/audit-events${suffix ? `?${suffix}` : ''}`,
    { method: 'GET', token: accessToken },
  );
}
