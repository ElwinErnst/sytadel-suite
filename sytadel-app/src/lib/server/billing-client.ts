import { env } from './env';
import { requestJson } from './http';
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
