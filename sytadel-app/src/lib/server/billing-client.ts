import { env } from './env';
import { requestJson } from './http';
import type { AuditEventsPage, ChainVerifyResult } from './types/audit-event.type';
import type {
  BillingCheckoutSession,
  BillingOverview,
  BillingPortalSession,
  BillingSubscription,
} from './types';

export async function getBillingOverview(accessToken: string) {
  return requestJson<BillingOverview>(`${env.billingApiUrl}/billing/subscription`, {
    method: 'GET',
    token: accessToken,
  });
}

export async function createCheckoutSession(
  accessToken: string,
  input: {
    industry: 'GENERAL' | 'FINTECH' | 'GOVTECH' | 'HEALTHTECH' | 'LEGALTECH';
    tier: 'BASE' | 'GROWTH' | 'BUSINESS' | 'CUSTOM';
    billingCycle: 'monthly' | 'yearly';
    seats?: number;
    billingEmail?: string;
    companyName?: string;
    addOns?: Array<'AUTH_API' | 'VAULT_API' | 'ZERO_TRUST_API'>;
  },
) {
  return requestJson<BillingCheckoutSession>(
    `${env.billingApiUrl}/billing/checkout-sessions`,
    {
      method: 'POST',
      token: accessToken,
      body: input,
    },
  );
}

export async function createPortalSession(accessToken: string) {
  return requestJson<BillingPortalSession>(`${env.billingApiUrl}/billing/portal-sessions`, {
    method: 'POST',
    token: accessToken,
  });
}

export async function scheduleCancellation(accessToken: string) {
  return requestJson<{
    ok: boolean;
    subscriptionId: string;
    cancelAtPeriodEnd: boolean;
    effectiveAt: string | null;
    dataDeletionDueAt: string | null;
  }>(`${env.billingApiUrl}/billing/subscription/cancel`, {
    method: 'POST',
    token: accessToken,
  });
}

export function getActiveSubscription(subscriptions: BillingSubscription | null | undefined) {
  return subscriptions ?? null;
}

/** Billing audit events (subscription lifecycle). Tenant from the token. */
export async function listBillingAuditEvents(
  accessToken: string,
  query: { page?: number; limit?: number } = {},
) {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  const suffix = params.toString();

  return requestJson<AuditEventsPage>(
    `${env.billingApiUrl}/billing/audit-events${suffix ? `?${suffix}` : ''}`,
    { method: 'GET', token: accessToken },
  );
}

/** Verify the tamper-evident chain of the billing audit store for a tenant. */
export async function verifyBillingChain(accessToken: string) {
  return requestJson<ChainVerifyResult>(
    `${env.billingApiUrl}/billing/audit-events/verify`,
    { method: 'GET', token: accessToken },
  );
}
