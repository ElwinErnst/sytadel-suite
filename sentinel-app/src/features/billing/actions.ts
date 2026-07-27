'use server';

import { redirect } from 'next/navigation';
import * as billingClient from '@/lib/server/billing-client';
import { requireSession, withSessionToken } from '@/lib/server/session';

function readRequiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? '').trim();
  if (!value) {
    throw new Error(`Falta ${key}.`);
  }
  return value;
}

function readOptionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? '').trim();
  return value || undefined;
}

function readOptionalSeats(formData: FormData) {
  const raw = String(formData.get('seats') ?? '').trim();
  if (!raw) return undefined;

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) {
    throw new Error('La cantidad de seats es invalida.');
  }

  return value;
}

function readAddOns(formData: FormData) {
  return formData
    .getAll('addOns')
    .map((value) => String(value).trim())
    .filter(Boolean) as Array<'AUTH_API' | 'VAULT_API' | 'ZERO_TRUST_API'>;
}

export async function createCheckoutSessionAction(formData: FormData) {
  const session = await requireSession();

  if (!session.roles.includes('OWNER')) {
    redirect('/app/billing?error=Solo%20OWNER%20puede%20actualizar%20el%20plan');
  }

  let checkoutUrl: string;
  try {
    const industry = readRequiredString(formData, 'industry') as
      | 'GENERAL'
      | 'FINTECH'
      | 'GOVTECH'
      | 'HEALTHTECH'
      | 'LEGALTECH';
    const tier = readRequiredString(formData, 'tier') as
      | 'BASE'
      | 'GROWTH'
      | 'BUSINESS'
      | 'CUSTOM';
    const billingCycle = readRequiredString(formData, 'billingCycle') as
      | 'monthly'
      | 'yearly';
    const billingEmail =
      readOptionalString(formData, 'billingEmail') ?? session.user.email;
    const companyName =
      readOptionalString(formData, 'companyName') ?? session.tenant.name;
    const seats = readOptionalSeats(formData);
    const addOns = readAddOns(formData);

    const checkout = await withSessionToken((token) =>
      billingClient.createCheckoutSession(token, {
        industry,
        tier,
        billingCycle,
        seats,
        billingEmail,
        companyName,
        addOns,
      }),
    );
    checkoutUrl = checkout.checkoutUrl;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo iniciar el checkout.';
    redirect(`/app/billing?error=${encodeURIComponent(message)}`);
  }

  redirect(checkoutUrl);
}

export async function createPortalSessionAction() {
  const session = await requireSession();

  if (!session.roles.includes('OWNER')) {
    redirect('/app/billing?error=Solo%20OWNER%20puede%20administrar%20la%20facturacion');
  }

  let portalUrl: string;
  try {
    const portal = await withSessionToken((token) =>
      billingClient.createPortalSession(token),
    );
    portalUrl = portal.url;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo abrir el portal de facturación.';
    redirect(`/app/billing?error=${encodeURIComponent(message)}`);
  }

  redirect(portalUrl);
}

export async function cancelSubscriptionAction() {
  const session = await requireSession();

  if (!session.roles.includes('OWNER')) {
    redirect('/app/billing?error=Solo%20OWNER%20puede%20administrar%20la%20facturacion');
  }

  try {
    await withSessionToken((token) => billingClient.scheduleCancellation(token));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo programar la baja de la suscripción.';
    redirect(`/app/billing?error=${encodeURIComponent(message)}`);
  }

  redirect('/app/billing?billing=cancel_scheduled');
}
