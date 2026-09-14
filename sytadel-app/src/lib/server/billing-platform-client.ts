import { env } from './env';
import { requestJson } from './http';

export type ProviderConnectionSummary = {
  id: string;
  clientAppId: string | null;
  environmentId: string | null;
  provider: 'mercadopago' | 'stripe' | 'mock';
  status: 'active' | 'disabled';
  secretReference: string | null;
  createdAt: string;
};

export type WebhookEndpointSummary = {
  id: string;
  clientAppId: string | null;
  environmentId: string | null;
  url: string;
  secretPreview: string;
  enabled: boolean;
  events: string[];
  createdAt: string;
};

export type UsageMetric = {
  addonCode: string;
  metric: string;
  quantity: number;
  events: number;
};

export type UsageEnvironment = {
  environmentId: string | null;
  totalQuantity: number;
  totalEvents: number;
  metrics: UsageMetric[];
};

export type UsageApplication = {
  clientAppId: string | null;
  totalQuantity: number;
  totalEvents: number;
  environments: UsageEnvironment[];
};

export type UsageByApplication = {
  tenantId: string;
  applications: UsageApplication[];
};

export async function listProviderConnections(accessToken: string) {
  return requestJson<ProviderConnectionSummary[]>(
    `${env.billingApiUrl}/billing/provider-connections`,
    { method: 'GET', token: accessToken },
  );
}

export async function listWebhookEndpoints(accessToken: string) {
  return requestJson<WebhookEndpointSummary[]>(
    `${env.billingApiUrl}/billing/webhook-endpoints`,
    { method: 'GET', token: accessToken },
  );
}

export async function getUsageByApplication(accessToken: string) {
  return requestJson<UsageByApplication>(
    `${env.billingApiUrl}/billing/usage/by-application`,
    { method: 'GET', token: accessToken },
  );
}
