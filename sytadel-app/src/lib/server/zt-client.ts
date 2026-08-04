import { env } from './env';
import { requestJson } from './http';

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
