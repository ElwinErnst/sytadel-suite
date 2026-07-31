'use server';

import { redirect } from 'next/navigation';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser';
import * as authClient from '@/lib/server/auth-client';
import * as passkeysClient from '@/lib/server/passkeys-client';
import {
  getCookieStore,
  getTokenSnapshot,
  setSessionCookies,
} from '@/lib/server/session';

export async function passkeyLoginBeginAction(input: {
  email: string;
  tenantSlug: string;
}) {
  return passkeysClient.authenticationBegin(input.email, input.tenantSlug);
}

export async function passkeyLoginFinishAction(input: {
  response: AuthenticationResponseJSON;
  tenantSlug: string;
}) {
  let tokenPair;
  try {
    tokenPair = await passkeysClient.authenticationFinish(
      input.response,
      input.tenantSlug,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Passkey login failed';
    return { ok: false as const, error: message };
  }

  try {
    const me = await authClient.me(tokenPair.accessToken);
    const cookieStore = await getCookieStore();
    await setSessionCookies(cookieStore, tokenPair, {
      id: me.tenant.id,
      slug: me.tenant.slug,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not load session';
    return { ok: false as const, error: message };
  }

  return { ok: true as const };
}

export async function passkeyRegisterBeginAction() {
  const { accessToken } = await getTokenSnapshot();
  if (!accessToken) {
    redirect('/login');
  }
  return passkeysClient.registrationBegin(accessToken);
}

export async function passkeyRegisterFinishAction(input: {
  response: RegistrationResponseJSON;
  friendlyName: string;
}) {
  const { accessToken } = await getTokenSnapshot();
  if (!accessToken) {
    return { ok: false as const, error: 'Session expired' };
  }
  try {
    const summary = await passkeysClient.registrationFinish(
      accessToken,
      input.response,
      input.friendlyName,
    );
    return { ok: true as const, passkey: summary };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Passkey registration failed';
    return { ok: false as const, error: message };
  }
}

export async function listPasskeysAction() {
  const { accessToken } = await getTokenSnapshot();
  if (!accessToken) return [];
  return passkeysClient.list(accessToken);
}

export async function renamePasskeyAction(id: string, friendlyName: string) {
  const { accessToken } = await getTokenSnapshot();
  if (!accessToken) {
    return { ok: false as const, error: 'Session expired' };
  }
  try {
    const summary = await passkeysClient.rename(accessToken, id, friendlyName);
    return { ok: true as const, passkey: summary };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Rename failed';
    return { ok: false as const, error: message };
  }
}

export async function deletePasskeyAction(id: string) {
  const { accessToken } = await getTokenSnapshot();
  if (!accessToken) {
    return { ok: false as const, error: 'Session expired' };
  }
  try {
    await passkeysClient.remove(accessToken, id);
    return { ok: true as const };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Delete failed';
    return { ok: false as const, error: message };
  }
}
